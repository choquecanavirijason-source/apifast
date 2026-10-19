"""
Recordatorio manual desde Atención > Próximas citas:
  - POST /agenda/appointments/{id}/reminder: permiso reminders:send, sucursal,
    un envío cada 10 min por cita, nunca en citas cerradas o pasadas;
  - entrega: aviso "recordatorio_manual" en /avisos/programados y evento
    "manual_reminder" por el WebSocket de la clienta (mismo aviso_id);
  - GET /clients/citas-proximas devuelve el último envío.

Las citas se arman relativas a ahora en La Paz porque el endpoint usa la hora
real del servidor.

Ejecutar:
  cd elashesbackend
  pytest tests/test_manual_reminders.py -v
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.application.services.appointment_notice_service import LA_PAZ, get_scheduled_notices
from app.core.dependencies import get_db
from app.core.ws_manager import client_ws_manager
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.manual_reminder import ManualReminder
from app.domain.entities.service_agenda import Appointment, AppointmentService, Service, ServiceCategory
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database.base_class import Base
from app.infrastructure.security import get_password_hash
from app.presentation.controllers.device_notices_controller import AvisosProgramadosResponse

engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

MSG = "Hola Ana, te recordamos tu cita de mañana a las 10:00. ¡Te esperamos!"


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


@pytest.fixture
def ws_events(monkeypatch) -> list[tuple[int, dict]]:
    """Captura lo que el endpoint emite por el WebSocket de clientas."""
    sent: list[tuple[int, dict]] = []

    async def fake_broadcast(client_id: int, data: dict):
        sent.append((client_id, data))

    monkeypatch.setattr(client_ws_manager, "broadcast", fake_broadcast)
    return sent


# ── Datos ────────────────────────────────────────────────────────────────────

def now_local() -> datetime:
    """Ahora en La Paz, naive (como appointments.start_time)."""
    return datetime.now(LA_PAZ).replace(tzinfo=None, microsecond=0)


def _user(db, username, role, branch) -> User:
    user = User(
        username=username,
        email=f"{username}@test.com",
        hashed_password=get_password_hash("test1234"),
        is_active=True,
        role_id=role.id,
        branch_id=branch.id,
    )
    db.add(user)
    return user


@pytest.fixture
def seed(db: Session) -> dict:
    perms = {n: Permission(name=n) for n in ("appointments:manage", "clients:view", "reminders:send")}
    db.add_all(perms.values())
    db.flush()

    admin, secretaria, operaria = Role(name="Admin"), Role(name="Secretaria"), Role(name="Operaria")
    db.add_all([admin, secretaria, operaria])
    db.flush()
    admin.permissions = list(perms.values())
    # Sin reminders:send aunque gestione citas.
    secretaria.permissions = [perms["appointments:manage"], perms["clients:view"]]
    # Con el permiso, pero acotada a su sucursal.
    operaria.permissions = [perms["reminders:send"], perms["clients:view"]]

    centro = Branch(name="Centro", address="Calle 1", city="LPZ", department="LP")
    norte = Branch(name="Norte", address="Calle 2", city="LPZ", department="LP")
    db.add_all([centro, norte])
    db.flush()
    _user(db, "admin_r", admin, centro)
    _user(db, "secretaria_r", secretaria, centro)
    _user(db, "operaria_r", operaria, centro)

    ana = Client(name="Ana", last_name="Lopez", branch_id=centro.id)
    bea = Client(name="Bea", last_name="Perez", branch_id=norte.id)
    category = ServiceCategory(name="Pestañas", is_mobile=False)
    db.add_all([ana, bea, category])
    db.flush()
    service = Service(name="Extensiones", duration_minutes=60, price=150.0, category_id=category.id)
    db.add(service)
    db.commit()
    return {"centro": centro, "norte": norte, "ana": ana, "bea": bea, "service": service}


def add_cita(db, seed, *, client="ana", branch="centro", in_hours=24, status="pending") -> Appointment:
    start = now_local() + timedelta(hours=in_hours)
    appt = Appointment(
        client_id=seed[client].id, branch_id=seed[branch].id, service_id=seed["service"].id,
        start_time=start, end_time=start + timedelta(hours=1), status=status,
    )
    db.add(appt)
    db.flush()
    db.add(AppointmentService(appointment_id=appt.id, service_id=seed["service"].id, sort_order=0))
    db.commit()
    return appt


def login(client: TestClient, username: str) -> dict:
    resp = client.post("/auth/login", json={"username": username, "password": "test1234"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def send(client: TestClient, headers: dict, appointment_id: int, message: str = MSG):
    return client.post(f"/agenda/appointments/{appointment_id}/reminder", json={"message": message},
                       headers=headers)


# ── Endpoint ─────────────────────────────────────────────────────────────────

class TestEnvio:
    def test_admin_envia_y_se_guarda(self, client, db, seed, ws_events):
        appt = add_cita(db, seed)
        resp = send(client, login(client, "admin_r"), appt.id, f"  {MSG}  ")
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["appointment_id"] == appt.id
        assert body["client_id"] == seed["ana"].id
        assert body["message"] == MSG  # sin los espacios de los bordes
        assert datetime.fromisoformat(body["created_at"]).utcoffset() == timedelta(0)  # con zona UTC
        row = db.query(ManualReminder).one()
        assert row.sent_by == db.query(User).filter(User.username == "admin_r").one().id

    def test_emite_por_websocket_el_mismo_aviso(self, client, db, seed, ws_events):
        appt = add_cita(db, seed)
        assert send(client, login(client, "admin_r"), appt.id).status_code == 201
        [(client_id, event)] = ws_events
        assert client_id == seed["ana"].id
        assert event["event"] == "manual_reminder"
        assert event["tipo"] == "recordatorio_manual" and event["cuerpo"] == MSG
        [aviso] = manuales(get_scheduled_notices(db, seed["ana"].id))
        assert aviso == {k: v for k, v in event.items() if k != "event"}


class TestPermisos:
    def test_sin_token_401(self, client, db, seed):
        appt = add_cita(db, seed)
        assert send(client, {}, appt.id).status_code == 401

    def test_sin_permiso_reminders_send_403(self, client, db, seed, ws_events):
        appt = add_cita(db, seed)
        resp = send(client, login(client, "secretaria_r"), appt.id)
        assert resp.status_code == 403
        assert "reminders:send" in resp.json()["detail"]
        assert db.query(ManualReminder).count() == 0 and ws_events == []

    def test_rol_acotado_solo_su_sucursal(self, client, db, seed, ws_events):
        h = login(client, "operaria_r")
        otra = add_cita(db, seed, client="bea", branch="norte")
        assert send(client, h, otra.id).status_code == 403
        suya = add_cita(db, seed)
        assert send(client, h, suya.id).status_code == 201

    def test_cita_inexistente_404(self, client, seed):
        assert send(client, login(client, "admin_r"), 99999).status_code == 404


class TestLimiteDeFrecuencia:
    def test_segundo_envio_antes_de_10_min_429(self, client, db, seed, ws_events):
        appt = add_cita(db, seed)
        h = login(client, "admin_r")
        assert send(client, h, appt.id).status_code == 201
        resp = send(client, h, appt.id, "Otro mensaje")
        assert resp.status_code == 429
        assert "10 minutos" in resp.json()["detail"]
        assert int(resp.headers["Retry-After"]) > 0
        assert db.query(ManualReminder).count() == 1 and len(ws_events) == 1

    def test_pasados_10_min_se_puede_reenviar(self, client, db, seed, ws_events):
        appt = add_cita(db, seed)
        h = login(client, "admin_r")
        assert send(client, h, appt.id).status_code == 201
        row = db.query(ManualReminder).one()
        row.created_at = row.created_at - timedelta(minutes=10, seconds=1)
        db.commit()
        assert send(client, h, appt.id).status_code == 201

    def test_el_limite_es_por_cita(self, client, db, seed, ws_events):
        h = login(client, "admin_r")
        primera, segunda = add_cita(db, seed), add_cita(db, seed, in_hours=48)
        assert send(client, h, primera.id).status_code == 201
        assert send(client, h, segunda.id).status_code == 201


class TestEstadoDeLaCita:
    @pytest.mark.parametrize(
        "estado", ["completed", "cancelled", "cancelado", "finalizado", "atendido", "no_show", "done"]
    )
    def test_estado_final_409(self, client, db, seed, ws_events, estado):
        appt = add_cita(db, seed, status=estado)
        assert send(client, login(client, "admin_r"), appt.id).status_code == 409
        assert db.query(ManualReminder).count() == 0 and ws_events == []

    @pytest.mark.parametrize("estado", ["pending", "confirmed", "in_service"])
    def test_estado_activo_se_permite(self, client, db, seed, ws_events, estado):
        appt = add_cita(db, seed, status=estado)
        assert send(client, login(client, "admin_r"), appt.id).status_code == 201

    def test_cita_ya_pasada_400(self, client, db, seed, ws_events):
        appt = add_cita(db, seed, in_hours=-1)
        assert send(client, login(client, "admin_r"), appt.id).status_code == 400


class TestMensaje:
    @pytest.mark.parametrize("message", ["", "    ", "x" * 201])
    def test_vacio_o_mayor_a_200_422(self, client, db, seed, message):
        appt = add_cita(db, seed)
        assert send(client, login(client, "admin_r"), appt.id, message).status_code == 422

    def test_200_caracteres_justos(self, client, db, seed, ws_events):
        appt = add_cita(db, seed)
        assert send(client, login(client, "admin_r"), appt.id, "x" * 200).status_code == 201


# ── Aviso en /avisos/programados ─────────────────────────────────────────────

def add_reminder(db, appt: Appointment, created_at_utc: datetime, message: str = MSG) -> ManualReminder:
    reminder = ManualReminder(
        appointment_id=appt.id, client_id=appt.client_id, message=message, created_at=created_at_utc
    )
    db.add(reminder)
    db.commit()
    return reminder


def manuales(result: dict) -> list[dict]:
    return [a for a in result["avisos"] if a["tipo"] == "recordatorio_manual"]


class TestAvisoProgramado:
    def test_visible_desde_su_creacion_hasta_la_hora_de_la_cita(self, db, seed):
        appt = add_cita(db, seed, in_hours=72)  # fuera de la ventana de 48 h: igual sale
        sent = datetime.utcnow().replace(microsecond=0) - timedelta(minutes=5)
        reminder = add_reminder(db, appt, sent)
        result = get_scheduled_notices(db, seed["ana"].id)
        AvisosProgramadosResponse(**result)  # el tipo nuevo pasa el response_model
        [aviso] = manuales(result)
        assert aviso["cita_id"] == appt.id and aviso["seguimiento_id"] is None
        assert aviso["titulo"] == "Recordatorio de tu cita" and aviso["cuerpo"] == MSG
        assert datetime.fromisoformat(aviso["mostrar_en"]) == sent.replace(tzinfo=timezone.utc)
        assert aviso["expira_en"] == appt.start_time.replace(tzinfo=LA_PAZ).isoformat()
        assert aviso["aviso_id"] != reminder.id  # hash propio, no el id de la tabla

    def test_cada_envio_es_un_aviso_distinto(self, db, seed):
        appt = add_cita(db, seed)
        add_reminder(db, appt, datetime.utcnow() - timedelta(minutes=30), "Primero")
        add_reminder(db, appt, datetime.utcnow() - timedelta(minutes=5), "Segundo")
        avisos = manuales(get_scheduled_notices(db, seed["ana"].id))
        assert [a["cuerpo"] for a in avisos] == ["Primero", "Segundo"]  # por mostrar_en
        assert avisos[0]["aviso_id"] != avisos[1]["aviso_id"]

    def test_expira_a_la_hora_de_la_cita(self, db, seed):
        appt = add_cita(db, seed, in_hours=2)
        add_reminder(db, appt, datetime.utcnow() - timedelta(minutes=5))
        despues = datetime.now(timezone.utc) + timedelta(hours=2, minutes=1)
        assert manuales(get_scheduled_notices(db, seed["ana"].id, despues)) == []

    def test_cita_que_pasa_a_estado_final_lo_retira(self, db, seed):
        appt = add_cita(db, seed)
        add_reminder(db, appt, datetime.utcnow() - timedelta(minutes=5))
        appt.status = "completed"
        db.commit()
        assert manuales(get_scheduled_notices(db, seed["ana"].id)) == []

    def test_solo_los_de_la_clienta(self, db, seed):
        add_reminder(db, add_cita(db, seed, client="bea", branch="norte"), datetime.utcnow())
        assert manuales(get_scheduled_notices(db, seed["ana"].id)) == []

    def test_no_depende_de_notificaciones_activas(self, db, seed):
        seed["ana"].notificaciones_activas = False
        add_reminder(db, add_cita(db, seed), datetime.utcnow() - timedelta(minutes=1))
        assert len(manuales(get_scheduled_notices(db, seed["ana"].id))) == 1


# ── Próximas citas: último envío ─────────────────────────────────────────────

class TestUltimoRecordatorioEnProximasCitas:
    def test_devuelve_el_ultimo_envio_en_utc(self, client, db, seed):
        con, sin = add_cita(db, seed), add_cita(db, seed, in_hours=30)
        add_reminder(db, con, datetime(2026, 1, 1, 12, 0))
        add_reminder(db, con, datetime(2026, 1, 1, 12, 30))
        resp = client.get("/clients/citas-proximas", headers=login(client, "admin_r"))
        assert resp.status_code == 200, resp.text
        by_id = {r["appointment_id"]: r for r in resp.json()}
        assert datetime.fromisoformat(by_id[con.id]["ultimo_recordatorio"]) == datetime(
            2026, 1, 1, 12, 30, tzinfo=timezone.utc
        )
        assert by_id[sin.id]["ultimo_recordatorio"] is None
