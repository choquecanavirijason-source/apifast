"""Cobro de una venta reservada al pasar su cita de la agenda a servicio.

  POST /pos-sales/{id}/pay:
    - registra el pago como una venta normal (fila en payments) y marca la venta pagada;
    - no se puede cobrar dos veces;
    - efectivo insuficiente no cobra nada;
    - otra sucursal y ventas no reservadas se rechazan.

Ejecutar:
  cd elashesbackend
  pytest tests/test_pay_reserved_sale.py -v
"""
from datetime import date, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # register models only
from app.infrastructure.database import Base
from app.core.dependencies import get_db, get_current_active_user
from app.domain.entities.user import User, Role, Permission
from app.domain.entities.branch import Branch
from app.domain.entities.cash_close import CashClose
from app.domain.entities.client import Client
from app.domain.entities.payment import Payment
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.service_agenda import Service
from app.presentation.controllers import pos_sale_controller as sales


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    role = Role(name="Cajera")
    role.permissions = [Permission(name=name) for name in (
        "payments:view", "payments:manage", "appointments:view", "appointments:manage")]
    own, other = Branch(name="Probe Norte"), Branch(name="Probe Principal")
    db.add_all([role, own, other])
    db.flush()
    user = User(username="probe_cashier", email="probe@example.com", hashed_password="unused",
                role=role, branch_id=own.id, is_active=True)
    client = Client(name="Probe", last_name="Client", branch_id=own.id)
    service = Service(name="Probe service", duration_minutes=60, price=50)
    db.add_all([user, client, service])
    db.add(CashClose(date=date.today().isoformat(), branch_id=own.id, status="open", opening_amount=0))
    db.commit()
    app = FastAPI()
    app.include_router(sales.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: user
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, db=db, client=client, service=service, own=own.id, other=other.id)
    db.close()
    engine.dispose()


def reserve(work) -> int:
    branch = work.own
    start = datetime(2030, 1, 15, 10)
    response = work.api.post("/pos-sales", json={
        "client_id": work.client.id, "branch_id": branch, "payment_method": "cash",
        "reservation_only": True,
        "items": [{"service_id": work.service.id, "branch_id": branch,
                   "start_time": start.isoformat(), "end_time": (start + timedelta(hours=1)).isoformat()}],
    })
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


def test_pay_registers_payment_and_marks_sale_paid(work):
    sale_id = reserve(work)
    sale = work.db.get(PosSale, sale_id)
    assert sale.status == "reserved"
    total = sale.total

    response = work.api.post(f"/pos-sales/{sale_id}/pay", json={"payment_method": "cash", "cash_received": total + 20})
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "paid"

    work.db.expire_all()
    payments = work.db.query(Payment).filter(Payment.sale_id == sale_id).all()
    assert len(payments) == 1
    assert payments[0].amount == total and payments[0].method == "cash" and payments[0].status == "paid"
    assert payments[0].cash_received == total + 20 and payments[0].cash_change == 20
    assert work.db.get(PosSale, sale_id).status == "paid"


def test_cannot_pay_twice(work):
    sale_id = reserve(work)
    assert work.api.post(f"/pos-sales/{sale_id}/pay", json={"payment_method": "card"}).status_code == 200
    again = work.api.post(f"/pos-sales/{sale_id}/pay", json={"payment_method": "card"})
    assert again.status_code == 400
    assert work.db.query(Payment).filter(Payment.sale_id == sale_id).count() == 1


def test_insufficient_cash_pays_nothing(work):
    sale_id = reserve(work)
    response = work.api.post(f"/pos-sales/{sale_id}/pay", json={"payment_method": "cash", "cash_received": 1})
    assert response.status_code == 400
    work.db.expire_all()
    assert work.db.get(PosSale, sale_id).status == "reserved"
    assert work.db.query(Payment).filter(Payment.sale_id == sale_id).count() == 0


def test_cash_requires_amount_received(work):
    sale_id = reserve(work)
    response = work.api.post(f"/pos-sales/{sale_id}/pay", json={"payment_method": "cash"})
    assert response.status_code == 400 and "monto recibido" in response.json()["detail"].lower()
    work.db.expire_all()
    assert work.db.get(PosSale, sale_id).status == "reserved"
    assert work.db.query(Payment).filter(Payment.sale_id == sale_id).count() == 0


def test_other_branch_sale_is_rejected(work):
    sale_id = reserve(work)
    work.db.get(PosSale, sale_id).branch_id = work.other  # la API no deja crear ahí: se mueve directo en la base
    work.db.commit()
    response = work.api.post(f"/pos-sales/{sale_id}/pay", json={"payment_method": "card"})
    assert response.status_code == 403
    assert work.db.query(Payment).filter(Payment.sale_id == sale_id).count() == 0


def test_cannot_pay_without_open_cash_box(work):
    sale_id = reserve(work)
    for box in work.db.query(CashClose).all():
        box.status = "closed"
    work.db.commit()
    response = work.api.post(f"/pos-sales/{sale_id}/pay", json={"payment_method": "card"})
    assert response.status_code == 400 and "caja" in response.json()["detail"].lower()
    assert work.db.query(Payment).filter(Payment.sale_id == sale_id).count() == 0


def test_cancelled_sale_cannot_be_paid(work):
    sale_id = reserve(work)
    sale = work.db.get(PosSale, sale_id)
    sale.status = "cancelled"
    work.db.commit()
    assert work.api.post(f"/pos-sales/{sale_id}/pay", json={"payment_method": "card"}).status_code == 400


def test_invalid_method_is_rejected(work):
    sale_id = reserve(work)
    assert work.api.post(f"/pos-sales/{sale_id}/pay", json={"payment_method": "bitcoin"}).status_code == 422
