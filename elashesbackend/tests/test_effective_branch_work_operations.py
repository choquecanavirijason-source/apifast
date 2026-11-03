"""Work-operation authorization, isolated from real data by tests/conftest.py."""
from datetime import date, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # register models only
from app.infrastructure.database import Base
from app.core.dependencies import enforce_own_branch, resolve_branch_id, get_db, get_current_active_user
from app.domain.entities.user import User, Role, Permission
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.service_agenda import Service, Appointment
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.inventory import Product, Batch, InventoryMovement
from app.presentation.controllers import cash_session_controller as cash
from app.presentation.controllers import pos_sale_controller as sales
from app.presentation.controllers import service_agenda_controller as agenda


@pytest.mark.parametrize("days,allowed", [(None, 1), (2, 2), (0, 2), (-1, 1)])
def test_effective_opt_in_preserves_original_default(days, allowed):
    user = User(branch_id=1, temp_branch_id=2 if days is not None else None,
                temp_branch_until=date.today() + timedelta(days=days) if days is not None else None)
    user.role = Role(name="Cajera")
    assert resolve_branch_id(None, user) == 1
    enforce_own_branch(1, user)
    enforce_own_branch(None, user)  # original behavior retained
    enforce_own_branch(allowed, user, use_effective_branch=True)
    for denied in (3 - allowed, None):
        with pytest.raises(HTTPException) as error:
            enforce_own_branch(denied, user, use_effective_branch=True)
        assert error.value.status_code == 403


@pytest.mark.parametrize("role", ["Admin", "SuperAdmin", "Secretaria"])
def test_multibranch_policy_unchanged(role):
    user = User(branch_id=1, temp_branch_id=2, temp_branch_until=date.today())
    user.role = Role(name=role)
    for branch in (None, 1, 2, 3):
        assert resolve_branch_id(branch, user) == branch
        enforce_own_branch(branch, user, use_effective_branch=True)


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    role = Role(name="Cajera")
    role.permissions = [Permission(name=name) for name in (
        "payments:view", "payments:manage", "appointments:view", "appointments:manage")]
    origin, destination = Branch(name="Probe North"), Branch(name="Probe Principal")
    db.add_all([role, origin, destination])
    db.flush()
    user = User(username="probe_cashier", email="probe@example.com", hashed_password="unused",
                role=role, branch_id=origin.id, temp_branch_id=destination.id,
                temp_branch_until=date.today() + timedelta(days=1), is_active=True)
    client = Client(name="Probe", last_name="Client", branch_id=destination.id)
    service = Service(name="Probe service", duration_minutes=60, price=50)
    db.add_all([user, client, service])
    db.commit()
    app = FastAPI()
    for router in (cash.router, sales.router, agenda.router):
        app.include_router(router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: user
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, db=db, user=user, client=client, service=service,
                              origin=origin.id, destination=destination.id)
    db.close()
    engine.dispose()


def open_box(work, branch):
    return work.api.post("/cash-sessions/open", json={"branch_id": branch, "opening_amount": 100})


def sale_payload(work, branch):
    start = datetime(2030, 1, 15, 10)
    return {"client_id": work.client.id, "branch_id": branch, "payment_method": "cash",
            "items": [{"service_id": work.service.id, "branch_id": branch,
                       "start_time": start.isoformat(), "end_time": (start + timedelta(hours=1)).isoformat()}]}


def test_destination_cash_open_read_close_and_origin_rejection(work):
    assert open_box(work, work.origin).status_code == 403
    opened = open_box(work, work.destination)
    assert opened.status_code == 201, opened.text
    box_id = opened.json()["id"]
    assert work.api.get("/cash-sessions/current", params={"branch_id": work.origin}).status_code == 403
    assert work.api.get(f"/cash-sessions/{box_id}/detail").status_code == 200
    assert {x["branch_id"] for x in work.api.get("/cash-sessions").json()} == {work.destination}
    response = work.api.post(f"/cash-sessions/{box_id}/close", json={"counted_amount": 100, "next_fund_amount": 20})
    assert response.status_code == 200, response.text
    assert response.json()["expected_cash"] == 100


def test_cash_id_is_rechecked_after_expiry(work):
    box_id = open_box(work, work.destination).json()["id"]
    work.user.temp_branch_until = date.today() - timedelta(days=1)
    work.db.commit()
    assert work.api.get(f"/cash-sessions/{box_id}/detail").status_code == 403
    assert work.api.post(f"/cash-sessions/{box_id}/close", json={"counted_amount": 100, "next_fund_amount": 0}).status_code == 403


