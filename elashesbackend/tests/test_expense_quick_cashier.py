"""Gastos rápidos de la cajera: registra el gasto en SU sucursal, queda en la auditoría y
solo ve los gastos de su sucursal. Admin/SuperAdmin siguen pudiendo operar en cualquiera.

Ejecutar:
  cd elashesbackend
  pytest tests/test_expense_quick_cashier.py -v
"""
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # registra los modelos sin ejecutar migraciones
from app.core.dependencies import get_current_active_user, get_db
from app.domain.entities.audit_log import AuditLog
from app.domain.entities.branch import Branch
from app.domain.entities.expense import Expense
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database import Base
from app.presentation.controllers.expense_controller import router


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    perm = Permission(name="payments:manage")
    cashier_role, admin_role = Role(name="Cajera"), Role(name="Admin")
    cashier_role.permissions = [perm]
    admin_role.permissions = [perm]
    north = Branch(name="Norte", address="Calle 1", city="LP", department="LP")
    south = Branch(name="Sur", address="Calle 2", city="LP", department="LP")
    db.add_all([perm, cashier_role, admin_role, north, south])
    db.flush()
    cashier = User(username="caja_n", email="c@test.com", hashed_password="x", role_id=cashier_role.id,
                   branch_id=north.id, is_active=True)
    admin = User(username="admin_t", email="a@test.com", hashed_password="x", role_id=admin_role.id,
                 branch_id=north.id, is_active=True)
    db.add_all([cashier, admin])
    db.commit()

    holder = SimpleNamespace(user=cashier)
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: holder.user
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, db=db, holder=holder, cashier=cashier, admin=admin, north=north.id, south=south.id)
    db.close()
    engine.dispose()


def body(branch_id, **extra):
    return {"branch_id": branch_id, "amount": 25.5, "description": "Compra de agua", "expense_date": date.today().isoformat(), **extra}


def test_cashier_registers_expense_in_her_branch_and_it_is_audited(work):
    response = work.api.post("/expenses", json=body(work.north))
    assert response.status_code == 201, response.text
    assert response.json()["created_by_name"] == "caja_n"
    log = work.db.query(AuditLog).filter(AuditLog.entity_type == "expense").one()
    assert log.action == "create" and "Compra de agua" in log.description and log.branch_id == work.north


def test_cashier_cannot_register_expense_in_another_branch(work):
    response = work.api.post("/expenses", json=body(work.south))
    assert response.status_code == 403
    assert work.db.query(Expense).count() == 0


def test_cashier_only_lists_her_branch_even_if_she_asks_for_another(work):
    work.api.post("/expenses", json=body(work.north))
    work.holder.user = work.admin
    work.api.post("/expenses", json=body(work.south, description="Gasto del sur"))
    work.holder.user = work.cashier
    for query in ("", f"?branch_id={work.south}"):
        rows = work.api.get(f"/expenses{query}").json()
        assert [r["description"] for r in rows] == ["Compra de agua"]


def test_admin_can_still_register_in_any_branch(work):
    work.holder.user = work.admin
    assert work.api.post("/expenses", json=body(work.south)).status_code == 201
    assert len(work.api.get(f"/expenses?branch_id={work.south}").json()) == 1
