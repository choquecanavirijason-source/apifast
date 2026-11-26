"""Combos reales de servicios: un combo agrupa servicios del catálogo (precio propio, duración = suma)
y en la venta del POS se expande en sus servicios; el servidor valida que estén todos y descuenta
la diferencia entre la suma de sus precios y el precio del combo.

Ejecutar:
  cd elashesbackend
  pytest tests/test_service_combos.py -v
"""
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # registra los modelos sin ejecutar migraciones
from app.core.dependencies import get_current_active_user, get_db
from app.domain.entities.branch import Branch
from app.domain.entities.cash_close import CashClose
from app.domain.entities.service_agenda import Service
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database import Base
from app.presentation.controllers import pos_sale_controller, service_agenda_controller
from app.presentation.schemas.client import today_la_paz


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    role = Role(name="Admin")
    role.permissions = [Permission(name=n) for n in (
        "services:manage", "services:view", "payments:view", "payments:manage",
        "appointments:view", "appointments:manage", "clients:view")]
    branch = Branch(name="Probe Norte")
    db.add_all([role, branch])
    db.flush()
    admin = User(username="admin", email="a@example.com", hashed_password="x", role=role,
                 branch_id=branch.id, is_active=True)
    lifting = Service(name="Lifting", duration_minutes=60, price=220)
    clasicas = Service(name="Clásicas", duration_minutes=120, price=280)
    cejas = Service(name="Cejas", duration_minutes=30, price=100, discount_percent=10)  # efectivo 90
    db.add_all([admin, lifting, clasicas, cejas])
    db.add(CashClose(date=today_la_paz().isoformat(), branch_id=branch.id, status="open", opening_amount=0))
    db.commit()

    app = FastAPI()
    app.include_router(service_agenda_controller.router)
    app.include_router(pos_sale_controller.router)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_active_user] = lambda: admin
    with TestClient(app) as api:
        yield SimpleNamespace(api=api, db=db, branch=branch.id, lifting=lifting.id, clasicas=clasicas.id, cejas=cejas.id)
    db.close()
    engine.dispose()


def create_combo(work, ids=None, price=450, **extra):
    body = {"name": "Lifting + Clásicas", "duration_minutes": 1, "price": price, "is_combo": True,
            "component_service_ids": ids if ids is not None else [work.lifting, work.clasicas], **extra}
    return work.api.post("/agenda/services", json=body)


def sale_items(work, ids):
    start = datetime(2030, 1, 15, 10)
    return [{"service_id": i, "branch_id": work.branch, "start_time": start.isoformat(),
             "end_time": (start + timedelta(hours=1)).isoformat()} for i in ids]


def sale(work, ids, combos, **extra):
    return work.api.post("/pos-sales/", json={
        "branch_id": work.branch, "payment_method": "cash", "cash_received": 1000,
        "items": sale_items(work, ids), "combos": combos, **extra})


# ── Catálogo ──────────────────────────────────────────────────────────────────

def test_combo_keeps_own_price_and_the_duration_you_set(work):
    res = create_combo(work, duration_minutes=150)       # más corto que la suma (180): se respeta
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["is_combo"] is True
    assert body["duration_minutes"] == 150
    assert body["price"] == 450
    assert body["component_service_ids"] == [work.lifting, work.clasicas]


def test_combo_needs_at_least_two_services(work):
    assert create_combo(work, ids=[work.lifting]).status_code == 400
    assert create_combo(work, ids=[]).status_code == 400


def test_combo_cannot_include_a_combo_or_unknown_service(work):
    combo_id = create_combo(work).json()["id"]
    nested = create_combo(work, ids=[combo_id, work.cejas], name="Otro")
    assert nested.status_code == 400 and "otra promoción" in nested.json()["detail"]
    assert create_combo(work, ids=[work.lifting, 9999], name="Fantasma").status_code == 400


def test_editing_components_keeps_the_duration_unless_you_change_it(work):
    combo_id = create_combo(work, duration_minutes=180).json()["id"]
    res = work.api.put(f"/agenda/services/{combo_id}", json={"component_service_ids": [work.lifting, work.cejas]})
    assert res.status_code == 200
    assert res.json()["component_service_ids"] == [work.lifting, work.cejas]
    res = work.api.put(f"/agenda/services/{combo_id}", json={"duration_minutes": 100})
    assert res.json()["duration_minutes"] == 100
    assert res.json()["component_service_ids"] == [work.lifting, work.cejas]


def test_changing_a_component_duration_does_not_touch_the_combo(work):
    combo_id = create_combo(work, duration_minutes=170).json()["id"]
    assert work.api.put(f"/agenda/services/{work.clasicas}", json={"duration_minutes": 90}).status_code == 200
    assert work.api.get(f"/agenda/services/{combo_id}").json()["duration_minutes"] == 170