def test_service_sale_and_agenda_edit_follow_effective_branch(work):
    assert open_box(work, work.destination).status_code == 201
    rejected = work.api.post("/pos-sales/", json=sale_payload(work, work.origin))
    assert rejected.status_code == 403
    assert work.db.query(PosSale).count() == 0
    response = work.api.post("/pos-sales/", json=sale_payload(work, work.destination))
    assert response.status_code == 201, response.text
    sale = response.json()
    assert sale["branch_id"] == work.destination
    appointment = work.db.query(Appointment).filter(Appointment.sale_id == sale["id"]).one()
    assert work.api.put(f"/agenda/appointments/{appointment.id}", json={"status": "pending"}).status_code == 200
    work.user.temp_branch_until = date.today() - timedelta(days=1)
    work.db.commit()
    assert work.api.put(f"/agenda/appointments/{appointment.id}", json={"status": "pending"}).status_code == 403
    assert work.api.patch(f"/pos-sales/{sale['id']}", json={"notes": "not allowed"}).status_code == 403


def test_agenda_creation_and_sale_reference_are_authorized(work):
    payload = sale_payload(work, work.destination)["items"][0]
    payload["client_id"] = work.client.id
    assert work.api.post("/agenda/appointments", json={**payload, "branch_id": work.origin}).status_code == 403
    created = work.api.post("/agenda/appointments", json=payload)
    assert created.status_code == 201, created.text
    foreign_sale = PosSale(sale_code="PROBE-FOREIGN", client_id=work.client.id, branch_id=work.origin)
    work.db.add(foreign_sale)
    work.db.commit()
    before = work.db.query(Appointment).count()
    assert work.api.post("/agenda/appointments", json={**payload, "sale_id": foreign_sale.id}).status_code == 403
    assert work.api.put(f"/agenda/appointments/{created.json()['id']}", json={"sale_id": foreign_sale.id}).status_code == 403
    assert work.db.query(Appointment).count() == before


def test_product_sale_uses_destination_stock_only(work):
    product = Product(sku="PROBE-ONE", name="Probe product", price=25, cost=10, min_stock=0)
    work.db.add(product)
    work.db.flush()
    origin_batch = Batch(product_id=product.id, branch_id=work.origin, initial_quantity=5,
                         current_quantity=5, cost_per_unit=10)
    destination_batch = Batch(product_id=product.id, branch_id=work.destination, initial_quantity=5,
                              current_quantity=5, cost_per_unit=10)
    work.db.add_all([origin_batch, destination_batch])
    work.db.commit()
    assert open_box(work, work.destination).status_code == 201
    payload = {"client_id": work.client.id, "branch_id": work.destination,
               "product_items": [{"product_id": product.id, "quantity": 2}]}
    response = work.api.post("/pos-sales/", json=payload)
    assert response.status_code == 201, response.text
    work.db.refresh(origin_batch)
    work.db.refresh(destination_batch)
    assert origin_batch.current_quantity == 5
    assert destination_batch.current_quantity == 3
    assert {x.branch_id for x in work.db.query(InventoryMovement).all()} == {work.destination}


@pytest.mark.parametrize("role_name", ["Admin", "SuperAdmin", "Secretaria"])
def test_multibranch_cash_operations_remain_available(work, role_name):
    work.user.role.name = role_name
    work.db.commit()
    for branch in (work.origin, work.destination):
        opened = open_box(work, branch)
        assert opened.status_code == 201, opened.text
        box_id = opened.json()["id"]
        assert work.api.get(f"/cash-sessions/{box_id}/detail").status_code == 200
        assert work.api.post(f"/cash-sessions/{box_id}/close", json={"counted_amount": 100, "next_fund_amount": 0}).status_code == 200
    assert len(work.api.get("/cash-sessions").json()) == 2


@pytest.mark.parametrize("expired", [False, True])
def test_original_branch_works_without_active_transfer(work, expired):
    work.user.temp_branch_until = date.today() - timedelta(days=1) if expired else None
    if not expired:
        work.user.temp_branch_id = None
    work.db.commit()
    assert open_box(work, work.origin).status_code == 201
    assert open_box(work, work.destination).status_code == 403


def test_sales_by_id_reject_foreign_branch_before_writes(work):
    sale = PosSale(sale_code="PROBE-ID", client_id=work.client.id, branch_id=work.origin, notes="unchanged")
    work.db.add(sale)
    work.db.commit()
    for method, suffix, body in [("get", "", None), ("patch", "", {"notes": "changed"}),
                                 ("post", "/cancel", None), ("delete", "", None),
                                 ("get", "/receipt/pdf", None)]:
        response = work.api.request(method, f"/pos-sales/{sale.id}{suffix}", json=body)
        assert response.status_code == 403, response.text
    work.db.refresh(sale)
    assert sale.notes == "unchanged" and sale.status == "paid"


