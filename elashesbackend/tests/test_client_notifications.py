"""
Tests de Atención > Notificaciones: PATCH /clients/{id}/notificaciones y
GET /clients/retoques (estado de retoques).

Las fechas se arman relativas a hoy en La Paz porque el endpoint usa la hora
real del servidor.

Ejecutar:
  cd elashesbackend
  pytest tests/test_client_notifications.py -v
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.application.services.appointment_notice_service import LA_PAZ
from app.core.dependencies import get_db
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.service_agenda import Appointment, Service, ServiceCategory
from app.domain.entities.tracking import Tracking
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database.base_class import Base
from app.infrastructure.security import get_password_hash

engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


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


# ── Fechas ───────────────────────────────────────────────────────────────────

def today() -> date:
    return datetime.now(LA_PAZ).date()


def target(days: int) -> datetime:
    """15:00 de La Paz de hoy + days, en UTC naive (como en client_tracking)."""
    local = datetime.combine(today() + timedelta(days=days), time(15, 0), tzinfo=LA_PAZ)
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def local_naive(days: int, hour: int = 10) -> datetime:
    """Hora de La Paz naive (como appointments.start_time)."""
    return datetime.combine(today() + timedelta(days=days), time(hour, 0))


# ── Datos ────────────────────────────────────────────────────────────────────

def _user(db, username, role, branch, phone) -> User:
    user = User(
        username=username,
        email=f"{username}@test.com",
        phone=phone,
        hashed_password=get_password_hash("test1234"),
        is_active=True,
        role_id=role.id,
        branch_id=branch.id,
    )
    db.add(user)
    return user


@pytest.fixture
def seed(db: Session) -> dict:
    perms = {n: Permission(name=n) for n in ("clients:view", "clients:manage")}
    db.add_all(perms.values())
    db.flush()

    admin_role, operaria_role, cajera_role = Role(name="Admin"), Role(name="Operaria"), Role(name="Cajera")
    db.add_all([admin_role, operaria_role, cajera_role])
    db.flush()
    admin_role.permissions = list(perms.values())
    operaria_role.permissions = list(perms.values())
    cajera_role.permissions = [perms["clients:view"]]

    centro = Branch(name="Centro", address="Calle 1", city="SCZ", department="SC")
    norte = Branch(name="Norte", address="Calle 2", city="SCZ", department="SC")
    db.add_all([centro, norte])
    db.flush()

    _user(db, "admin_t", admin_role, centro, "+59199100001")
    _user(db, "operaria_t", operaria_role, centro, "+59199100002")
    _user(db, "cajera_t", cajera_role, centro, "+59199100003")

    ana = Client(name="Ana", last_name="Lopez", branch_id=centro.id)
    bea = Client(name="Bea", last_name="Perez", branch_id=norte.id)
    cris = Client(name="Cris", last_name="Rojas", branch_id=None)
    category = ServiceCategory(name="Extensiones", is_mobile=False, has_maintenance=True, has_removal=True)
    db.add_all([ana, bea, cris, category])
    db.flush()
    service = Service(name="Extensiones Clásicas", duration_minutes=60, price=150.0,
                      category_id=category.id, maintenance_days=21)
    db.add(service)
    db.commit()
    return {"centro": centro, "norte": norte, "ana": ana, "bea": bea, "cris": cris, "service": service}


def add_tracking(db, client: Client, *, maintenance=None, removal=None, applied_days_ago=21,
                 service: Service | None = None) -> Tracking:
    appointment_id = None
    if service is not None:
        appt = Appointment(client_id=client.id, branch_id=client.branch_id, service_id=service.id,
                           start_time=local_naive(-applied_days_ago), end_time=local_naive(-applied_days_ago, 11),
                           status="completed")
        db.add(appt)
        db.flush()
        appointment_id = appt.id
    tracking = Tracking(
        client_id=client.id,
        appointment_id=appointment_id,
        branch_id=client.branch_id,
        last_application_date=datetime.utcnow() - timedelta(days=applied_days_ago),
        next_maintenance_date=maintenance,
        next_removal_date=removal,
    )
    db.add(tracking)
    db.commit()
    return tracking


def login(client: TestClient, username: str) -> dict:
    resp = client.post("/auth/login", json={"username": username, "password": "test1234"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def patch(client, headers, client_id, value):
    return client.patch(f"/clients/{client_id}/notificaciones",
                        json={"notificaciones_activas": value}, headers=headers)


def retoques(client, headers, **params) -> list[dict]:
    resp = client.get("/clients/retoques", params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ── PATCH /clients/{id}/notificaciones ───────────────────────────────────────

class TestToggleNotificaciones:
    def test_desactivar_y_reactivar_actualiza_el_campo(self, client, db, seed):
        h = login(client, "admin_t")
        ana = seed["ana"]

        resp = patch(client, h, ana.id, False)
        assert resp.status_code == 200
        assert resp.json() == {"id": ana.id, "notificaciones_activas": False}
        db.refresh(ana)
        assert ana.notificaciones_activas is False
        assert client.get(f"/clients/{ana.id}", headers=h).json()["notificaciones_activas"] is False

        assert patch(client, h, ana.id, True).json()["notificaciones_activas"] is True
        db.refresh(ana)
        assert ana.notificaciones_activas is True

    def test_el_toggle_se_refleja_en_la_tabla(self, client, seed, db):
        h = login(client, "admin_t")
        add_tracking(db, seed["ana"], maintenance=target(5))
        assert [r["notificaciones_activas"] for r in retoques(client, h)] == [True]
        patch(client, h, seed["ana"].id, False)
        assert [r["notificaciones_activas"] for r in retoques(client, h)] == [False]

    def test_clienta_inexistente(self, client, seed):
        assert patch(client, login(client, "admin_t"), 9999, False).status_code == 404

    def test_body_invalido(self, client, seed):
        h = login(client, "admin_t")
        assert patch(client, h, seed["ana"].id, "si").status_code == 422
        resp = client.patch(f"/clients/{seed['ana'].id}/notificaciones", json={}, headers=h)
        assert resp.status_code == 422

    def test_sin_permiso_clients_manage(self, client, seed):
        assert patch(client, login(client, "cajera_t"), seed["ana"].id, False).status_code == 403

    def test_operaria_solo_clientas_de_su_sucursal(self, client, seed):
        h = login(client, "operaria_t")
        assert patch(client, h, seed["ana"].id, False).status_code == 200   # Centro = la suya
        assert patch(client, h, seed["bea"].id, False).status_code == 403   # Norte
        assert patch(client, h, seed["cris"].id, False).status_code == 403  # sin sucursal

    def test_admin_puede_cualquier_sucursal(self, client, seed):
        h = login(client, "admin_t")
        assert patch(client, h, seed["bea"].id, False).status_code == 200
        assert patch(client, h, seed["cris"].id, False).status_code == 200


# ── GET /clients/retoques ────────────────────────────────────────────────────

class TestEstadoDeRetoques:
    def test_fila_completa(self, client, db, seed):
        add_tracking(db, seed["ana"], maintenance=target(5), service=seed["service"])
        [row] = retoques(client, login(client, "admin_t"))
        assert row["client_id"] == seed["ana"].id
        assert row["clienta"] == "Ana Lopez"
        assert row["servicio"] == "Extensiones Clásicas"
        assert row["tipo"] == "mantenimiento"
        assert row["fecha_objetivo"] == (today() + timedelta(days=5)).isoformat()
        assert row["dias_restantes"] == 5
        assert row["vencido"] is False
        assert row["proxima_cita"] is None
        assert row["notificaciones_activas"] is True

    def test_rango_configurable(self, client, db, seed):
        add_tracking(db, seed["ana"], maintenance=target(20))
        h = login(client, "admin_t")
        assert len(retoques(client, h)) == 1            # 30 días por defecto
        assert retoques(client, h, dias=7) == []
        assert len(retoques(client, h, dias=20)) == 1   # el límite entra

    def test_vencidos_de_los_ultimos_7_dias(self, client, db, seed):
        add_tracking(db, seed["ana"], maintenance=target(-7))
        add_tracking(db, seed["bea"], maintenance=target(-8))
        rows = retoques(client, login(client, "admin_t"))
        assert [(r["clienta"], r["dias_restantes"], r["vencido"]) for r in rows] == [("Ana Lopez", -7, True)]

    def test_hoy_no_es_vencido(self, client, db, seed):
        add_tracking(db, seed["ana"], maintenance=target(0))
        [row] = retoques(client, login(client, "admin_t"))
        assert row["dias_restantes"] == 0 and row["vencido"] is False

    def test_orden_por_fecha_objetivo_y_ambos_tipos(self, client, db, seed):
        add_tracking(db, seed["ana"], maintenance=target(10), removal=target(25))
        add_tracking(db, seed["bea"], removal=target(3))
        add_tracking(db, seed["cris"], maintenance=target(-2))
        rows = retoques(client, login(client, "admin_t"))
        assert [(r["clienta"], r["tipo"], r["dias_restantes"]) for r in rows] == [
            ("Cris Rojas", "mantenimiento", -2),
            ("Bea Perez", "retiro", 3),
            ("Ana Lopez", "mantenimiento", 10),
            ("Ana Lopez", "retiro", 25),
        ]

    def test_solo_cuenta_el_ultimo_seguimiento(self, client, db, seed):
        add_tracking(db, seed["ana"], maintenance=target(5), applied_days_ago=30)
        add_tracking(db, seed["ana"], maintenance=None, applied_days_ago=2)  # ej. un lifting
        assert retoques(client, login(client, "admin_t")) == []

    def test_tiene_cita_muestra_la_fecha(self, client, db, seed):
        add_tracking(db, seed["ana"], maintenance=target(5))
        db.add_all([
            Appointment(client_id=seed["ana"].id, branch_id=seed["centro"].id, start_time=local_naive(9),
                        end_time=local_naive(9, 11), status="cancelled"),
            Appointment(client_id=seed["ana"].id, branch_id=seed["centro"].id, start_time=local_naive(12),
                        end_time=local_naive(12, 11), status="pending"),
        ])
        db.commit()
        [row] = retoques(client, login(client, "admin_t"))
        assert row["proxima_cita"] == local_naive(12).isoformat()  # la cancelada no cuenta

    @pytest.mark.parametrize("estado", ["completed", "no_show"])
    def test_cita_en_estado_final_no_cuenta_como_proxima(self, client, db, seed, estado):
        add_tracking(db, seed["ana"], maintenance=target(5))
        db.add(Appointment(client_id=seed["ana"].id, branch_id=seed["centro"].id, start_time=local_naive(9),
                           end_time=local_naive(9, 11), status=estado))
        db.commit()
        [row] = retoques(client, login(client, "admin_t"))
        assert row["proxima_cita"] is None

    def test_filtro_por_sucursal(self, client, db, seed):
        add_tracking(db, seed["ana"], maintenance=target(5))
        add_tracking(db, seed["bea"], maintenance=target(6))
        h = login(client, "admin_t")
        assert len(retoques(client, h)) == 2
        assert [r["clienta"] for r in retoques(client, h, branch_id=seed["norte"].id)] == ["Bea Perez"]

    def test_operaria_solo_ve_su_sucursal(self, client, db, seed):
        add_tracking(db, seed["ana"], maintenance=target(5))
        add_tracking(db, seed["bea"], maintenance=target(6))
        h = login(client, "operaria_t")
        assert [r["clienta"] for r in retoques(client, h)] == ["Ana Lopez"]
        # Pedir otra sucursal no salta el bloqueo.
        assert [r["clienta"] for r in retoques(client, h, branch_id=seed["norte"].id)] == ["Ana Lopez"]

    def test_requiere_clients_view(self, client, seed):
        assert client.get("/clients/retoques").status_code == 401


# ── GET /clients/citas-proximas ──────────────────────────────────────────────

def add_cita(db, client: Client, start: datetime, *, branch: Branch, status="pending",
             service: Service | None = None) -> Appointment:
    appt = Appointment(client_id=client.id, branch_id=branch.id, service_id=service.id if service else None,
                       start_time=start, end_time=start + timedelta(hours=1), status=status)
    db.add(appt)
    db.commit()
    return appt


def citas(client, headers, **params) -> list[dict]:
    resp = client.get("/clients/citas-proximas", params=params, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def now_local_naive() -> datetime:
    return datetime.now(LA_PAZ).replace(tzinfo=None, microsecond=0)


class TestProximasCitas:
    def test_fila_completa(self, client, db, seed):
        start = local_naive(3, 15)
        appt = add_cita(db, seed["ana"], start, branch=seed["centro"], status="confirmed", service=seed["service"])
        [row] = citas(client, login(client, "admin_t"))
        assert row["appointment_id"] == appt.id
        assert row["clienta"] == "Ana Lopez"
        assert row["servicio"] == "Extensiones Clásicas"
        assert row["fecha_hora"] == start.isoformat()
        assert row["sucursal"] == "Centro"
        assert row["estado"] == "confirmed"
        assert row["notificaciones_activas"] is True

    def test_rango_de_dias(self, client, db, seed):
        now = now_local_naive()
        add_cita(db, seed["ana"], now - timedelta(hours=1), branch=seed["centro"])            # ya pasó
        add_cita(db, seed["ana"], now + timedelta(hours=2), branch=seed["centro"])            # entra
        add_cita(db, seed["ana"], now + timedelta(days=6, hours=23), branch=seed["centro"])   # entra con 7
        add_cita(db, seed["ana"], now + timedelta(days=7, hours=1), branch=seed["centro"])    # fuera de 7
        add_cita(db, seed["ana"], now + timedelta(days=31), branch=seed["centro"])            # fuera de 30
        h = login(client, "admin_t")
        assert len(citas(client, h, dias=7)) == 2
        assert len(citas(client, h)) == 3  # 30 por defecto

    def test_no_salen_las_canceladas(self, client, db, seed):
        add_cita(db, seed["ana"], local_naive(2), branch=seed["centro"], status="cancelled")
        keep = add_cita(db, seed["bea"], local_naive(2), branch=seed["norte"], status="pending")
        assert [r["appointment_id"] for r in citas(client, login(client, "admin_t"))] == [keep.id]

    def test_no_salen_las_de_estado_final(self, client, db, seed):
        add_cita(db, seed["ana"], local_naive(2), branch=seed["centro"], status="completed")
        add_cita(db, seed["cris"], local_naive(3), branch=seed["centro"], status="no_show")
        keep = add_cita(db, seed["bea"], local_naive(2), branch=seed["norte"], status="confirmed")
        assert [r["appointment_id"] for r in citas(client, login(client, "admin_t"))] == [keep.id]

    def test_orden_por_fecha_hora(self, client, db, seed):
        tarde = add_cita(db, seed["ana"], local_naive(5, 16), branch=seed["centro"])
        temprano = add_cita(db, seed["bea"], local_naive(2, 9), branch=seed["norte"])
        medio = add_cita(db, seed["cris"], local_naive(5, 10), branch=seed["centro"])
        ids = [r["appointment_id"] for r in citas(client, login(client, "admin_t"))]
        assert ids == [temprano.id, medio.id, tarde.id]

    def test_filtro_por_sucursal_de_la_cita(self, client, db, seed):
        add_cita(db, seed["ana"], local_naive(2), branch=seed["centro"])
        # Clienta de Norte que agenda en Centro: cuenta como cita de Centro.
        add_cita(db, seed["bea"], local_naive(3), branch=seed["centro"])
        en_norte = add_cita(db, seed["bea"], local_naive(4), branch=seed["norte"])
        h = login(client, "admin_t")
        assert len(citas(client, h)) == 3
        assert [r["appointment_id"] for r in citas(client, h, branch_id=seed["norte"].id)] == [en_norte.id]
        assert len(citas(client, h, branch_id=seed["centro"].id)) == 2

    def test_operaria_solo_ve_su_sucursal(self, client, db, seed):
        add_cita(db, seed["ana"], local_naive(2), branch=seed["centro"])
        add_cita(db, seed["bea"], local_naive(3), branch=seed["norte"])
        h = login(client, "operaria_t")
        assert [r["sucursal"] for r in citas(client, h)] == ["Centro"]
        assert [r["sucursal"] for r in citas(client, h, branch_id=seed["norte"].id)] == ["Centro"]

    def test_notificaciones_de_la_clienta_solo_lectura(self, client, db, seed):
        add_cita(db, seed["ana"], local_naive(2), branch=seed["centro"])
        h = login(client, "admin_t")
        patch(client, h, seed["ana"].id, False)
        assert [r["notificaciones_activas"] for r in citas(client, h)] == [False]

    def test_requiere_clients_view(self, client, seed):
        assert client.get("/clients/citas-proximas").status_code == 401
