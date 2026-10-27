"""
Push de recordatorios manuales por Firebase Cloud Messaging (FCM), con el
cliente de FCM simulado (nunca se llama a Google):
  - PUT/DELETE /dispositivos/actual/fcm-token (autenticados con device_token);
  - push_manual_reminder: envío correcto, token inválido que se borra, FCM
    caído que no rompe el recordatorio, sin credenciales, sin token;
  - FcmClient/classify_fcm_error: formato del mensaje y respuestas de FCM;
  - send_due_fcm_notices: avisos programados enviados una vez por
    dispositivo, sin repetir los recordatorios manuales.

Ejecutar:
  cd elashesbackend
  pytest tests/test_fcm_push.py -v
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from main import app as main_app
from app.application.services import fcm_notice_service, push_service
from app.application.services.appointment_notice_service import LA_PAZ
from app.application.services.device_service import register_device, revoke_device
from app.config.settings import settings
from app.core.dependencies import get_db
from app.core.ws_manager import client_ws_manager
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.client_device import ClientDevice, FcmNoticeDelivery
from app.domain.entities.manual_reminder import ManualReminder
from app.domain.entities.service_agenda import Appointment
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database.base_class import Base
from app.infrastructure.push import fcm_client
from app.infrastructure.push.fcm_client import FcmClient, FcmResult, classify_fcm_error
from app.infrastructure.security import get_password_hash
from app.presentation.controllers.device_notices_controller import router as device_router

engine = create_engine(
    "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TOKEN_A = "fcmTokenA_" + "a" * 140 + ":APA91b"
TOKEN_B = "fcmTokenB_" + "b" * 140 + ":APA91b"


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
def ws_events(monkeypatch) -> list:
    sent: list = []

    async def fake_broadcast(client_id, data):
        sent.append((client_id, data))

    monkeypatch.setattr(client_ws_manager, "broadcast", fake_broadcast)
    return sent


class FakeFcm:
    """Cliente FCM simulado: responde por token lo que se le configure."""

    def __init__(self, results: dict[str, FcmResult] | None = None, raises: Exception | None = None):
        self.results = results or {}
        self.raises = raises
        self.calls: list[tuple[str, dict]] = []

    def send_data(self, token: str, data: dict) -> FcmResult:
        self.calls.append((token, data))
        if self.raises:
            raise self.raises
        return self.results.get(token, FcmResult.SENT)


@pytest.fixture
def use_fcm(monkeypatch):
    """use_fcm(fake) hace que push_service use ese cliente (None = desactivado)."""
    def _use(fake):
        monkeypatch.setattr(push_service, "get_fcm_client", lambda: fake)
        return fake
    return _use


@pytest.fixture
def fresh_fcm_loader(monkeypatch):
    """get_fcm_client() real, sin la caché de otro test."""
    monkeypatch.setattr(fcm_client, "_loaded", False)
    monkeypatch.setattr(fcm_client, "_client", None)


# ── Datos ────────────────────────────────────────────────────────────────────

def now_local() -> datetime:
    return datetime.now(LA_PAZ).replace(tzinfo=None, microsecond=0)


@pytest.fixture
def seed(db: Session) -> dict:
    perm = Permission(name="reminders:send")
    role = Role(name="Admin")
    branch = Branch(name="Centro", address="Calle 1", city="LPZ", department="LP")
    db.add_all([perm, role, branch])
    db.flush()
    role.permissions = [perm]
    db.add(User(username="admin_f", email="admin_f@test.com", hashed_password=get_password_hash("test1234"),
                is_active=True, role_id=role.id, branch_id=branch.id))
    ana = Client(name="Ana", last_name="Lopez", branch_id=branch.id)
    bea = Client(name="Bea", last_name="Perez", branch_id=branch.id)
    db.add_all([ana, bea])
    db.flush()
    start = now_local() + timedelta(days=1)
    appt = Appointment(client_id=ana.id, branch_id=branch.id, start_time=start,
                       end_time=start + timedelta(hours=1), status="pending")
    db.add(appt)
    db.commit()
    return {"ana": ana, "bea": bea, "appt": appt}


def add_device(db, client: Client, installation: str, *, fcm_token=None, revoked=False) -> ClientDevice:
    device, _ = register_device(db, client.id, installation, "android")
    if fcm_token:
        device.fcm_token = fcm_token
        device.fcm_token_updated_at = datetime.utcnow()
    if revoked:
        device.revoked_at = datetime.utcnow()
    db.commit()
    return device


def add_reminder(db, seed) -> tuple[ManualReminder, dict]:
    reminder = ManualReminder(appointment_id=seed["appt"].id, client_id=seed["ana"].id,
                              message="Te esperamos mañana", created_at=datetime.utcnow())
    db.add(reminder)
    db.commit()
    from app.application.services.appointment_notice_service import manual_reminder_aviso
    return reminder, manual_reminder_aviso(reminder, seed["appt"])


# ── Endpoints del token FCM ──────────────────────────────────────────────────

@pytest.fixture
def device_api(db) -> TestClient:
    app = FastAPI()
    app.include_router(device_router)
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c


def device_auth(db, client: Client, installation="install-0001") -> tuple[ClientDevice, dict]:
    device, token = register_device(db, client.id, installation, "android")
    return device, {"Authorization": f"Bearer {token}"}


class TestEndpointsToken:
    def test_registrar_y_actualizar(self, device_api, db, seed):
        device, h = device_auth(db, seed["ana"])
        assert device_api.put("/dispositivos/actual/fcm-token", json={"fcm_token": TOKEN_A},
                              headers=h).status_code == 204
        db.refresh(device)
        assert device.fcm_token == TOKEN_A and device.fcm_token_updated_at is not None
        assert device_api.put("/dispositivos/actual/fcm-token", json={"fcm_token": f"  {TOKEN_B}  "},
                              headers=h).status_code == 204
        db.refresh(device)
        assert device.fcm_token == TOKEN_B  # sin los espacios

    def test_borrar(self, device_api, db, seed):
        device, h = device_auth(db, seed["ana"])
        device_api.put("/dispositivos/actual/fcm-token", json={"fcm_token": TOKEN_A}, headers=h)
        assert device_api.delete("/dispositivos/actual/fcm-token", headers=h).status_code == 204
        db.refresh(device)
        assert device.fcm_token is None

    def test_sin_device_token_401(self, device_api, seed):
        assert device_api.put("/dispositivos/actual/fcm-token", json={"fcm_token": TOKEN_A}).status_code == 401
        assert device_api.delete("/dispositivos/actual/fcm-token",
                                 headers={"Authorization": "Bearer otro"}).status_code == 401

    @pytest.mark.parametrize("bad", ["", "corto", "x" * 513, "con espacios en medio " + "a" * 30,
                                     "a" * 30 + "<script>", 12345])
    def test_validacion_422(self, device_api, db, seed, bad):
        _, h = device_auth(db, seed["ana"])
        assert device_api.put("/dispositivos/actual/fcm-token", json={"fcm_token": bad},
                              headers=h).status_code == 422

    def test_el_token_se_quita_de_otra_instalacion(self, device_api, db, seed):
        viejo = add_device(db, seed["bea"], "install-vieja", fcm_token=TOKEN_A)
        _, h = device_auth(db, seed["ana"], "install-nueva")
        device_api.put("/dispositivos/actual/fcm-token", json={"fcm_token": TOKEN_A}, headers=h)
        db.refresh(viejo)
        assert viejo.fcm_token is None
        assert db.query(ClientDevice).filter(ClientDevice.fcm_token == TOKEN_A).count() == 1

    def test_revocar_dispositivo_borra_el_token(self, db, seed):
        device = add_device(db, seed["ana"], "install-0001", fcm_token=TOKEN_A)
        revoke_device(db, device)
        assert device.fcm_token is None

    def test_nuevo_login_en_la_instalacion_borra_el_token(self, db, seed):
        add_device(db, seed["ana"], "install-0001", fcm_token=TOKEN_A)
        device, _ = register_device(db, seed["bea"].id, "install-0001", "android")
        assert device.client_id == seed["bea"].id and device.fcm_token is None


# ── push_manual_reminder ─────────────────────────────────────────────────────

class TestPush:
    def test_envio_correcto_a_los_dispositivos_activos(self, db, seed, use_fcm):
        fake = use_fcm(FakeFcm())
        add_device(db, seed["ana"], "i-1", fcm_token=TOKEN_A)
        add_device(db, seed["ana"], "i-2", fcm_token=TOKEN_B, revoked=True)  # revocado: no
        add_device(db, seed["ana"], "i-3")  # sin token: no
        add_device(db, seed["bea"], "i-4", fcm_token="otra" + "c" * 40)  # otra clienta: no
        reminder, aviso = add_reminder(db, seed)

        assert push_service.push_manual_reminder(db, reminder, aviso) == {"sent": 1, "invalid": 0, "failed": 0}
        [(token, data)] = fake.calls
        assert token == TOKEN_A
        assert data == {
            "type": "manual_reminder",
            "aviso_id": str(aviso["aviso_id"]),
            "appointment_id": str(seed["appt"].id),
            "cita_id": str(seed["appt"].id),
            "tipo": "recordatorio_manual",
            "titulo": "Recordatorio de tu cita",
            "cuerpo": "Te esperamos mañana",
            "fecha_cita": aviso["expira_en"],
            "mostrar_en": aviso["mostrar_en"],
            "expira_en": aviso["expira_en"],
        }
        assert all(isinstance(v, str) for v in data.values())

    def test_token_invalido_se_borra(self, db, seed, use_fcm):
        use_fcm(FakeFcm({TOKEN_A: FcmResult.INVALID_TOKEN}))
        malo = add_device(db, seed["ana"], "i-1", fcm_token=TOKEN_A)
        bueno = add_device(db, seed["ana"], "i-2", fcm_token=TOKEN_B)
        reminder, aviso = add_reminder(db, seed)
        assert push_service.push_manual_reminder(db, reminder, aviso) == {"sent": 1, "invalid": 1, "failed": 0}
        db.refresh(malo)
        db.refresh(bueno)
        assert malo.fcm_token is None and bueno.fcm_token == TOKEN_B

    def test_error_transitorio_no_borra_el_token(self, db, seed, use_fcm):
        use_fcm(FakeFcm({TOKEN_A: FcmResult.ERROR}))
        device = add_device(db, seed["ana"], "i-1", fcm_token=TOKEN_A)
        reminder, aviso = add_reminder(db, seed)
        assert push_service.push_manual_reminder(db, reminder, aviso)["failed"] == 1
        db.refresh(device)
        assert device.fcm_token == TOKEN_A

    def test_fcm_caido_no_lanza(self, db, seed, use_fcm):
        use_fcm(FakeFcm(raises=httpx.ConnectTimeout("timeout")))
        add_device(db, seed["ana"], "i-1", fcm_token=TOKEN_A)
        reminder, aviso = add_reminder(db, seed)
        assert push_service.push_manual_reminder(db, reminder, aviso) == {"sent": 0, "invalid": 0, "failed": 0}

    def test_sin_credenciales_no_envia(self, db, seed, use_fcm):
        use_fcm(None)
        add_device(db, seed["ana"], "i-1", fcm_token=TOKEN_A)
        reminder, aviso = add_reminder(db, seed)
        assert push_service.push_manual_reminder(db, reminder, aviso) == {"sent": 0, "invalid": 0, "failed": 0}

    def test_dispositivo_sin_token_no_envia(self, db, seed, use_fcm):
        fake = use_fcm(FakeFcm())
        add_device(db, seed["ana"], "i-1")
        reminder, aviso = add_reminder(db, seed)
        push_service.push_manual_reminder(db, reminder, aviso)
        assert fake.calls == []


# ── Endpoint del recordatorio con FCM ────────────────────────────────────────

@pytest.fixture
def api(db) -> TestClient:
    main_app.dependency_overrides[get_db] = lambda: db
    with TestClient(main_app) as c:
        yield c
    main_app.dependency_overrides.clear()


def send(api, seed):
    login = api.post("/auth/login", json={"username": "admin_f", "password": "test1234"})
    h = {"Authorization": f"Bearer {login.json()['access_token']}"}
    return api.post(f"/agenda/appointments/{seed['appt'].id}/reminder", json={"message": "Hola"}, headers=h)


class TestRecordatorioConFcm:
    def test_envia_despues_del_websocket_con_el_mismo_aviso_id(self, api, db, seed, ws_events, use_fcm):
        fake = use_fcm(FakeFcm())
        add_device(db, seed["ana"], "i-1", fcm_token=TOKEN_A)
        assert send(api, seed).status_code == 201
        [(_, event)] = ws_events
        [(_, data)] = fake.calls
        assert data["aviso_id"] == str(event["aviso_id"])

    def test_fcm_caido_no_cambia_la_respuesta(self, api, db, seed, ws_events, use_fcm):
        use_fcm(FakeFcm(raises=RuntimeError("FCM caído")))
        add_device(db, seed["ana"], "i-1", fcm_token=TOKEN_A)
        resp = send(api, seed)
        assert resp.status_code == 201
        assert db.query(ManualReminder).count() == 1 and len(ws_events) == 1

    def test_sin_credenciales_el_recordatorio_funciona(self, api, db, seed, ws_events, monkeypatch,
                                                         fresh_fcm_loader, caplog):
        monkeypatch.setattr(settings, "fcm_credentials_file", None)
        add_device(db, seed["ana"], "i-1", fcm_token=TOKEN_A)
        with caplog.at_level(logging.WARNING, logger="elashes.fcm"):
            assert send(api, seed).status_code == 201
        assert "FCM desactivado" in caplog.text


# ── Carga de credenciales ────────────────────────────────────────────────────

class TestCredenciales:
    def test_sin_variable_desactivado(self, monkeypatch, fresh_fcm_loader, caplog):
        monkeypatch.setattr(settings, "fcm_credentials_file", "")
        with caplog.at_level(logging.WARNING, logger="elashes.fcm"):
            assert fcm_client.get_fcm_client() is None
        assert "FCM_CREDENTIALS_FILE no está configurada" in caplog.text

    def test_archivo_inexistente_desactivado(self, monkeypatch, fresh_fcm_loader, tmp_path):
        monkeypatch.setattr(settings, "fcm_credentials_file", str(tmp_path / "no-existe.json"))
        assert fcm_client.get_fcm_client() is None

    def test_json_invalido_desactivado_sin_mostrar_el_contenido(self, monkeypatch, fresh_fcm_loader,
                                                                tmp_path, caplog):
        path = tmp_path / "fcm.json"
        path.write_text(json.dumps({"private_key": "SECRETO-NO-LOGUEAR"}), encoding="utf-8")
        monkeypatch.setattr(settings, "fcm_credentials_file", str(path))
        with caplog.at_level(logging.WARNING, logger="elashes.fcm"):
            assert fcm_client.get_fcm_client() is None
        assert "credenciales no válidas" in caplog.text
        assert "SECRETO-NO-LOGUEAR" not in caplog.text

    def test_se_carga_una_sola_vez(self, monkeypatch, fresh_fcm_loader):
        calls = []
        monkeypatch.setattr(fcm_client, "_load_client", lambda: calls.append(1))
        fcm_client.get_fcm_client()
        fcm_client.get_fcm_client()
        assert calls == [1]


# ── FcmClient (HTTP simulado) y clasificación de errores ─────────────────────

class _Creds:
    valid = True
    token = "oauth-token"


class TestFcmClient:
    def test_formato_del_mensaje(self, monkeypatch):
        seen = {}

        def fake_post(url, json, headers, timeout):
            seen.update(url=url, json=json, headers=headers, timeout=timeout)
            return httpx.Response(200, json={"name": "projects/p/messages/1"})

        monkeypatch.setattr(fcm_client.httpx, "post", fake_post)
        result = FcmClient(_Creds(), "mi-proyecto", timeout=3).send_data(TOKEN_A, {"aviso_id": 7, "type": "x"})
        assert result is FcmResult.SENT
        assert seen["url"] == "https://fcm.googleapis.com/v1/projects/mi-proyecto/messages:send"
        assert seen["headers"] == {"Authorization": "Bearer oauth-token"}
        assert seen["timeout"] == 3
        message = seen["json"]["message"]
        assert message["token"] == TOKEN_A
        assert message["data"] == {"aviso_id": "7", "type": "x"}
        assert message["android"] == {"priority": "HIGH"}
        assert "notification" not in message  # data message, sin notificación del sistema

    def test_unregistered_es_token_invalido_y_no_se_loguea_completo(self, monkeypatch, caplog):
        body = {"error": {"code": 404, "status": "NOT_FOUND", "details": [{"errorCode": "UNREGISTERED"}]}}
        monkeypatch.setattr(fcm_client.httpx, "post", lambda *a, **k: httpx.Response(404, json=body))
        with caplog.at_level(logging.WARNING, logger="elashes.fcm"):
            assert FcmClient(_Creds(), "p").send_data(TOKEN_A, {}) is FcmResult.INVALID_TOKEN
        assert TOKEN_A not in caplog.text and TOKEN_A[-6:] in caplog.text

    def test_timeout_es_error(self, monkeypatch):
        def boom(*a, **k):
            raise httpx.ReadTimeout("lento")
        monkeypatch.setattr(fcm_client.httpx, "post", boom)
        assert FcmClient(_Creds(), "p").send_data(TOKEN_A, {}) is FcmResult.ERROR

    @pytest.mark.parametrize(
        "status,body,expected",
        [
            (404, {"error": {"status": "NOT_FOUND", "details": [{"errorCode": "UNREGISTERED"}]}},
             FcmResult.INVALID_TOKEN),
            (403, {"error": {"status": "PERMISSION_DENIED", "details": [{"errorCode": "SENDER_ID_MISMATCH"}]}},
             FcmResult.INVALID_TOKEN),
            (400, {"error": {"status": "INVALID_ARGUMENT",
                             "message": "The registration token is not a valid FCM registration token"}},
             FcmResult.INVALID_TOKEN),
            (400, {"error": {"status": "INVALID_ARGUMENT", "message": "Invalid value at 'message.data'"}},
             FcmResult.ERROR),
            (401, {"error": {"status": "UNAUTHENTICATED"}}, FcmResult.ERROR),
            (429, {"error": {"status": "RESOURCE_EXHAUSTED", "details": [{"errorCode": "QUOTA_EXCEEDED"}]}},
             FcmResult.ERROR),
            (503, {}, FcmResult.ERROR),
        ],
    )
    def test_clasificacion_de_errores(self, status, body, expected):
        assert classify_fcm_error(status, body) is expected


# ── Avisos programados (job cada minuto) ─────────────────────────────────────

NOW_UTC = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)  # 08:00 en La Paz

AVISO_HOY = {
    "aviso_id": 123, "tipo": "hoy", "cita_id": 55, "seguimiento_id": None,
    "mostrar_en": "2026-10-14T08:00:00-04:00", "expira_en": "2026-10-14T09:30:00-04:00",
    "titulo": "Hoy te toca tu cita", "cuerpo": "Extensiones de pestañas",
}
# Aún no toca mostrarlo (09:00 > 08:00).
AVISO_FUTURO = {
    "aviso_id": 124, "tipo": "manana", "cita_id": 56, "seguimiento_id": None,
    "mostrar_en": "2026-10-14T09:00:00-04:00", "expira_en": "2026-10-14T23:59:00-04:00",
    "titulo": "Mañana te toca tu cita", "cuerpo": "Retoque",
}
# Ya lo envía push_service al crearlo: el job no debe repetirlo.
AVISO_MANUAL = {
    "aviso_id": 125, "tipo": "recordatorio_manual", "cita_id": 55, "seguimiento_id": None,
    "mostrar_en": "2026-10-14T07:00:00-04:00", "expira_en": "2026-10-14T09:30:00-04:00",
    "titulo": "Recordatorio", "cuerpo": "Te esperamos",
}


@pytest.fixture
def notices_job(monkeypatch):
    """notices_job(fake) prepara el job con ese cliente FCM y avisos fijos."""
    def _use(fake, avisos=(AVISO_HOY, AVISO_FUTURO, AVISO_MANUAL)):
        monkeypatch.setattr(fcm_notice_service, "client_notices_active", lambda: True)
        monkeypatch.setattr(fcm_notice_service, "get_fcm_client", lambda: fake)
        monkeypatch.setattr(
            fcm_notice_service, "get_scheduled_notices", lambda *_a: {"avisos": list(avisos)}
        )
        return fake
    return _use


class TestAvisosProgramados:
    def test_envia_una_vez_por_dispositivo(self, db, seed, notices_job):
        fake = notices_job(FakeFcm())
        add_device(db, seed["ana"], "install-0001", fcm_token=TOKEN_A)
        add_device(db, seed["ana"], "install-0002", fcm_token=TOKEN_B)
        add_device(db, seed["ana"], "install-0003")  # sin token FCM
        add_device(db, seed["ana"], "install-0004", fcm_token="revocado", revoked=True)

        assert fcm_notice_service.send_due_fcm_notices(db, NOW_UTC) == 2
        assert sorted(token for token, _ in fake.calls) == sorted([TOKEN_A, TOKEN_B])
        assert fake.calls[0][1] == {
            "type": "scheduled_notice", "aviso_id": "123", "tipo": "hoy", "cita_id": "55",
            "titulo": "Hoy te toca tu cita", "cuerpo": "Extensiones de pestañas",
            "mostrar_en": AVISO_HOY["mostrar_en"], "expira_en": AVISO_HOY["expira_en"],
        }
        assert db.query(FcmNoticeDelivery).count() == 2

        # El siguiente sondeo no reenvía.
        assert fcm_notice_service.send_due_fcm_notices(db, NOW_UTC) == 0
        assert len(fake.calls) == 2

    def test_error_transitorio_se_reintenta(self, db, seed, notices_job):
        fake = notices_job(FakeFcm({TOKEN_A: FcmResult.ERROR}))
        add_device(db, seed["ana"], "install-0001", fcm_token=TOKEN_A)

        assert fcm_notice_service.send_due_fcm_notices(db, NOW_UTC) == 0
        assert db.query(FcmNoticeDelivery).count() == 0
        fake.results = {}
        assert fcm_notice_service.send_due_fcm_notices(db, NOW_UTC) == 1

    def test_token_invalido_se_borra(self, db, seed, notices_job):
        notices_job(FakeFcm({TOKEN_A: FcmResult.INVALID_TOKEN}))
        device = add_device(db, seed["ana"], "install-0001", fcm_token=TOKEN_A)

        assert fcm_notice_service.send_due_fcm_notices(db, NOW_UTC) == 0
        db.refresh(device)
        assert device.fcm_token is None
        assert db.query(FcmNoticeDelivery).count() == 0

    def test_sin_credenciales_no_hace_nada(self, db, seed, notices_job):
        notices_job(None)
        add_device(db, seed["ana"], "install-0001", fcm_token=TOKEN_A)
        assert fcm_notice_service.send_due_fcm_notices(db, NOW_UTC) == 0
