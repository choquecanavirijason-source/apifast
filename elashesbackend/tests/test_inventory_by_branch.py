"""Inventario por sucursal: minimo propio por sucursal, alerta por sucursal, acceso acotado y dashboard.

Ejecutar:
  cd elashesbackend
  pytest tests/test_inventory_by_branch.py -v
"""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # noqa: F401  (registra los modelos)
from app.application.services.inventory_service import movements as movements_module
from app.core.dependencies import get_current_active_user, get_db
from app.domain.entities.branch import Branch
from app.domain.entities.inventory import Batch, Product
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database import Base
from app.presentation.controllers import dashboard_controller, inventory_controller


@pytest.fixture
def inv(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    perms = [Permission(name=n) for n in ("inventory:view", "inventory:manage", "dashboard:view")]
    admin_role = Role(name="Admin")
    admin_role.permissions = perms
    cajera_role = Role(name="Cajera")
    cajera_role.permissions = perms
    principal, norte = Branch(name="Principal"), Branch(name="Norte")
    db.add_all([admin_role, cajera_role, principal, norte])
    db.flush()
    admin = User(username="admin", email="a@x.com", hashed_password="x", role=admin_role, is_active=True, phone="59170000001")
    cajera = User(username="cajera", email="c@x.com", hashed_password="x", role=cajera_role, branch_id=norte.id, is_active=True)
    adhesivo = Product(sku="ADH-1", name="Adhesivo", price=10, cost=5, min_stock=4)
    db.add_all([admin, cajera, adhesivo])
    db.flush()
    # Principal agotado (0) y Norte con 10: antes la suma (10) tapaba el faltante de Principal.
    db.add_all([
        Batch(product_id=adhesivo.id, branch_id=principal.id, initial_quantity=3, current_quantity=3, cost_per_unit=5),
        Batch(product_id=adhesivo.id, branch_id=norte.id, initial_quantity=10, current_quantity=10, cost_per_unit=5),
    ])
    db.commit()

    alerts = []
    monkeypatch.setattr(
        movements_module, "_fire_stock_alert_background",
        lambda db_, product, stock, min_s, branch_id=None: alerts.append((product.name, stock, min_s, branch_id)),
    )

    holder = {"user": admin}
    app = FastAPI()
    app.include_router(inventory_controller.router)
    app.include_router(dashboard_controller.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: holder["user"]
    with TestClient(app) as api:
        yield SimpleNamespace(
            api=api, db=db, holder=holder, admin=admin, cajera=cajera, alerts=alerts,
            principal=principal.id, norte=norte.id, product=adhesivo.id,
        )
    db.close()
    engine.dispose()


def batch_of(inv, branch_id):
    return inv.db.query(Batch).filter(Batch.product_id == inv.product, Batch.branch_id == branch_id).one()


def out(inv, branch_id, qty):
    batch = batch_of(inv, branch_id)
    return inv.api.post("/inventory/movements", json={
        "product_id": inv.product, "batch_id": batch.id, "branch_id": branch_id,
        "movement_type": "out", "quantity": qty, "note": "prueba"})


def test_alert_uses_the_stock_of_that_branch_only(inv):
    # Principal: 3 -> 1, ya estaba bajo el minimo (4): no cruza, no alerta de nuevo.
    assert out(inv, inv.principal, 2).status_code == 201
    assert inv.alerts == []
    # Norte: 10 -> 3 cruza el minimo (4) de Norte: alerta, y dice de que sucursal es.
    assert out(inv, inv.norte, 7).status_code == 201
    assert inv.alerts == [("Adhesivo", 3.0, 4.0, inv.norte)]


def test_branch_minimum_overrides_the_general_one(inv):
    r = inv.api.put(f"/inventory/products/{inv.product}", json={"min_stock": 8, "branch_id": inv.norte})
    assert r.status_code == 200
    # El general no cambia; solo Norte tiene 8.
    assert inv.db.query(Product).get(inv.product).min_stock == 4
    norte = inv.api.get("/inventory/products", params={"branch_id": inv.norte}).json()[0]
    principal = inv.api.get("/inventory/products", params={"branch_id": inv.principal}).json()[0]
    assert (norte["min_stock"], norte["min_stock_is_branch"]) == (8, True)
    assert (principal["min_stock"], principal["min_stock_is_branch"]) == (4, False)
    # Con minimo 8, Norte 10 -> 7 ya cruza.
    assert out(inv, inv.norte, 3).status_code == 201
    assert inv.alerts == [("Adhesivo", 7.0, 8.0, inv.norte)]


def test_restricted_user_only_sees_and_touches_own_branch(inv):
    inv.holder["user"] = inv.cajera  # cajera de Norte
    rows = inv.api.get("/inventory/stock-summary", params={"branch_id": inv.principal}).json()
    assert {r["branch_id"] for r in rows} == {inv.norte}  # pedir Principal se ignora
    assert out(inv, inv.principal, 1).status_code == 403
    transfer = {"product_id": inv.product, "from_branch_id": inv.principal, "to_branch_id": inv.norte, "quantity": 1}
    assert inv.api.post("/inventory/transfers", json=transfer).status_code == 403
    assert inv.api.get(f"/inventory/batches/{batch_of(inv, inv.principal).id}").status_code == 403
    assert out(inv, inv.norte, 1).status_code == 201


def test_dashboard_low_stock_is_per_product_and_branch(inv):
    low = lambda **p: inv.api.get("/dashboard/overview", params=p).json()  # noqa: E731
    sample = low()
    # Principal (3 <= 4) esta bajo aunque la suma (13) no lo estaria; Norte (10) no.
    assert _find(sample, "low_stock_items") == 1


def _find(payload, key):
    if isinstance(payload, dict):
        if key in payload:
            return payload[key]
        for value in payload.values():
            found = _find(value, key)
            if found is not None:
                return found
    return None

