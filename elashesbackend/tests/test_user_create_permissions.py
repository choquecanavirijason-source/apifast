"""Al crear un usuario, los permisos de su rol llegan solos (no se eligen desde cero) y se le
pueden sumar permisos EXTRA. Solo SuperAdmin y Admin pueden dar extras; la Secretaria no.

Ejecutar:
  cd elashesbackend
  pytest tests/test_user_create_permissions.py -v
"""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # registra los modelos sin ejecutar migraciones
from app.core.dependencies import _user_has_permission, get_current_active_user, get_db
from app.domain.entities.branch import Branch
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database import Base
from app.presentation.routes.admin import router

# Los permisos que tiene hoy la Cajera del local.
CASHIER_PERMISSIONS = (
    "appointments:view", "appointments:manage", "branches:view", "catalog:view",
    "clients:view", "clients:manage", "inventory:view", "inventory:manage",
    "payments:view", "payments:manage", "services:view",
)
EXTRA_PERMISSIONS = ("settings:view", "audit:view", "users:manage")


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    perms = {name: Permission(name=name) for name in (*CASHIER_PERMISSIONS, *EXTRA_PERMISSIONS)}
    db.add_all(perms.values())
    cashier_role = Role(name="Cajera")
    cashier_role.permissions = [perms[name] for name in CASHIER_PERMISSIONS]
    operator_role = Role(name="Operaria")
    operator_role.permissions = [perms["appointments:view"], perms["services:view"]]
    super_role, admin_role, secretary_role = Role(name="SuperAdmin"), Role(name="Admin"), Role(name="Secretaria")
    branch = Branch(name="Principal", address="Calle 1", city="LP", department="LP")
    db.add_all([cashier_role, operator_role, super_role, admin_role, secretary_role, branch])
    db.flush()

    def staff(username, role):
        user = User(username=username, email=f"{username}@test.com", hashed_password="unused",
                    role_id=role.id, branch_id=branch.id, is_active=True)
        db.add(user)
        return user

    superadmin, admin, secretary = staff("super_t", super_role), staff("admin_t", admin_role), staff("secre_t", secretary_role)
    db.commit()

    holder = SimpleNamespace(user=superadmin)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: holder.user
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, db=db, holder=holder, superadmin=superadmin, admin=admin, secretary=secretary,
                              perms=perms, cashier=cashier_role, operator=operator_role, branch=branch.id)
    db.close()
    engine.dispose()


def new_user(work, username, role, **extra):
    return work.api.post("/admin/users", json={
        "username": username, "email": f"{username}@test.com", "password": "secreto123",
        "role_id": role.id, "branch_id": work.branch, **extra,
    })


def effective(work, user_id):
    work.db.expire_all()
    return {name for name in (*CASHIER_PERMISSIONS, *EXTRA_PERMISSIONS)
            if _user_has_permission(work.db.get(User, user_id), name)}


def test_new_cashier_gets_every_cashier_permission_without_choosing_any(work):
    response = new_user(work, "cajera_nueva", work.cashier)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["direct_permissions"] == []                                   # no se eligió nada
    assert {p["name"] for p in body["role"]["permissions"]} == set(CASHIER_PERMISSIONS)
    assert effective(work, body["id"]) == set(CASHIER_PERMISSIONS)            # y puede usarlos todos


def test_other_roles_work_the_same_way(work):
    body = new_user(work, "operaria_nueva", work.operator).json()
    assert body["direct_permissions"] == []
    assert effective(work, body["id"]) == {"appointments:view", "services:view"}


def test_extra_permissions_are_added_on_top_of_the_role(work):
    response = new_user(work, "cajera_mas", work.cashier,
                        permission_ids=[work.perms["settings:view"].id, work.perms["audit:view"].id])
    assert response.status_code == 201, response.text
    body = response.json()
    assert {p["name"] for p in body["direct_permissions"]} == {"settings:view", "audit:view"}
    assert effective(work, body["id"]) == set(CASHIER_PERMISSIONS) | {"settings:view", "audit:view"}


def test_repeated_extra_ids_are_harmless(work):
    pid = work.perms["settings:view"].id
    body = new_user(work, "cajera_rep", work.cashier, permission_ids=[pid, pid]).json()
    assert [p["name"] for p in body["direct_permissions"]] == ["settings:view"]


def test_unknown_permission_creates_nothing(work):
    before = work.db.query(User).count()
    response = new_user(work, "cajera_mala", work.cashier, permission_ids=[999999])
    assert response.status_code == 400
    assert work.db.query(User).count() == before        # no quedó un usuario a medias


def test_admin_can_give_extra_permissions(work):
    work.holder.user = work.admin
    response = new_user(work, "cajera_admin", work.cashier, permission_ids=[work.perms["settings:view"].id])
    assert response.status_code == 201
    assert [p["name"] for p in response.json()["direct_permissions"]] == ["settings:view"]


def test_secretary_cannot_give_extra_permissions_but_can_create_users(work):
    work.holder.user = work.secretary
    denied = new_user(work, "operaria_secre", work.operator, permission_ids=[work.perms["settings:view"].id])
    assert denied.status_code == 403
    assert work.db.query(User).filter(User.username == "operaria_secre").count() == 0
    # sin extras sigue creando normalmente, con los permisos de su rol
    created = new_user(work, "operaria_secre", work.operator)
    assert created.status_code == 201
    assert created.json()["direct_permissions"] == []
