"""Regresión: las reasignaciones se guardan, se devuelven y se filtran por sucursal efectiva."""
from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # registra los modelos sin ejecutar migraciones
from app.infrastructure.database import Base
from app.core.dependencies import get_db, get_current_active_user
from app.domain.entities.branch import Branch
from app.domain.entities.user import Role, User
from app.presentation.routes.admin import router


@pytest.fixture
def scenario():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    principal = Branch(name="Principal", address="Calle 1", city="LP", department="LP")
    norte = Branch(name="Norte", address="Calle 2", city="LP", department="LP")
    admin_role, worker_role = Role(name="Admin"), Role(name="Operaria")
    db.add_all([principal, norte, admin_role, worker_role])
    db.flush()
    admin = User(username="admin_branch", email="admin_branch@test.com", hashed_password="unused",
                 role_id=admin_role.id, branch_id=principal.id, is_active=True)
    worker = User(username="valeria_test", email="valeria_test@test.com", hashed_password="unused",
                  role_id=worker_role.id, branch_id=norte.id, is_active=True)
    db.add_all([admin, worker])
    db.commit()
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: admin
    with TestClient(app) as client:
        yield client, db, worker, principal, norte
    db.close()
    engine.dispose()


def assign(client, worker, branch, **extra):
    return client.patch(f"/admin/users/{worker.id}/branch-assignment", json={"branch_id": branch.id, **extra})


def test_temporary_response_and_reload_preserve_origin_and_destination(scenario):
    client, db, worker, principal, norte = scenario
    until = (date.today() + timedelta(days=7)).isoformat()
    response = assign(client, worker, principal, temp_until=until)
    assert response.status_code == 200
    data = response.json()
    assert data["branch_id"] == norte.id and data["branch"]["name"] == "Norte"
    assert data["temp_branch_id"] == principal.id
    assert data["temp_branch"]["name"] == "Principal"
    assert data["temp_branch_until"] == until
    assert data["effective_branch_id"] == principal.id and data["is_temp_assigned"] is True
    refreshed = next(u for u in client.get("/admin/users").json() if u["id"] == worker.id)
    assert refreshed["temp_branch"]["name"] == "Principal"
    assert refreshed["effective_branch_id"] == principal.id


def test_branch_filter_includes_incoming_worker_and_excludes_outgoing(scenario):
    client, db, worker, principal, norte = scenario
    assert assign(client, worker, principal, temp_until=date.today().isoformat()).status_code == 200
    assert worker.id in [u["id"] for u in client.get("/admin/users").json()]
    # Al mirar desde el origen, la operaria ya está trabajando en la otra sucursal.
    actor = db.query(User).filter(User.username == "admin_branch").one()
    actor.branch_id = norte.id
    db.commit()
    assert worker.id not in [u["id"] for u in client.get("/admin/users").json()]


def test_expired_assignment_returns_to_origin(scenario):
    client, db, worker, principal, norte = scenario
    worker.temp_branch_id = principal.id
    worker.temp_branch_until = date.today() - timedelta(days=1)
    actor = db.query(User).filter(User.username == "admin_branch").one()
    actor.branch_id = norte.id
    db.commit()
    data = next(u for u in client.get("/admin/users").json() if u["id"] == worker.id)
    assert data["effective_branch_id"] == norte.id
    assert data["is_temp_assigned"] is False


def test_permanent_move_clears_temporary_assignment(scenario):
    client, db, worker, principal, norte = scenario
    assert assign(client, worker, principal, temp_until=date.today().isoformat()).status_code == 200
    response = assign(client, worker, principal, permanent=True)
    assert response.status_code == 200
    data = response.json()
    assert data["branch_id"] == principal.id and data["branch"]["name"] == "Principal"
    assert data["temp_branch_id"] is None and data["temp_branch_until"] is None
    assert data["temp_branch"] is None and data["is_temp_assigned"] is False
    assert data["effective_branch_id"] == principal.id


def test_cancel_temporary_assignment_restores_origin(scenario):
    client, db, worker, principal, norte = scenario
    assert assign(client, worker, principal, temp_until=date.today().isoformat()).status_code == 200
    response = client.patch(f"/admin/users/{worker.id}/branch-assignment", json={"branch_id": None})
    assert response.status_code == 200
    data = response.json()
    assert data["branch_id"] == norte.id and data["effective_branch_id"] == norte.id
    assert data["temp_branch_id"] is None and data["temp_branch"] is None
    assert data["is_temp_assigned"] is False
