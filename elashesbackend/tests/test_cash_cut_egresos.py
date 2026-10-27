"""
Corte de Caja con comisiones pagadas y pagos extra:
  - GET /reports/paid-commissions: tickets marcados "Pagado" por fecha de pago
    (días de La Paz), sucursal y detalle por operaria;
  - GET /reports/cash-summary: egresos = gastos + comisiones pagadas + extras,
    y saldo = total ingresos - total egresos;
  - /operator-bonuses: registrar, listar y eliminar pagos extra.

Ejecutar:
  cd elashesbackend
  pytest tests/test_cash_cut_egresos.py -v
"""
from __future__ import annotations

from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.core.dependencies import get_db
from app.domain.entities.audit_log import AuditLog
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.expense import Expense
from app.domain.entities.operator_bonus import OperatorBonus
from app.domain.entities.payment import Payment
from app.domain.entities.service_agenda import Appointment
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database.base_class import Base
from app.infrastructure.security import get_password_hash

engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

DAY = {"start_date": "2026-10-10", "end_date": "2026-10-10"}


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


def _user(db, username, role, branch) -> User:
    user = User(username=username, email=f"{username}@test.com", hashed_password=get_password_hash("test1234"),
                is_active=True, role_id=role.id, branch_id=branch.id)
    db.add(user)
    db.flush()
    return user


@pytest.fixture
def seed(db: Session) -> dict:
    perms = {n: Permission(name=n) for n in ("payments:view", "payments:manage")}
    db.add_all(perms.values())
    db.flush()
    admin, cajera, operaria = Role(name="Admin"), Role(name="Cajera"), Role(name="Operaria")
    db.add_all([admin, cajera, operaria])
    db.flush()
    admin.permissions = list(perms.values())
    cajera.permissions = list(perms.values())  # acotada a su sucursal
    centro = Branch(name="Centro", address="Calle 1", city="LPZ", department="LP")
    norte = Branch(name="Norte", address="Calle 2", city="LPZ", department="LP")
    db.add_all([centro, norte])
    db.flush()
    _user(db, "admin_k", admin, centro)
    _user(db, "cajera_k", cajera, centro)
    _user(db, "operaria_k", operaria, centro)  # sin permisos de pagos
    luna = _user(db, "luna", operaria, centro)
    sofia = _user(db, "sofia", operaria, norte)
    ana = Client(name="Ana", last_name="Lopez", branch_id=centro.id)
    db.add(ana)
    db.commit()
    return {"centro": centro, "norte": norte, "luna": luna, "sofia": sofia, "ana": ana}


def add_paid_ticket(db, seed, *, pagado_en_utc: datetime, monto: float, professional="luna", branch="centro"):
    start = datetime(2026, 10, 1, 10, 0)
    appt = Appointment(
        client_id=seed["ana"].id, professional_id=seed[professional].id, branch_id=seed[branch].id,
        start_time=start, end_time=start, status="completed",
        pagado=True, pagado_en=pagado_en_utc, pagado_monto=monto,
    )
    db.add(appt)
    db.commit()
    return appt


