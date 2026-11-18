"""
Pago de comisiones por ticket (Comisiones por operaria > Historial de tickets):
  - POST /agenda/appointments/commission-payments (permiso commissions:pay):
    lote todo o nada, ya pagado, sin comisión, sin operaria, otra sucursal;
  - POST /agenda/appointments/{id}/commission-payment/void (commissions:void):
    confirmación, descuento del pago agregado, auditoría;
  - el listado devuelve los campos y borrar el pago agregado desmarca tickets;
  - el bloqueo de filas no mezcla FOR UPDATE con JOIN en PostgreSQL.

Ejecutar:
  cd elashesbackend
  pytest tests/test_commission_paid.py -v
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.application.services.commission_payout_service import appointment_commission, pay_commissions
from app.core.dependencies import get_db
from app.domain.entities.audit_log import AuditLog
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.commission_payment import CommissionPayment
from app.domain.entities.service_agenda import Appointment, AppointmentService, Service, ServiceCategory
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database.base_class import Base
from app.infrastructure.security import get_password_hash

engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

PAY_URL = "/agenda/appointments/commission-payments"


def void_url(appointment_id: int) -> str:
    return f"/agenda/appointments/{appointment_id}/commission-payment/void"


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db() -> Session:
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db: Session) -> TestClient:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Datos ────────────────────────────────────────────────────────────────────

def _user(db, username, role, branch, *, commission_rate=0.40) -> User:
    user = User(username=username, email=f"{username}@test.com", hashed_password=get_password_hash("test1234"),
                is_active=True, role_id=role.id, branch_id=branch.id, commission_rate=commission_rate)
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def seed(db: Session) -> dict:
    perms = {n: Permission(name=n) for n in
             ("appointments:view", "commissions:pay", "commissions:void", "payments:manage")}
    db.add_all(perms.values())
    db.flush()
    admin, secretaria, cajera, operaria = (Role(name=n) for n in ("Admin", "Secretaria", "Cajera", "Operaria"))
    db.add_all([admin, secretaria, cajera, operaria])
    db.flush()
    admin.permissions = list(perms.values())
    secretaria.permissions = [perms["appointments:view"]]  # sin commissions:pay
    # Rol acotado a su sucursal, con permiso de pagar pero no de anular.
    cajera.permissions = [perms["appointments:view"], perms["commissions:pay"]]

    centro = Branch(name="Centro", address="Calle 1", city="LPZ", department="LP")
    norte = Branch(name="Norte", address="Calle 2", city="LPZ", department="LP")
    db.add_all([centro, norte])
    db.flush()
    _user(db, "admin_c", admin, centro)
    _user(db, "secretaria_c", secretaria, centro)
    _user(db, "cajera_c", cajera, centro)
    luna = _user(db, "luna", operaria, centro, commission_rate=0.40)
    sofia = _user(db, "sofia", operaria, norte, commission_rate=0.30)

    category = ServiceCategory(name="Pestañas", is_mobile=False)
    db.add(category)
    db.flush()
    clasica = Service(name="Clásica", duration_minutes=60, price=100.0, category_id=category.id,
                      commission_rate=0.50)
    retoque = Service(name="Retoque", duration_minutes=30, price=50.0, category_id=category.id,
                      commission_rate=None)  # usa la tasa de la operaria
    gratis = Service(name="Cortesía", duration_minutes=15, price=0.0, category_id=category.id)
    ana = Client(name="Ana", last_name="Lopez", branch_id=centro.id)
    db.add_all([clasica, retoque, gratis, ana])
    db.commit()
    return {"centro": centro, "norte": norte, "luna": luna, "sofia": sofia, "clasica": clasica,
            "retoque": retoque, "gratis": gratis, "ana": ana}


def add_ticket(db, seed, *, professional="luna", branch="centro", status="completed",
               services=("clasica",), days_ago=1) -> Appointment:
    start = datetime(2026, 10, 10, 10, 0) - timedelta(days=days_ago)
    appt = Appointment(
        client_id=seed["ana"].id,
        professional_id=seed[professional].id if professional else None,
        branch_id=seed[branch].id,
        service_id=seed[services[0]].id,
        start_time=start, end_time=start + timedelta(hours=1), status=status,
    )
    db.add(appt)
    db.flush()
    for order, key in enumerate(services):
        db.add(AppointmentService(appointment_id=appt.id, service_id=seed[key].id, sort_order=order))
    db.commit()
    return appt


def login(client: TestClient, username: str) -> dict:
    resp = client.post("/auth/login", json={"username": username, "password": "test1234"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def pay(client, headers, ids):
    return client.post(PAY_URL, json={"appointment_ids": ids}, headers=headers)


def nothing_saved(db) -> bool:
    db.expire_all()
    return (
        db.query(Appointment).filter(Appointment.pagado.is_(True)).count() == 0
        and db.query(CommissionPayment).count() == 0
        and db.query(AuditLog).filter(AuditLog.entity_type == "commission_payment").count() == 0
    )


# ── Regla de comisión ────────────────────────────────────────────────────────

class TestComision:
    def test_tasa_del_servicio_o_de_la_operaria(self, db, seed):
        # Clásica 100 x 0.50 (servicio) + Retoque 50 x 0.40 (operaria luna)
        appt = add_ticket(db, seed, services=("clasica", "retoque"))
        assert appointment_commission(appt) == 70.0
        # sofia tiene 0.30: Retoque 50 x 0.30
        assert appointment_commission(add_ticket(db, seed, professional="sofia", branch="norte",
                                                 services=("retoque",))) == 15.0

    def test_no_completado_es_cero(self, db, seed):
        assert appointment_commission(add_ticket(db, seed, status="pending")) == 0.0

    def test_cierre_de_caja_coincide_con_el_pago_y_no_cuenta_reservas_confirmadas(self, client, db, seed):
        # 2026-10-09: completado (Clásica 50 + Retoque 20 = 70), confirmado sin atender y cancelado.
        done = add_ticket(db, seed, services=("clasica", "retoque"))
        add_ticket(db, seed, status="confirmed", services=("clasica",))
        add_ticket(db, seed, status="cancelled", services=("clasica",))
        headers = login(client, "admin_c")
        report = client.get("/reports/daily-closing", params={"date": "2026-10-09"}, headers=headers).json()

        assert report["grand_commission"] == 70.0                      # solo el completado
        assert report["grand_total"] == 150.0                          # 100 + 50 del completado
        by_status = {i["status"]: i["commission"] for i in report["items"]}
        assert by_status == {"completed": 70.0, "confirmed": 0.0, "cancelled": 0.0}
        assert [p["commission"] for p in report["summary_by_professional"]] == [70.0]
        assert report["summary_by_professional"][0]["ticket_count"] == 1

        # y es exactamente lo que se registra al pagar ese ticket
        paid = pay(client, headers, [done.id]).json()
        assert paid["total"] == report["grand_commission"]


# ── Lote ─────────────────────────────────────────────────────────────────────

class TestLote:
    def test_lote_correcto(self, client, db, seed):
        t1 = add_ticket(db, seed, services=("clasica",))                     # 50
        t2 = add_ticket(db, seed, services=("retoque",), days_ago=3)         # 20
        t3 = add_ticket(db, seed, professional="sofia", branch="norte",
                        services=("clasica",))                               # 50
        resp = pay(client, login(client, "admin_c"), [t1.id, t2.id, t3.id])
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["tickets"] == 3 and body["operarias"] == 2 and body["total"] == 120.0
        assert body["pagado_por_nombre"] == "admin_c"
        assert {p["id"] for p in body["pagados"]} == {t1.id, t2.id, t3.id}
        assert body["pagados"][0]["pagado_en"].endswith("+00:00")

        db.expire_all()
        admin = db.query(User).filter(User.username == "admin_c").one()
        for t, amount in ((t1, 50.0), (t2, 20.0), (t3, 50.0)):
            db.refresh(t)
            assert t.pagado and t.pagado_por == admin.id and t.pagado_en is not None
            assert t.pagado_monto == amount and t.commission_payment_id is not None

        # Un pago por operaria en "Comisiones y pagos", con su período.
        payments = {p.professional_id: p for p in db.query(CommissionPayment).all()}
        assert payments[seed["luna"].id].amount == 70.0
        assert payments[seed["luna"].id].period_start == "2026-10-07"
        assert payments[seed["luna"].id].period_end == "2026-10-09"
        assert payments[seed["sofia"].id].amount == 50.0
        assert payments[seed["luna"].id].registered_by_id == admin.id

        logs = db.query(AuditLog).filter(AuditLog.action == "pay").all()
        assert len(logs) == 2 and all(log.entity_type == "commission_payment" for log in logs)
        assert any("luna" in log.description and "Bs 70.00" in log.description for log in logs)

    def test_un_ticket_invalido_no_guarda_nada(self, client, db, seed):
        ok = add_ticket(db, seed)
        pendiente = add_ticket(db, seed, status="pending")
        resp = pay(client, login(client, "admin_c"), [ok.id, pendiente.id])
        assert resp.status_code == 409
        errores = resp.json()["detail"]["errores"]
        assert errores == [{"id": pendiente.id, "motivo": "El ticket no está completado."}]
        assert nothing_saved(db)

    def test_ticket_inexistente(self, client, db, seed):
        ok = add_ticket(db, seed)
        resp = pay(client, login(client, "admin_c"), [ok.id, 99999])
        assert resp.status_code == 409
        assert resp.json()["detail"]["errores"][0]["id"] == 99999
        assert nothing_saved(db)

    def test_ya_pagado(self, client, db, seed):
        t = add_ticket(db, seed)
        h = login(client, "admin_c")
        assert pay(client, h, [t.id]).status_code == 200
        resp = pay(client, h, [t.id])
        assert resp.status_code == 409
        assert resp.json()["detail"]["errores"][0]["motivo"] == "La comisión ya estaba pagada."
        assert db.query(CommissionPayment).count() == 1  # el segundo intento no creó otro

    def test_sin_comision(self, client, db, seed):
        t = add_ticket(db, seed, services=("gratis",))
        resp = pay(client, login(client, "admin_c"), [t.id])
        assert resp.status_code == 409
        assert resp.json()["detail"]["errores"][0]["motivo"] == "El ticket no tiene comisión."
        assert nothing_saved(db)

    def test_sin_operaria(self, client, db, seed):
        t = add_ticket(db, seed, professional=None)
        assert pay(client, login(client, "admin_c"), [t.id]).status_code == 409
        assert nothing_saved(db)

    def test_permiso_denegado(self, client, db, seed):
        t = add_ticket(db, seed)
        resp = pay(client, login(client, "secretaria_c"), [t.id])
        assert resp.status_code == 403
        assert "commissions:pay" in resp.json()["detail"]
        assert nothing_saved(db)

    def test_sin_sesion_401(self, client, db, seed):
        assert pay(client, {}, [add_ticket(db, seed).id]).status_code == 401

    def test_otra_sucursal(self, client, db, seed):
        propio = add_ticket(db, seed)
        ajeno = add_ticket(db, seed, professional="sofia", branch="norte")
        h = login(client, "cajera_c")  # acotada a Centro
        resp = pay(client, h, [propio.id, ajeno.id])
        assert resp.status_code == 403
        assert resp.json()["detail"]["errores"] == [{"id": ajeno.id, "motivo": "El ticket es de otra sucursal."}]
        assert nothing_saved(db)
        assert pay(client, h, [propio.id]).status_code == 200

    @pytest.mark.parametrize("ids", [[], list(range(1, 502))])
    def test_lote_vacio_o_demasiado_grande_422(self, client, seed, ids):
        assert pay(client, login(client, "admin_c"), ids).status_code == 422


# ── Anulación ────────────────────────────────────────────────────────────────

class TestAnulacion:
    def _pay(self, client, db, seed, *tickets):
        assert pay(client, login(client, "admin_c"), [t.id for t in tickets]).status_code == 200

    def test_exige_confirmar(self, client, db, seed):
        t = add_ticket(db, seed)
        self._pay(client, db, seed, t)
        resp = client.post(void_url(t.id), json={"confirmar": False}, headers=login(client, "admin_c"))
        assert resp.status_code == 400
        db.refresh(t)
        assert t.pagado

    def test_anula_descuenta_y_audita(self, client, db, seed):
        t1, t2 = add_ticket(db, seed), add_ticket(db, seed, services=("retoque",))  # 50 + 20
        self._pay(client, db, seed, t1, t2)
        payment_id = db.query(CommissionPayment).one().id

        resp = client.post(void_url(t1.id), json={"confirmar": True, "motivo": "Se pagó dos veces"},
                           headers=login(client, "admin_c"))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["pagado"] is False and body["pagado_en"] is None and body["pagado_por"] is None

        db.expire_all()
        assert db.query(CommissionPayment).one().amount == 20.0
        [log] = db.query(AuditLog).filter(AuditLog.action == "void").all()
        assert log.entity_type == "commission_payment" and log.entity_id == payment_id
        assert "Se pagó dos veces" in log.description and "Bs 50.00" in log.description

    def test_anular_el_ultimo_borra_el_pago_agregado(self, client, db, seed):
        t = add_ticket(db, seed)
        self._pay(client, db, seed, t)
        client.post(void_url(t.id), json={"confirmar": True}, headers=login(client, "admin_c"))
        db.expire_all()
        assert db.query(CommissionPayment).count() == 0

    def test_se_puede_volver_a_pagar(self, client, db, seed):
        t = add_ticket(db, seed)
        self._pay(client, db, seed, t)
        h = login(client, "admin_c")
        client.post(void_url(t.id), json={"confirmar": True}, headers=h)
        assert pay(client, h, [t.id]).status_code == 200

    def test_no_pagado_409(self, client, db, seed):
        t = add_ticket(db, seed)
        resp = client.post(void_url(t.id), json={"confirmar": True}, headers=login(client, "admin_c"))
        assert resp.status_code == 409

    def test_inexistente_404(self, client, seed):
        resp = client.post(void_url(99999), json={"confirmar": True}, headers=login(client, "admin_c"))
        assert resp.status_code == 404

    def test_permiso_de_anular_aparte(self, client, db, seed):
        t = add_ticket(db, seed)
        self._pay(client, db, seed, t)
        # cajera_c puede pagar pero no anular
        resp = client.post(void_url(t.id), json={"confirmar": True}, headers=login(client, "cajera_c"))
        assert resp.status_code == 403
        assert "commissions:void" in resp.json()["detail"]


# ── Listado y "Comisiones y pagos" ───────────────────────────────────────────

class TestListadoYPagoAgregado:
    def test_el_listado_devuelve_los_campos(self, client, db, seed):
        pagado, pendiente = add_ticket(db, seed), add_ticket(db, seed)
        h = login(client, "admin_c")
        pay(client, h, [pagado.id])
        resp = client.get("/agenda/appointments", params={"limit": 50}, headers=h)
        assert resp.status_code == 200, resp.text
        rows = {r["id"]: r for r in resp.json()}
        assert rows[pagado.id]["pagado"] is True
        assert rows[pagado.id]["pagado_en"].endswith("+00:00")
        assert rows[pagado.id]["pagado_monto"] == 50.0
        assert rows[pagado.id]["pagador"]["username"] == "admin_c"
        # cada ticket pagado dice en qué pago entró (para agrupar el detalle por pagos)
        payment_id = db.query(CommissionPayment).one().id
        assert rows[pagado.id]["commission_payment_id"] == payment_id
        assert rows[pendiente.id]["commission_payment_id"] is None
        assert rows[pendiente.id]["pagado"] is False and rows[pendiente.id]["pagador"] is None

    def test_borrar_el_pago_agregado_desmarca_sus_tickets(self, client, db, seed):
        t = add_ticket(db, seed)
        h = login(client, "admin_c")
        pay(client, h, [t.id])
        payment_id = db.query(CommissionPayment).one().id
        assert client.delete(f"/commission-payments/{payment_id}", headers=h).status_code == 204
        db.expire_all()
        db.refresh(t)
        assert t.pagado is False and t.commission_payment_id is None


# ── Bloqueo en PostgreSQL ────────────────────────────────────────────────────

def test_bloqueo_sin_join_en_postgres(db, seed):
    """SQLite ignora FOR UPDATE: se compilan los SELECT con el dialecto de
    PostgreSQL, que rechaza FOR UPDATE sobre un LEFT OUTER JOIN."""
    t = add_ticket(db, seed)
    admin = db.query(User).filter(User.username == "admin_c").one()
    captured: list[str] = []

    def on_execute(state):
        if state.is_select:
            captured.append(str(state.statement.compile(dialect=postgresql.dialect())))

    event.listen(db, "do_orm_execute", on_execute)
    try:
        pay_commissions(db, [t.id], admin)
    finally:
        event.remove(db, "do_orm_execute", on_execute)
    locking = [sql for sql in captured if "FOR UPDATE" in sql]
    assert locking and all("JOIN" not in sql.upper() for sql in locking), locking


# ── Listado de tickets: orden y filtros del Historial ───────────────────────

class TestListadoDeTickets:
    def _ids(self, client, headers, **params):
        resp = client.get("/agenda/appointments", params={"limit": 100, **params}, headers=headers)
        assert resp.status_code == 200, resp.text
        return [r["id"] for r in resp.json()]

    def test_lo_mas_reciente_va_primero(self, client, db, seed):
        viejo = add_ticket(db, seed, days_ago=10)
        medio = add_ticket(db, seed, days_ago=5)
        nuevo = add_ticket(db, seed, days_ago=1)
        ids = self._ids(client, login(client, "admin_c"))
        assert ids == [nuevo.id, medio.id, viejo.id]

    def test_filtro_de_fechas_incluye_el_dia_final_completo(self, client, db, seed):
        h = login(client, "admin_c")
        dia9 = add_ticket(db, seed, days_ago=1)                                  # 2026-10-09 10:00
        dia8 = add_ticket(db, seed, days_ago=2)                                  # 2026-10-08 10:00
        tarde = add_ticket(db, seed, days_ago=3)                                 # 2026-10-07 10:00
        tarde.start_time = datetime(2026, 10, 8, 23, 30)                         # último minuto del 8
        db.commit()

        assert set(self._ids(client, h, start_date="2026-10-08", end_date="2026-10-08")) == {dia8.id, tarde.id}
        assert set(self._ids(client, h, start_date="2026-10-09", end_date="2026-10-09")) == {dia9.id}
        assert set(self._ids(client, h, start_date="2026-10-08")) == {dia8.id, tarde.id, dia9.id}
        assert set(self._ids(client, h, end_date="2026-10-08")) == {dia8.id, tarde.id}

    def test_rango_invertido_no_devuelve_nada(self, client, db, seed):
        add_ticket(db, seed, days_ago=1)
        assert self._ids(client, login(client, "admin_c"), start_date="2026-10-10", end_date="2026-10-01") == []

    def test_filtro_por_operaria_y_sucursal(self, client, db, seed):
        h = login(client, "admin_c")
        de_luna = add_ticket(db, seed, professional="luna", branch="centro")
        de_sofia = add_ticket(db, seed, professional="sofia", branch="norte")
        assert self._ids(client, h, professional_id=seed["luna"].id) == [de_luna.id]
        assert self._ids(client, h, branch_id=seed["norte"].id) == [de_sofia.id]


# ── Efectivo de la caja: pagar una comisión del cajón baja el efectivo esperado ──

class TestEfectivoDeCaja:
    def _abrir_caja(self, db, seed, opening=100.0):
        from app.domain.entities.cash_close import CashClose
        session = CashClose(date="2026-10-01", branch_id=seed["centro"].id, status="open",
                            opened_at=datetime(2020, 1, 1), opening_amount=opening)
        db.add(session)
        db.commit()
        return session

    def _esperado(self, client, headers, session_id):
        detail = client.get(f"/cash-sessions/{session_id}/detail", headers=headers).json()
        return detail["expected_cash"], detail["cash_commissions"]

    def test_pagar_del_efectivo_descuenta_del_esperado(self, client, db, seed):
        caja = self._abrir_caja(db, seed)
        ticket = add_ticket(db, seed, services=("clasica",))                     # comisión 50
        h = login(client, "admin_c")
        assert self._esperado(client, h, caja.id) == (100.0, 0.0)

        resp = client.post(PAY_URL, json={"appointment_ids": [ticket.id], "from_cash": True}, headers=h)
        assert resp.status_code == 200, resp.text
        assert self._esperado(client, h, caja.id) == (50.0, 50.0)                 # 100 - 50 en efectivo

    def test_pagar_sin_efectivo_no_toca_el_arqueo(self, client, db, seed):
        caja = self._abrir_caja(db, seed)
        ticket = add_ticket(db, seed, services=("clasica",))
        h = login(client, "admin_c")
        assert pay(client, h, [ticket.id]).status_code == 200                    # from_cash por defecto: no
        assert self._esperado(client, h, caja.id) == (100.0, 0.0)

    def test_anular_el_pago_devuelve_el_efectivo(self, client, db, seed):
        caja = self._abrir_caja(db, seed)
        ticket = add_ticket(db, seed, services=("clasica",))
        h = login(client, "admin_c")
        client.post(PAY_URL, json={"appointment_ids": [ticket.id], "from_cash": True}, headers=h)
        assert client.post(void_url(ticket.id), json={"confirmar": True}, headers=h).status_code == 200
        assert self._esperado(client, h, caja.id) == (100.0, 0.0)

    def test_el_cierre_guarda_las_comisiones_en_efectivo(self, client, db, seed):
        caja = self._abrir_caja(db, seed)
        ticket = add_ticket(db, seed, services=("clasica",))
        h = login(client, "admin_c")
        client.post(PAY_URL, json={"appointment_ids": [ticket.id], "from_cash": True}, headers=h)
        closed = client.post(f"/cash-sessions/{caja.id}/close",
                             json={"counted_amount": 50.0, "next_fund_amount": 0.0}, headers=h)
        assert closed.status_code == 200, closed.text
        body = closed.json()
        assert body["cash_commissions"] == 50.0
        assert body["expected_cash"] == 50.0 and body["difference"] == 0.0


# ── Extras y bonos del efectivo de la caja ──────────────────────────────────────

class TestExtrasEnEfectivo:
    def _caja(self, db, seed, opening=200.0):
        from app.domain.entities.cash_close import CashClose
        session = CashClose(date="2026-10-01", branch_id=seed["centro"].id, status="open",
                            opened_at=datetime(2020, 1, 1), opening_amount=opening)
        db.add(session)
        db.commit()
        return session

    def _bono(self, client, headers, seed, amount, from_cash):
        return client.post("/operator-bonuses", headers=headers, json={
            "professional_id": seed["luna"].id, "amount": amount, "bonus_date": "2026-10-10",
            "reason": "Meta de la semana", "branch_id": seed["centro"].id, "from_cash": from_cash})

    def _live(self, client, headers, session_id):
        return client.get(f"/cash-sessions/{session_id}/detail", headers=headers).json()

    def test_un_bono_en_efectivo_baja_el_esperado(self, client, db, seed):
        caja = self._caja(db, seed)
        h = login(client, "admin_c")
        assert self._bono(client, h, seed, 66.0, True).status_code == 201
        live = self._live(client, h, caja.id)
        assert live["cash_extras"] == 66.0 and live["expected_cash"] == 134.0      # 200 - 66

    def test_un_bono_por_otro_medio_no_toca_el_arqueo(self, client, db, seed):
        caja = self._caja(db, seed)
        h = login(client, "admin_c")
        assert self._bono(client, h, seed, 66.0, False).status_code == 201
        live = self._live(client, h, caja.id)
        assert live["cash_extras"] == 0.0 and live["expected_cash"] == 200.0

    def test_eliminar_el_bono_devuelve_el_efectivo(self, client, db, seed):
        caja = self._caja(db, seed)
        h = login(client, "admin_c")
        bono_id = self._bono(client, h, seed, 66.0, True).json()["id"]
        assert client.delete(f"/operator-bonuses/{bono_id}", headers=h).status_code in (200, 204)
        assert self._live(client, h, caja.id)["expected_cash"] == 200.0

    def test_el_cierre_junta_gastos_comisiones_y_extras(self, client, db, seed):
        caja = self._caja(db, seed)
        ticket = add_ticket(db, seed, services=("clasica",))                      # comisión 50
        h = login(client, "admin_c")
        client.post(PAY_URL, json={"appointment_ids": [ticket.id], "from_cash": True}, headers=h)
        self._bono(client, h, seed, 66.0, True)
        closed = client.post(f"/cash-sessions/{caja.id}/close",
                             json={"counted_amount": 84.0, "next_fund_amount": 0.0}, headers=h)
        assert closed.status_code == 200, closed.text
        body = closed.json()
        assert body["cash_commissions"] == 50.0 and body["cash_extras"] == 66.0
        assert body["expected_cash"] == 84.0 and body["difference"] == 0.0         # 200 - 50 - 66
