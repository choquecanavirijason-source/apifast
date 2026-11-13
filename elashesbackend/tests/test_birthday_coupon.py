"""Cupón de descuento por cumpleaños.

  - lo configura el administrador (activo, %, días de vigencia); nace desactivado;
  - solo para clientas registradas con fecha de nacimiento (no la de mostrador);
  - dentro de la ventana de días alrededor del cumpleaños, incluido el cambio de año;
  - una sola vez por cumpleaños; cancelar o eliminar la venta libera el cupón;
  - el servidor calcula el descuento (no se confía en el valor de la pantalla);
  - no se combina con otro descuento ni con una reserva.

Ejecutar:
  cd elashesbackend
  pytest tests/test_birthday_coupon.py -v
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
from app.application.services import birthday_coupon_service as svc
from app.application.services.client_service import get_or_create_generic_client
from app.core.dependencies import get_current_active_user, get_db
from app.domain.entities.birthday_coupon import CouponRedemption
from app.domain.entities.branch import Branch
from app.domain.entities.cash_close import CashClose
from app.domain.entities.client import Client
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.service_agenda import Service
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database import Base
from app.presentation.controllers import coupon_controller, pos_sale_controller
from app.presentation.schemas.client import today_la_paz


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()

    cashier_role = Role(name="Cajera")
    cashier_role.permissions = [Permission(name=n) for n in (
        "payments:view", "payments:manage", "appointments:view", "appointments:manage", "clients:view")]
    admin_role = Role(name="Admin")
    branch = Branch(name="Probe Norte")
    db.add_all([cashier_role, admin_role, branch])
    db.flush()
    cashier = User(username="cajera", email="c@example.com", hashed_password="x", role=cashier_role,
                   branch_id=branch.id, is_active=True)
    admin = User(username="admin", email="a@example.com", hashed_password="x", role=admin_role,
                 branch_id=branch.id, is_active=True)
    service = Service(name="Servicio", duration_minutes=60, price=100)
    db.add_all([cashier, admin, service])
    db.add(CashClose(date=today_la_paz().isoformat(), branch_id=branch.id, status="open", opening_amount=0))
    db.commit()

    holder = SimpleNamespace(user=cashier)
    app = FastAPI()
    app.include_router(pos_sale_controller.router)
    app.include_router(coupon_controller.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: holder.user
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, db=db, holder=holder, cashier=cashier, admin=admin,
                              service=service, branch=branch.id)
    db.close()
    engine.dispose()


def as_admin(work):
    work.holder.user = work.admin


def as_cashier(work):
    work.holder.user = work.cashier


def configure(work, enabled=True, percent=20, window_days=0):
    as_admin(work)
    response = work.api.put("/coupons/birthday/config", json={"enabled": enabled, "percent": percent, "window_days": window_days})
    assert response.status_code == 200, response.text
    as_cashier(work)


def birthday_client(work, days_from_today=0, name="Cumple"):
    """Clienta cuyo cumpleaños cae `days_from_today` días desde hoy (negativo = ya pasó)."""
    target = today_la_paz() + timedelta(days=days_from_today)
    birth = date(target.year - 30, target.month, target.day)
    client = Client(name=name, last_name="Prueba", branch_id=work.branch, birth_date=birth)
    work.db.add(client)
    work.db.commit()
    return client


def sale_body(work, client_id, **extra):
    start = datetime(2030, 1, 15, 10)
    return {
        "client_id": client_id, "branch_id": work.branch, "payment_method": "cash", "cash_received": 500,
        "items": [{"service_id": work.service.id, "branch_id": work.branch,
                   "start_time": start.isoformat(), "end_time": (start + timedelta(hours=1)).isoformat()}],
        **extra,
    }


# ── Configuración (administrador) ──────────────────────────────────────────────────

def test_config_is_disabled_by_default(work):
    as_admin(work)
    response = work.api.get("/coupons/birthday/config")
    assert response.status_code == 200
    assert response.json() == {"enabled": False, "percent": 0.0, "window_days": 0}


def test_admin_can_configure_and_it_persists(work):
    configure(work, enabled=True, percent=25, window_days=7)
    as_admin(work)
    assert work.api.get("/coupons/birthday/config").json() == {"enabled": True, "percent": 25.0, "window_days": 7}


def test_cashier_cannot_read_or_change_the_config(work):
    as_cashier(work)
    assert work.api.get("/coupons/birthday/config").status_code == 403
    body = {"enabled": True, "percent": 50, "window_days": 0}
    assert work.api.put("/coupons/birthday/config", json=body).status_code == 403
    assert work.api.get("/coupons/birthday/redemptions").status_code == 403


@pytest.mark.parametrize("body", [
    {"enabled": True, "percent": 0, "window_days": 0},      # activo sin descuento
    {"enabled": True, "percent": 101, "window_days": 0},    # más de 100 %
    {"enabled": False, "percent": -5, "window_days": 0},    # negativo
    {"enabled": True, "percent": 10, "window_days": 31},    # ventana demasiado larga
    {"enabled": True, "percent": 10, "window_days": -1},
])
def test_invalid_config_is_rejected(work, body):
    as_admin(work)
    assert work.api.put("/coupons/birthday/config", json=body).status_code == 422


# ── Elegibilidad ───────────────────────────────────────────────────────────────────

def test_not_offered_when_disabled(work):
    client = birthday_client(work)
    result = svc.check_eligibility(work.db, client.id)
    assert result["eligible"] is False and result["reason"] == "disabled"


def test_offered_on_the_birthday(work):
    configure(work, percent=20, window_days=0)
    client = birthday_client(work, days_from_today=0)
    result = svc.check_eligibility(work.db, client.id)
    assert result["eligible"] is True and result["percent"] == 20


@pytest.mark.parametrize("offset,window,expected", [
    (0, 0, True), (1, 0, False), (-1, 0, False),     # solo el día
    (3, 7, True), (-5, 7, True), (7, 7, True),      # dentro de la semana
    (8, 7, False), (-8, 7, False),                  # justo fuera
])
def test_window_days_around_the_birthday(work, offset, window, expected):
    configure(work, window_days=window)
    client = birthday_client(work, days_from_today=offset)
    assert svc.check_eligibility(work.db, client.id)["eligible"] is expected


def test_window_crosses_the_new_year(work):
    configure(work, window_days=7)
    client = Client(name="Enero", last_name="Prueba", branch_id=work.branch, birth_date=date(1990, 1, 2))
    work.db.add(client)
    work.db.commit()
    # 30 de diciembre: el cumpleaños del 2 de enero está a 3 días (del año siguiente)
    assert svc.check_eligibility(work.db, client.id, today=date(2026, 12, 30))["eligible"] is True
    # 3 de enero: el cumpleaños del 2 de enero ya pasó hace 1 día
    assert svc.check_eligibility(work.db, client.id, today=date(2026, 1, 3))["eligible"] is True
    assert svc.check_eligibility(work.db, client.id, today=date(2026, 3, 1))["eligible"] is False


def test_leap_day_birthday_is_celebrated_on_feb_28_in_normal_years(work):
    configure(work, window_days=0)
    client = Client(name="Bisiesta", last_name="Prueba", branch_id=work.branch, birth_date=date(2000, 2, 29))
    work.db.add(client)
    work.db.commit()
    assert svc.check_eligibility(work.db, client.id, today=date(2026, 2, 28))["eligible"] is True   # 2026 no es bisiesto
    assert svc.check_eligibility(work.db, client.id, today=date(2028, 2, 29))["eligible"] is True   # 2028 sí
    assert svc.check_eligibility(work.db, client.id, today=date(2026, 3, 1))["eligible"] is False


def test_not_offered_without_birth_date_or_for_counter_client_or_no_client(work):
    configure(work)
    no_date = Client(name="Sin", last_name="Fecha", branch_id=work.branch)
    work.db.add(no_date)
    work.db.commit()
    assert svc.check_eligibility(work.db, no_date.id)["reason"] == "no_birth_date"
    generic = get_or_create_generic_client(db=work.db, branch_id=work.branch)
    assert svc.check_eligibility(work.db, generic.id)["reason"] == "generic"
    assert svc.check_eligibility(work.db, None)["reason"] == "no_client"
    assert svc.check_eligibility(work.db, 9999)["reason"] == "no_client"


def test_eligibility_endpoint_for_the_cashier(work):
    configure(work, percent=15)
    client = birthday_client(work)
    as_cashier(work)
    body = work.api.get("/coupons/birthday/eligibility", params={"client_id": client.id}).json()
    assert body["eligible"] is True and body["percent"] == 15 and body["reason"] is None


# ── Canje en la venta ──────────────────────────────────────────────────────────────

def test_sale_with_coupon_applies_the_server_discount_and_records_the_use(work):
    configure(work, percent=20)
    client = birthday_client(work)
    # la pantalla manda discount_value 0: el servidor fija el 20 %
    response = work.api.post("/pos-sales/", json=sale_body(work, client.id, apply_birthday_coupon=True))
    assert response.status_code == 201, response.text
    sale = response.json()
    assert sale["discount_type"] == "percent" and sale["discount_value"] == 20
    assert sale["subtotal"] == 100 and sale["total"] == 80
    assert sale["coupon_label"] == "Cupón de cumpleaños"
    rows = work.db.query(CouponRedemption).all()
    assert len(rows) == 1
    assert rows[0].client_id == client.id and rows[0].sale_id == sale["id"]
    assert rows[0].percent == 20 and rows[0].discount_amount == 20 and rows[0].applied_by_id == work.cashier.id
    assert rows[0].cycle_year == today_la_paz().year


def test_sale_without_the_flag_has_no_coupon(work):
    configure(work, percent=20)
    client = birthday_client(work)
    sale = work.api.post("/pos-sales/", json=sale_body(work, client.id)).json()
    assert sale["total"] == 100 and sale["coupon_label"] is None
    assert work.db.query(CouponRedemption).count() == 0


def test_the_coupon_can_only_be_used_once_per_birthday(work):
    configure(work, percent=20)
    client = birthday_client(work)
    assert work.api.post("/pos-sales/", json=sale_body(work, client.id, apply_birthday_coupon=True)).status_code == 201
    sales_before = work.db.query(PosSale).count()
    second = work.api.post("/pos-sales/", json=sale_body(work, client.id, apply_birthday_coupon=True))
    assert second.status_code == 400 and "ya usó" in second.json()["detail"]
    assert work.db.query(PosSale).count() == sales_before          # no se creó la venta
    assert work.db.query(CouponRedemption).count() == 1
    # y la eligibilidad lo dice
    assert svc.check_eligibility(work.db, client.id)["reason"] == "already_used"


def test_next_birthday_allows_the_coupon_again(work):
    configure(work, window_days=0)
    client = birthday_client(work)
    work.db.add(CouponRedemption(client_id=client.id, cycle_year=today_la_paz().year - 1, percent=20, discount_amount=10))
    work.db.commit()   # lo usó el año pasado
    assert svc.check_eligibility(work.db, client.id)["eligible"] is True


def test_coupon_is_rejected_outside_the_birthday_window_or_without_birth_date(work):
    configure(work, window_days=3)
    far = birthday_client(work, days_from_today=60, name="Lejos")
    response = work.api.post("/pos-sales/", json=sale_body(work, far.id, apply_birthday_coupon=True))
    assert response.status_code == 400 and "cumpleaños" in response.json()["detail"]
    assert work.db.query(PosSale).count() == 0


def test_coupon_is_rejected_for_the_counter_client(work):
    configure(work)
    generic = get_or_create_generic_client(db=work.db, branch_id=work.branch)
    response = work.api.post("/pos-sales/", json=sale_body(work, generic.id, apply_birthday_coupon=True))
    assert response.status_code == 400 and "mostrador" in response.json()["detail"]


def test_coupon_without_a_client_is_rejected(work):
    configure(work)
    body = sale_body(work, None, apply_birthday_coupon=True)
    body.pop("client_id")
    response = work.api.post("/pos-sales/", json=body)
    assert response.status_code == 400   # sin clienta se usa mostrador, que no recibe cupón


def test_coupon_does_not_combine_with_another_discount(work):
    configure(work, percent=20)
    client = birthday_client(work)
    response = work.api.post("/pos-sales/", json=sale_body(
        work, client.id, apply_birthday_coupon=True, discount_type="amount", discount_value=10))
    assert response.status_code == 400 and "no se combina" in response.json()["detail"]
    assert work.db.query(PosSale).count() == 0


def test_coupon_cannot_be_used_on_a_reservation(work):
    configure(work)
    client = birthday_client(work)
    response = work.api.post("/pos-sales/", json=sale_body(
        work, client.id, apply_birthday_coupon=True, reservation_only=True))
    assert response.status_code == 400


def test_disabled_coupon_cannot_be_applied(work):
    client = birthday_client(work)   # sin configurar: desactivado
    response = work.api.post("/pos-sales/", json=sale_body(work, client.id, apply_birthday_coupon=True))
    assert response.status_code == 400 and "no está activo" in response.json()["detail"]


def test_a_hundred_percent_coupon_makes_a_free_sale(work):
    configure(work, percent=100)
    client = birthday_client(work)
    response = work.api.post("/pos-sales/", json=sale_body(work, client.id, apply_birthday_coupon=True))
    assert response.status_code == 201, response.text
    assert response.json()["total"] == 0


# ── Liberar el cupón ───────────────────────────────────────────────────────────────

def test_cancelling_the_sale_frees_the_coupon(work):
    configure(work, percent=20)
    client = birthday_client(work)
    sale = work.api.post("/pos-sales/", json=sale_body(work, client.id, apply_birthday_coupon=True)).json()
    assert svc.check_eligibility(work.db, client.id)["reason"] == "already_used"
    cancelled = work.api.post(f"/pos-sales/{sale['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["coupon_label"] is None      # la respuesta ya no muestra el cupón
    work.db.expire_all()
    assert work.db.query(CouponRedemption).count() == 0
    assert svc.check_eligibility(work.db, client.id)["eligible"] is True
    # y se puede volver a usar
    assert work.api.post("/pos-sales/", json=sale_body(work, client.id, apply_birthday_coupon=True)).status_code == 201


def test_deleting_the_sale_frees_the_coupon(work):
    configure(work, percent=20)
    client = birthday_client(work)
    sale = work.api.post("/pos-sales/", json=sale_body(work, client.id, apply_birthday_coupon=True)).json()
    assert work.api.delete(f"/pos-sales/{sale['id']}").status_code == 204
    work.db.expire_all()
    assert work.db.query(CouponRedemption).count() == 0


# ── Registro de usos (administrador) ───────────────────────────────────────────────

def test_admin_sees_the_recent_uses(work):
    configure(work, percent=20)
    client = birthday_client(work, name="Laura")
    sale = work.api.post("/pos-sales/", json=sale_body(work, client.id, apply_birthday_coupon=True)).json()
    as_admin(work)
    items = work.api.get("/coupons/birthday/redemptions").json()["items"]
    assert len(items) == 1
    assert items[0]["client_name"] == "Laura Prueba" and items[0]["sale_code"] == sale["sale_code"]
    assert items[0]["percent"] == 20 and items[0]["discount_amount"] == 20 and items[0]["applied_by"] == "cajera"