def login(client, username) -> dict:
    resp = client.post("/auth/login", json={"username": username, "password": "test1234"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def full_day(db, seed):
    """Datos del 10/10 (La Paz) en Centro, más ruido fuera de rango y de Norte."""
    centro, norte = seed["centro"].id, seed["norte"].id
    db.add_all([
        Payment(client_id=seed["ana"].id, branch_id=centro, amount=200, method="cash",
                paid_at=datetime(2026, 10, 10, 12, 0)),
        Payment(client_id=seed["ana"].id, branch_id=centro, amount=100, method="card",
                paid_at=datetime(2026, 10, 10, 13, 0)),
        Expense(branch_id=centro, amount=30, description="Insumos", expense_date=date(2026, 10, 10)),
        OperatorBonus(professional_id=seed["luna"].id, branch_id=centro, amount=15, bonus_date=date(2026, 10, 10),
                      reason="Meta superada"),
        OperatorBonus(professional_id=seed["luna"].id, branch_id=centro, amount=99, bonus_date=date(2026, 10, 11),
                      reason="Otro día"),
        OperatorBonus(professional_id=seed["sofia"].id, branch_id=norte, amount=40, bonus_date=date(2026, 10, 10),
                      reason="Otra sucursal"),
    ])
    db.commit()
    add_paid_ticket(db, seed, pagado_en_utc=datetime(2026, 10, 10, 15, 0), monto=50)   # 11:00 La Paz
    # 02:00 UTC del 11 = 22:00 del 10 en La Paz: cuenta para el 10.
    add_paid_ticket(db, seed, pagado_en_utc=datetime(2026, 10, 11, 2, 0), monto=20)
    # 04:30 UTC del 10 = 00:30 del 10 en La Paz: cuenta. 03:59 UTC = 23:59 del 9: no.
    add_paid_ticket(db, seed, pagado_en_utc=datetime(2026, 10, 10, 4, 30), monto=5)
    add_paid_ticket(db, seed, pagado_en_utc=datetime(2026, 10, 10, 3, 59), monto=1000)
    add_paid_ticket(db, seed, pagado_en_utc=datetime(2026, 10, 10, 15, 0), monto=77,
                    professional="sofia", branch="norte")


# ── Comisiones pagadas ───────────────────────────────────────────────────────

class TestComisionesPagadas:
    def test_por_fecha_de_pago_en_la_paz_y_sucursal(self, client, full_day, seed):
        resp = client.get("/reports/paid-commissions", params={**DAY, "branch_id": seed["centro"].id},
                          headers=login(client, "admin_k"))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["total"] == 75.0 and body["tickets"] == 3
        assert body["by_professional"] == [
            {"professional_id": seed["luna"].id, "professional_name": "luna", "tickets": 3, "total": 75.0}
        ]

    def test_todas_las_sucursales(self, client, full_day):
        body = client.get("/reports/paid-commissions", params=DAY, headers=login(client, "admin_k")).json()
        assert body["total"] == 152.0
        assert [r["professional_name"] for r in body["by_professional"]] == ["sofia", "luna"]

    def test_los_no_pagados_no_cuentan(self, client, db, seed):
        db.add(Appointment(client_id=seed["ana"].id, professional_id=seed["luna"].id, branch_id=seed["centro"].id,
                           start_time=datetime(2026, 10, 10, 10), end_time=datetime(2026, 10, 10, 11),
                           status="completed", pagado=False))
        db.commit()
        body = client.get("/reports/paid-commissions", params=DAY, headers=login(client, "admin_k")).json()
        assert body == {"total": 0.0, "tickets": 0, "by_professional": []}

    def test_sin_permiso_403(self, client, seed):
        assert client.get("/reports/paid-commissions", headers=login(client, "operaria_k")).status_code == 403


# ── Corte de caja ────────────────────────────────────────────────────────────

class TestCorteDeCaja:
    def test_egresos_y_saldo(self, client, full_day, seed):
        resp = client.get("/reports/cash-summary", params={**DAY, "branch_id": seed["centro"].id},
                          headers=login(client, "admin_k"))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["income_by_method"]["total"] == 300.0
        assert body["expenses"] == {"gastos": 30.0, "comisiones_pagadas": 75.0, "extras": 15.0, "total": 120.0}
        assert body["balance"] == {"total_ingresos": 300.0, "total_egresos": 120.0, "saldo": 180.0}
        # Compatibilidad: el bloque anterior sigue igual (efectivo - gastos).
        assert body["cash_in_register"] == {"ventas_efectivo": 200.0, "gastos_efectivo": 30.0, "saldo": 170.0}

    def test_cambiar_el_rango_recalcula(self, client, full_day, seed):
        h = login(client, "admin_k")
        params = {"start_date": "2026-10-10", "end_date": "2026-10-11", "branch_id": seed["centro"].id}
        body = client.get("/reports/cash-summary", params=params, headers=h).json()
        assert body["expenses"]["extras"] == 114.0  # 15 + 99 del 11
        assert body["expenses"]["total"] == 30.0 + 75.0 + 114.0
        assert body["balance"]["saldo"] == round(300.0 - 219.0, 2)

        sin_filtro = client.get("/reports/cash-summary", headers=h).json()
        assert sin_filtro["expenses"]["comisiones_pagadas"] == 1152.0  # todos los pagados
        assert sin_filtro["expenses"]["extras"] == 154.0

    def test_fecha_invalida_422(self, client, seed):
        resp = client.get("/reports/cash-summary", params={"start_date": "10/10/2026"},
                          headers=login(client, "admin_k"))
        assert resp.status_code == 422


# ── Pagos extra ──────────────────────────────────────────────────────────────

def bonus_body(seed, **extra) -> dict:
    return {"professional_id": seed["luna"].id, "amount": 25.5, "bonus_date": "2026-10-10",
            "reason": "  Incentivo por superar meta de 4 a 5 servicios  ", **extra}


class TestPagosExtra:
    def test_registrar_con_sucursal_de_la_operaria_y_audita(self, client, db, seed):
        resp = client.post("/operator-bonuses", json=bonus_body(seed), headers=login(client, "admin_k"))
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["professional_name"] == "luna" and body["branch_id"] == seed["centro"].id
        assert body["amount"] == 25.5 and body["bonus_date"] == "2026-10-10"
        assert body["reason"] == "Incentivo por superar meta de 4 a 5 servicios"
        assert body["created_by_name"] == "admin_k"
        [log] = db.query(AuditLog).filter(AuditLog.entity_type == "operator_bonus").all()
        assert log.action == "create" and "Bs 25.50" in log.description

    def test_sucursal_explicita(self, client, seed):
        resp = client.post("/operator-bonuses", json=bonus_body(seed, branch_id=seed["norte"].id),
                           headers=login(client, "admin_k"))
        assert resp.status_code == 201 and resp.json()["branch_id"] == seed["norte"].id

    def test_listar_con_filtros(self, client, full_day, seed):
        h = login(client, "admin_k")
        rows = client.get("/operator-bonuses", params={"branch_id": seed["centro"].id, "from_date": "2026-10-10",
                                                       "to_date": "2026-10-10"}, headers=h).json()
        assert [r["reason"] for r in rows] == ["Meta superada"]
        todos = client.get("/operator-bonuses", headers=h).json()
        assert [r["bonus_date"] for r in todos] == ["2026-10-11", "2026-10-10", "2026-10-10"]

    @pytest.mark.parametrize("extra", [{"amount": 0}, {"amount": -5}, {"reason": "   "},
                                       {"reason": "x" * 301}, {"bonus_date": "ayer"}])
    def test_validacion_422(self, client, seed, extra):
        resp = client.post("/operator-bonuses", json=bonus_body(seed, **extra), headers=login(client, "admin_k"))
        assert resp.status_code == 422

    def test_operaria_inexistente_404(self, client, seed):
        resp = client.post("/operator-bonuses", json=bonus_body(seed, professional_id=99999),
                           headers=login(client, "admin_k"))
        assert resp.status_code == 404

    def test_sin_permiso_403(self, client, db, seed):
        resp = client.post("/operator-bonuses", json=bonus_body(seed), headers=login(client, "operaria_k"))
        assert resp.status_code == 403
        assert db.query(OperatorBonus).count() == 0

    def test_rol_acotado_solo_su_sucursal(self, client, seed):
        h = login(client, "cajera_k")  # Centro
        assert client.post("/operator-bonuses", json=bonus_body(seed, professional_id=seed["sofia"].id),
                           headers=h).status_code == 403
        assert client.post("/operator-bonuses", json=bonus_body(seed), headers=h).status_code == 201

    def test_eliminar_y_audita(self, client, db, seed):
        h = login(client, "admin_k")
        bonus_id = client.post("/operator-bonuses", json=bonus_body(seed), headers=h).json()["id"]
        assert client.delete(f"/operator-bonuses/{bonus_id}", headers=h).status_code == 204
        assert db.query(OperatorBonus).count() == 0
        assert db.query(AuditLog).filter(AuditLog.action == "delete",
                                         AuditLog.entity_type == "operator_bonus").count() == 1
        assert client.delete(f"/operator-bonuses/{bonus_id}", headers=h).status_code == 404

    def test_el_extra_registrado_baja_el_saldo(self, client, seed):
        h = login(client, "admin_k")
        params = {**DAY, "branch_id": seed["centro"].id}
        antes = client.get("/reports/cash-summary", params=params, headers=h).json()["balance"]["saldo"]
        client.post("/operator-bonuses", json=bonus_body(seed), headers=h)
        despues = client.get("/reports/cash-summary", params=params, headers=h).json()
        assert despues["expenses"]["extras"] == 25.5
        assert despues["balance"]["saldo"] == round(antes - 25.5, 2)