def test_a_normal_service_is_not_a_combo(work):
    res = work.api.get(f"/agenda/services/{work.lifting}").json()
    assert res["is_combo"] is False and res["component_service_ids"] == []


# ── Venta ─────────────────────────────────────────────────────────────────────

def test_sale_discounts_the_difference_to_the_combo_price(work):
    combo_id = create_combo(work, price=450).json()["id"]     # 220 + 280 = 500 -> combo 450
    res = sale(work, [work.lifting, work.clasicas], [{"combo_id": combo_id, "quantity": 1}])
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["subtotal"] == 450 and body["total"] == 450
    assert "Promoción Lifting + Clásicas x1" in (body["notes"] or "")


def test_combo_discount_uses_the_effective_price_of_components(work):
    combo_id = create_combo(work, ids=[work.lifting, work.cejas], price=280, name="Lifting + Cejas").json()["id"]
    body = sale(work, [work.lifting, work.cejas], [{"combo_id": combo_id}]).json()
    assert body["subtotal"] == 280                          # 220 + 90 (cejas con promo) = 310 -> 280


def test_sale_with_other_services_only_discounts_the_combo(work):
    combo_id = create_combo(work, price=450).json()["id"]
    body = sale(work, [work.lifting, work.clasicas, work.cejas], [{"combo_id": combo_id}]).json()
    assert body["subtotal"] == 450 + 90


def test_two_units_of_the_same_combo(work):
    combo_id = create_combo(work, price=450).json()["id"]
    body = sale(work, [work.lifting, work.clasicas] * 2, [{"combo_id": combo_id, "quantity": 2}]).json()
    assert body["subtotal"] == 900


def test_sale_is_rejected_if_a_combo_service_was_removed(work):
    combo_id = create_combo(work).json()["id"]
    res = sale(work, [work.lifting], [{"combo_id": combo_id}])
    assert res.status_code == 400 and "necesita" in res.json()["detail"]


def test_combo_never_increases_the_price(work):
    combo_id = create_combo(work, price=900).json()["id"]    # más caro que la suma (500)
    assert sale(work, [work.lifting, work.clasicas], [{"combo_id": combo_id}]).json()["subtotal"] == 500


def test_inactive_combo_is_rejected(work):
    combo_id = create_combo(work).json()["id"]
    work.api.put(f"/agenda/services/{combo_id}", json={"is_active": False})
    assert sale(work, [work.lifting, work.clasicas], [{"combo_id": combo_id}]).status_code == 400


def test_non_combo_id_is_rejected(work):
    assert sale(work, [work.lifting], [{"combo_id": work.lifting}]).status_code == 400


# ── Comisión obligatoria en servicios normales ────────────────────────────────

def create_service(work, **extra):
    body = {"name": "Nuevo", "duration_minutes": 60, "price": 100, **extra}
    return work.api.post("/agenda/services", json=body)


def test_normal_service_requires_a_commission(work):
    res = create_service(work)
    assert res.status_code == 400 and "comisión" in res.json()["detail"]


def test_commission_is_saved_and_zero_is_valid(work):
    res = create_service(work, commission_rate=0.4)
    assert res.status_code == 201 and res.json()["commission_rate"] == 0.4
    res = create_service(work, name="Sin comisión pagada", commission_rate=0)
    assert res.status_code == 201 and res.json()["commission_rate"] == 0


def test_cannot_remove_the_commission_of_a_service(work):
    sid = create_service(work, commission_rate=0.4).json()["id"]
    res = work.api.put(f"/agenda/services/{sid}", json={"commission_rate": None})
    assert res.status_code == 400
    assert work.api.get(f"/agenda/services/{sid}").json()["commission_rate"] == 0.4


def test_editing_without_sending_commission_keeps_it(work):
    sid = create_service(work, commission_rate=0.35).json()["id"]
    assert work.api.put(f"/agenda/services/{sid}", json={"price": 150}).status_code == 200
    assert work.api.get(f"/agenda/services/{sid}").json()["commission_rate"] == 0.35
    assert work.api.put(f"/agenda/services/{sid}", json={"commission_rate": 0.5}).json()["commission_rate"] == 0.5


def test_a_promotion_does_not_need_a_commission(work):
    assert create_combo(work).status_code == 201


# ── Recalcular la venta (editar / cancelar tickets) no debe cambiar lo cobrado ──

