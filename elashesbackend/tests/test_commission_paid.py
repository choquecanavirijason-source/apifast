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