def test_item_branch_cannot_override_sale_authorization(work):
    payload = sale_payload(work, work.destination)
    payload["items"][0]["branch_id"] = work.origin
    assert work.api.post("/pos-sales/", json=payload).status_code == 403
    assert work.db.query(PosSale).count() == 0


def test_client_cannot_select_legacy_policy(work):
    payload = sale_payload(work, work.origin)
    payload["use_effective_branch"] = False
    assert work.api.post("/pos-sales/", json=payload).status_code == 403


def test_permissions_still_required(work):
    work.user.role.permissions = []
    work.db.commit()
    assert open_box(work, work.destination).status_code == 403


def security_records(work):
    start = datetime(2030, 1, 16, 10)
    sales, appointments = [], []
    for branch in (work.origin, work.destination):
        sale = PosSale(sale_code=f"SECURITY-{branch}", client_id=work.client.id, branch_id=branch)
        appointment = Appointment(client_id=work.client.id, service_id=work.service.id,
                                  branch_id=branch, start_time=start, end_time=start + timedelta(hours=1))
        work.db.add_all([sale, appointment])
        sales.append(sale)
        appointments.append(appointment)
    work.db.commit()
    return sales, appointments


@pytest.mark.parametrize("assignment", ["active", "expired", "none"])
def test_sales_listing_enforces_effective_scope_with_or_without_filter(work, assignment):
    security_records(work)
    if assignment == "expired":
        work.user.temp_branch_until = date.today() - timedelta(days=1)
    elif assignment == "none":
        work.user.temp_branch_id = None
        work.user.temp_branch_until = None
    work.db.commit()
    allowed = work.user.effective_branch_id
    denied = work.origin if allowed == work.destination else work.destination
    for params in ({}, {"branch_id": allowed}):
        response = work.api.get("/pos-sales/", params=params)
        assert response.status_code == 200, response.text
        assert len(response.json()) == 1
        assert {sale["branch_id"] for sale in response.json()} == {allowed}
    assert work.api.get("/pos-sales/", params={"branch_id": denied}).status_code == 403
    assert work.db.query(PosSale).count() == 2


@pytest.mark.parametrize("assignment", ["active", "expired", "none"])
def test_delete_checks_stored_appointment_branch_before_mutation(work, assignment):
    _, appointments = security_records(work)
    if assignment == "expired":
        work.user.temp_branch_until = date.today() - timedelta(days=1)
    elif assignment == "none":
        work.user.temp_branch_id = None
        work.user.temp_branch_until = None
    work.db.commit()
    allowed = work.user.effective_branch_id
    foreign = next(a for a in appointments if a.branch_id != allowed)
    own = next(a for a in appointments if a.branch_id == allowed)
    foreign_id, own_id = foreign.id, own.id
    response = work.api.delete(f"/agenda/appointments/{foreign_id}")
    assert response.status_code == 403, response.text
    assert work.db.query(Appointment).filter_by(id=foreign_id).count() == 1
    assert work.db.query(Appointment).count() == 2
    response = work.api.delete(f"/agenda/appointments/{own_id}")
    assert response.status_code == 200, response.text
    assert work.db.query(Appointment).filter_by(id=own_id).count() == 0
    assert work.db.query(Appointment).filter_by(id=foreign_id).count() == 1


@pytest.mark.parametrize("role", ["Admin", "SuperAdmin", "Secretaria"])
def test_multibranch_listing_and_delete_keep_existing_permissions(work, role):
    _, appointments = security_records(work)
    work.user.role.name = role
    work.db.commit()
    response = work.api.get("/pos-sales/")
    assert response.status_code == 200
    assert {s["branch_id"] for s in response.json()} == {work.origin, work.destination}
    for branch in (work.origin, work.destination):
        response = work.api.get("/pos-sales/", params={"branch_id": branch})
        assert response.status_code == 200
        assert {s["branch_id"] for s in response.json()} == {branch}
    for appointment in appointments:
        assert work.api.delete(f"/agenda/appointments/{appointment.id}").status_code == 200
    assert work.db.query(Appointment).count() == 0


def test_security_routes_fail_closed_without_branch_or_permissions(work):
    _, appointments = security_records(work)
    appointment_id = appointments[0].id
    work.user.temp_branch_id = None
    work.user.branch_id = None
    work.db.commit()
    assert work.api.get("/pos-sales/").status_code == 403
    assert work.api.delete(f"/agenda/appointments/{appointment_id}").status_code == 403
    work.user.branch_id = work.origin
    work.user.role.permissions = []
    work.db.commit()
    assert work.api.get("/pos-sales/").status_code == 403
    assert work.api.delete(f"/agenda/appointments/{appointment_id}").status_code == 403
    assert work.db.query(Appointment).count() == 2