def _paid(work, ids, combos=None, group=False):
    start = sale_items(work, [ids[0]])[0]
    items = (
        [{"service_ids": ids, "branch_id": work.branch, "start_time": start["start_time"], "end_time": start["end_time"]}]
        if group else sale_items(work, ids)
    )
    body = {"branch_id": work.branch, "payment_method": "cash", "cash_received": 2000, "items": items}
    if combos:
        body["combos"] = combos
    res = work.api.post("/pos-sales/", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def _amounts(sale):
    return sale["total"], [p["amount"] for p in sale["payments"] if p["status"] == "paid"]


def test_editing_a_promotion_sale_keeps_the_discount(work):
    combo_id = create_combo(work, price=450).json()["id"]
    sale = _paid(work, [work.lifting, work.clasicas], [{"combo_id": combo_id}])
    assert _amounts(sale) == (450, [450])
    edited = work.api.patch(f"/pos-sales/{sale['id']}", json={"notes": "una nota"}).json()
    assert _amounts(edited) == (450, [450])          # antes volvía a 500 y el pago subía solo


def test_editing_a_grouped_ticket_sale_counts_all_its_services(work):
    sale = _paid(work, [work.lifting, work.clasicas], group=True)   # un ticket con 2 servicios
    assert _amounts(sale) == (500, [500])
    edited = work.api.patch(f"/pos-sales/{sale['id']}", json={"notes": "x"}).json()
    assert _amounts(edited) == (500, [500])          # antes bajaba a 220 (solo el primero)


def test_cancelling_a_promotion_ticket_drops_only_that_promotion_discount(work):
    combo_id = create_combo(work, price=450).json()["id"]
    sale = _paid(work, [work.lifting, work.clasicas], [{"combo_id": combo_id}])
    lifting_ticket = next(a for a in sale["appointments"] if a["service_id"] == work.lifting)
    assert work.api.put(f"/agenda/appointments/{lifting_ticket['id']}", json={"status": "cancelled", "cancel_reason": "Motivo de prueba", "refund": True}).status_code == 200
    after = work.api.get(f"/pos-sales/{sale['id']}").json()
    assert _amounts(after) == (280, [280])           # queda Clásicas a precio normal: la promoción ya no está completa


def test_cancelling_an_unrelated_ticket_keeps_the_promotion(work):
    combo_id = create_combo(work, price=450).json()["id"]
    sale = _paid(work, [work.lifting, work.clasicas, work.cejas], [{"combo_id": combo_id}])
    assert sale["total"] == 540                      # 450 + cejas 90
    cejas_ticket = next(a for a in sale["appointments"] if a["service_id"] == work.cejas)
    work.api.put(f"/agenda/appointments/{cejas_ticket['id']}", json={"status": "cancelled", "cancel_reason": "Motivo de prueba", "refund": True})
    after = work.api.get(f"/pos-sales/{sale['id']}").json()
    assert _amounts(after) == (450, [450])


def test_cancelling_the_only_ticket_leaves_the_sale_at_zero(work):
    """Documenta el comportamiento actual: el cobro baja a Bs 0 (no hay devolución registrada)."""
    sale = _paid(work, [work.lifting])
    work.api.put(f"/agenda/appointments/{sale['appointments'][0]['id']}", json={"status": "cancelled", "cancel_reason": "Motivo de prueba", "refund": True})
    after = work.api.get(f"/pos-sales/{sale['id']}").json()
    assert _amounts(after) == (0, [0])


# ── "N turnos" de la operaria: las reservas lejanas no cuentan ────────────────

def test_far_reservations_do_not_count_as_a_turn_for_the_operator(work):
    from datetime import datetime, timedelta

    from app.domain.entities.client import Client
    from app.domain.entities.service_agenda import Appointment
    from app.domain.entities.user import User

    admin = work.db.query(User).first()
    client = Client(name="Cli", last_name="Prueba", branch_id=work.branch)
    work.db.add(client)
    work.db.flush()
    local_now = datetime.utcnow() - timedelta(hours=4)   # hora local de La Paz, como se guardan los tickets

    def book(start):
        work.db.add(Appointment(client_id=client.id, branch_id=work.branch, professional_id=admin.id,
                                service_id=work.lifting, start_time=start, end_time=start + timedelta(hours=1),
                                status="pending"))
        work.db.commit()

    def turns():
        rows = work.api.get("/agenda/professionals-for-select").json()
        return next(r for r in rows if r["id"] == admin.id)["active_count_today"]

    book(local_now + timedelta(hours=5))        # reserva lejana
    assert turns() == 0
    book(local_now + timedelta(minutes=10))     # reserva cercana: ya cuenta
    assert turns() == 1
    book(local_now)                             # venta directa (hora de "ahora")
    assert turns() == 2


def test_naive_clock_accepts_postgres_aware_datetimes():
    """En Postgres la hora del ticket trae zona; comparar con una hora sin zona fallaba (500 en la lista de operarias)."""
    from datetime import datetime, timedelta, timezone

    from app.presentation.controllers.service_agenda_controller import _naive_clock

    aware = datetime(2030, 1, 1, 15, 30, tzinfo=timezone.utc)
    naive = datetime(2030, 1, 1, 15, 30)
    assert _naive_clock(aware) == naive and _naive_clock(naive) == naive
    assert _naive_clock(aware) > naive - timedelta(minutes=1)      # ya se puede comparar sin error
