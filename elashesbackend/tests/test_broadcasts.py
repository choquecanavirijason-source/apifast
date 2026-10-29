"""
Comunicados (Notificaciones > Comunicados):
  - grupos de clientas: todas, por sucursal, con cita próxima, con retoque
    próximo y sin visitas; promociones sin las que apagaron notificaciones;
  - POST /broadcasts: permiso broadcasts:send, sucursal forzada para roles
    acotados, 409 si hay otro enviándose, envío en segundo plano por push
    (con imagen solo si hay PUBLIC_BASE_URL) y correo por lotes;
  - bandeja de la app (client_broadcast_feed) y limpieza al reiniciar.

Ejecutar:
  cd elashesbackend
  pytest tests/test_broadcasts.py -v
"""
from __future__ import annotations

import smtplib
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from app.application.services import broadcast_delivery_service as delivery
from app.application.services import push_service
from app.application.services.appointment_notice_service import LA_PAZ
from app.application.services.broadcast_audience_service import AudienceSpec, audience_client_ids, summarize_audience
from app.application.services.broadcast_service import client_broadcast_feed, mark_interrupted_broadcasts
from app.config.settings import settings
from app.core import media
from app.core.dependencies import get_db, get_session_factory
from app.domain.entities.branch import Branch
from app.domain.entities.broadcast import Broadcast, BroadcastRecipient
from app.domain.entities.client import Client
from app.domain.entities.client_device import ClientDevice
from app.domain.entities.service_agenda import Appointment, Service, ServiceCategory
from app.domain.entities.tracking import Tracking
from app.domain.entities.user import Permission, Role, User
from app.infrastructure.database.base_class import Base
from app.infrastructure.push.fcm_client import FcmClient, FcmNotification, FcmResult
from app.infrastructure.security import get_password_hash

engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
IMAGE = "/media/broadcasts/" + "a" * 32 + ".jpg"


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
    app.dependency_overrides[get_session_factory] = lambda: TestingSession
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


class FakeFcm:
    def __init__(self, results: dict[str, FcmResult] | None = None):
        self.results = results or {}
        self.calls: list[tuple[str, dict, FcmNotification | None]] = []

    def send_data(self, token, data, notification=None):
        self.calls.append((token, data, notification))
        return self.results.get(token, FcmResult.SENT)


@pytest.fixture
def fcm(monkeypatch) -> FakeFcm:
    fake = FakeFcm()
    monkeypatch.setattr(push_service, "get_fcm_client", lambda: fake)
    return fake


@pytest.fixture
def outbox(monkeypatch) -> list[str]:
    """Simula la conexión SMTP: guarda el destinatario de cada correo."""
    sent: list[str] = []

    class FakeServer:
        def send_message(self, message):
            if message["To"] == "rechazado@test.com":
                raise smtplib.SMTPRecipientsRefused({message["To"]: (550, b"no")})
            sent.append(message["To"])

    @contextmanager
    def fake_connection():
        yield FakeServer()

    monkeypatch.setattr(delivery, "smtp_connection", fake_connection)
    monkeypatch.setattr(settings, "smtp_host", "smtp.test.com")
    monkeypatch.setattr(settings, "smtp_from_email", "salon@test.com")
    return sent


# ── Datos ────────────────────────────────────────────────────────────────────

def now_local() -> datetime:
    return datetime.now(LA_PAZ).replace(tzinfo=None, microsecond=0)


@pytest.fixture
def seed(db: Session) -> dict:
    perm = Permission(name="broadcasts:send")
    admin, operaria, cajera = Role(name="Admin"), Role(name="Operaria"), Role(name="Cajera")
    admin.permissions, operaria.permissions = [perm], [perm]
    centro, norte = Branch(name="Centro", address="C1", city="LPZ", department="LP"), Branch(
        name="Norte", address="C2", city="LPZ", department="LP")
    db.add_all([perm, admin, operaria, cajera, centro, norte])
    db.flush()
    for username, role in (("admin_b", admin), ("operaria_b", operaria), ("cajera_b", cajera)):
        db.add(User(username=username, email=f"{username}@test.com", hashed_password=get_password_hash("test1234"),
                    is_active=True, role_id=role.id, branch_id=centro.id))

    ana = Client(name="Ana", last_name="Lopez", branch_id=centro.id, email="ana@test.com")
    bea = Client(name="Bea", last_name="Perez", branch_id=norte.id, email="rechazado@test.com")
    # Apagó sus notificaciones: no recibe promociones.
    eva = Client(name="Eva", last_name="Rojas", branch_id=centro.id, notificaciones_activas=False)
    category = ServiceCategory(name="Pestañas", is_mobile=False)
    db.add_all([ana, bea, eva, category])
    db.flush()
    service = Service(name="Extensiones", duration_minutes=60, price=150.0, category_id=category.id)
    db.add(service)
    db.add(ClientDevice(client_id=ana.id, installation_id="inst-ana-1", token_hash="h" * 64,
                        platform="android", fcm_token="token-ana-xxxxxxxxxxxx"))
    db.commit()
    return {"centro": centro, "norte": norte, "ana": ana, "bea": bea, "eva": eva, "service": service}


def add_cita(db, seed, client, days_from_now, status="pending"):
    start = now_local() + timedelta(days=days_from_now)
    db.add(Appointment(client_id=seed[client].id, branch_id=seed["centro"].id, service_id=seed["service"].id,
                       start_time=start, end_time=start + timedelta(hours=1), status=status))
    db.commit()


def login(client: TestClient, username: str) -> dict:
    resp = client.post("/auth/login", json={"username": username, "password": "test1234"})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def payload(**overrides) -> dict:
    return {"kind": "aviso", "title": "Cerramos el lunes", "body": "Feriado: abrimos el martes.", **overrides}


def ids(db, seed, audience="all", kind="aviso", **kwargs) -> set[str]:
    by_id = {seed[name].id: name for name in ("ana", "bea", "eva")}
    return {by_id[cid] for cid in audience_client_ids(db, AudienceSpec(audience, kind, **kwargs))}


# ── Grupos ───────────────────────────────────────────────────────────────────

class TestGrupos:
    def test_todas_y_por_sucursal(self, db, seed):
        assert ids(db, seed) == {"ana", "bea", "eva"}
        assert ids(db, seed, branch_id=seed["norte"].id) == {"bea"}

    def test_promociones_respetan_notificaciones_apagadas(self, db, seed):
        assert ids(db, seed, kind="promocion") == {"ana", "bea"}

    def test_con_cita_proxima_dentro_del_rango(self, db, seed):
        add_cita(db, seed, "ana", 3)
        add_cita(db, seed, "bea", 45)
        add_cita(db, seed, "eva", 2, status="cancelled")
        assert ids(db, seed, "upcoming_appointment", days=30) == {"ana"}

    def test_sin_visitas_en_n_dias(self, db, seed):
        add_cita(db, seed, "ana", -10, status="completed")
        add_cita(db, seed, "bea", -90, status="completed")
        add_cita(db, seed, "eva", -5, status="no_show")
        assert ids(db, seed, "inactive", days=30) == {"bea", "eva"}

    def test_con_retoque_proximo(self, db, seed):
        target = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=5)
        db.add(Tracking(client_id=seed["bea"].id, last_application_date=datetime.utcnow(),
                        next_maintenance_date=target))
        db.commit()
        assert ids(db, seed, "retouch_due", days=15) == {"bea"}

    def test_resumen_por_canal(self, db, seed):
        summary = summarize_audience(db, audience_client_ids(db, AudienceSpec("all", "aviso")))
        assert (summary.clients, summary.with_push, summary.with_email) == (3, 1, 2)

    def test_endpoint_preview(self, client, db, seed):
        resp = client.get("/broadcasts/audience", params={"kind": "promocion"}, headers=login(client, "admin_b"))
        assert resp.status_code == 200
        assert resp.json() == {"clients": 2, "with_push": 1, "with_email": 2, "email_daily_limit": 500}


# ── Envío ────────────────────────────────────────────────────────────────────

class TestEnvio:
    def test_sin_permiso_403(self, client, db, seed):
        resp = client.post("/broadcasts", json=payload(), headers=login(client, "cajera_b"))
        assert resp.status_code == 403

    def test_envia_push_en_segundo_plano(self, client, db, seed, fcm):
        resp = client.post("/broadcasts", json=payload(), headers=login(client, "admin_b"))
        assert resp.status_code == 202, resp.text
        assert resp.json()["recipients_count"] == 3

        db.expire_all()
        broadcast = db.get(Broadcast, resp.json()["id"])
        assert (broadcast.status, broadcast.push_sent, broadcast.push_failed) == ("sent", 1, 0)
        assert db.query(BroadcastRecipient).count() == 3
        token, data, notification = fcm.calls[0]
        assert token == "token-ana-xxxxxxxxxxxx"
        assert data["type"] == "broadcast" and data["titulo"] == "Cerramos el lunes"
        assert "imagen_url" not in data and notification.image is None

    def test_imagen_solo_con_url_publica(self, client, db, seed, fcm, monkeypatch):
        monkeypatch.setattr(settings, "public_base_url", "https://elashes.test/api/")
        client.post("/broadcasts", json=payload(image_url=IMAGE), headers=login(client, "admin_b"))
        _, data, notification = fcm.calls[0]
        assert notification.image == data["imagen_url"] == f"https://elashes.test/api{IMAGE}"

    def test_imagen_externa_422(self, client, db, seed):
        resp = client.post("/broadcasts", json=payload(image_url="https://otro.com/x.jpg"),
                           headers=login(client, "admin_b"))
        assert resp.status_code == 422

    def test_sin_canales_422(self, client, db, seed):
        resp = client.post("/broadcasts", json=payload(send_push=False), headers=login(client, "admin_b"))
        assert resp.status_code == 422

    def test_correo_por_lotes_cuenta_rechazados(self, client, db, seed, outbox):
        resp = client.post("/broadcasts", json=payload(kind="promocion", send_push=False, send_email=True),
                           headers=login(client, "admin_b"))
        assert resp.status_code == 202, resp.text
        db.expire_all()
        broadcast = db.get(Broadcast, resp.json()["id"])
        assert outbox == ["ana@test.com"]
        assert (broadcast.email_sent, broadcast.email_failed, broadcast.email_from) == (1, 1, "salon@test.com")

    def test_correo_sin_smtp_503(self, client, db, seed, monkeypatch):
        monkeypatch.setattr(settings, "smtp_host", None)
        resp = client.post("/broadcasts", json=payload(send_email=True), headers=login(client, "admin_b"))
        assert resp.status_code == 503

    def test_rol_acotado_solo_su_sucursal(self, client, db, seed, fcm):
        resp = client.post("/broadcasts", json=payload(branch_id=seed["norte"].id),
                           headers=login(client, "operaria_b"))
        assert resp.status_code == 202
        assert resp.json()["branch_id"] == seed["centro"].id
        assert resp.json()["recipients_count"] == 2

    def test_grupo_vacio_400(self, client, db, seed):
        resp = client.post("/broadcasts", json=payload(audience="upcoming_appointment"),
                           headers=login(client, "admin_b"))
        assert resp.status_code == 400

    def test_otro_enviandose_409(self, client, db, seed):
        db.add(Broadcast(kind="aviso", title="t", body="b", audience="all", status="sending"))
        db.commit()
        resp = client.post("/broadcasts", json=payload(), headers=login(client, "admin_b"))
        assert resp.status_code == 409

    def test_fallo_inesperado_queda_interrumpido(self, client, db, seed, monkeypatch):
        def boom(*args, **kwargs):
            raise RuntimeError("se cayó")

        monkeypatch.setattr(delivery, "_deliver_push", boom)
        resp = client.post("/broadcasts", json=payload(), headers=login(client, "admin_b"))
        detail = client.get(f"/broadcasts/{resp.json()['id']}", headers=login(client, "admin_b"))
        assert detail.json()["status"] == "interrupted"

    def test_historial(self, client, db, seed, fcm):
        headers = login(client, "admin_b")
        client.post("/broadcasts", json=payload(), headers=headers)
        history = client.get("/broadcasts", headers=headers).json()
        assert [b["title"] for b in history] == ["Cerramos el lunes"]
        assert history[0]["created_by_name"] == "admin_b"


# ── Clientas específicas y detalle ───────────────────────────────────────────

class TestIndividualYDetalle:
    def test_grupo_de_clientas_elegidas(self, db, seed):
        chosen = (seed["ana"].id, seed["eva"].id)
        assert ids(db, seed, "selected", client_ids=chosen) == {"ana", "eva"}
        # Una promoción tampoco le llega si apagó sus notificaciones.
        assert ids(db, seed, "selected", kind="promocion", client_ids=chosen) == {"ana"}

    def test_elegidas_sin_clientas_422(self, client, db, seed):
        resp = client.post("/broadcasts", json=payload(audience="selected"), headers=login(client, "admin_b"))
        assert resp.status_code == 422

    def test_preview_de_elegidas(self, client, db, seed):
        resp = client.get("/broadcasts/audience", headers=login(client, "admin_b"),
                          params={"audience": "selected", "client_ids": [seed["ana"].id, seed["bea"].id]})
        assert resp.json()["clients"] == 2 and resp.json()["with_push"] == 1

    def test_resultado_por_clienta(self, client, db, seed, fcm, outbox):
        headers = login(client, "admin_b")
        resp = client.post("/broadcasts", json=payload(send_email=True), headers=headers)
        rows = client.get(f"/broadcasts/{resp.json()['id']}/recipients", headers=headers).json()
        by_name = {row["name"]: (row["push_status"], row["email_status"]) for row in rows}
        assert by_name == {
            "Ana Lopez": ("sent", "sent"),
            "Bea Perez": ("no_app", "failed"),
            "Eva Rojas": ("no_app", "no_email"),
        }
        assert rows[0]["branch_name"] == "Centro"

    def test_push_fallido_por_clienta(self, client, db, seed, fcm):
        fcm.results["token-ana-xxxxxxxxxxxx"] = FcmResult.ERROR
        headers = login(client, "admin_b")
        resp = client.post("/broadcasts", json=payload(audience="selected", client_ids=[seed["ana"].id]),
                           headers=headers)
        rows = client.get(f"/broadcasts/{resp.json()['id']}/recipients", headers=headers).json()
        assert [(r["push_status"], r["email_status"]) for r in rows] == [("failed", None)]

    def test_buscador_de_clientas(self, client, db, seed):
        resp = client.get("/broadcasts/clients", params={"search": "lop"}, headers=login(client, "admin_b"))
        assert resp.json() == [{
            "id": seed["ana"].id, "name": "Ana Lopez", "branch_name": "Centro",
            "has_app": True, "has_email": True, "notificaciones_activas": True,
        }]

    def test_buscador_rol_acotado_solo_su_sucursal(self, client, db, seed):
        resp = client.get("/broadcasts/clients", params={"search": "Perez"}, headers=login(client, "operaria_b"))
        assert resp.json() == []


JPEG_BYTES = b"\xff\xd8\xff\xe0 imagen de prueba"


@pytest.fixture
def media_dir(monkeypatch, tmp_path):
    """MEDIA_ROOT temporal con la imagen IMAGE guardada en disco."""
    monkeypatch.setattr(media, "MEDIA_ROOT", str(tmp_path))
    (tmp_path / "broadcasts").mkdir()
    (tmp_path / IMAGE.removeprefix("/media/")).write_bytes(JPEG_BYTES)
    return tmp_path


class TestCorreoConImagen:
    def test_vista_previa_misma_plantilla_con_imagen_embebida(self, client, db, seed, media_dir):
        resp = client.post("/broadcasts/email-preview", headers=login(client, "admin_b"),
                           json={"kind": "promocion", "title": "2x1 <hoy>", "body": "Línea 1\nLínea 2",
                                 "image_url": IMAGE})
        assert resp.status_code == 200
        html = resp.json()["html"]
        assert resp.json()["subject"] == "2x1 <hoy>"
        assert "2x1 &lt;hoy&gt;" in html and "Línea 1<br>Línea 2" in html
        # Sin PUBLIC_BASE_URL igual se ve: el navegador no entiende cid:, así que va como data:.
        assert 'src="data:image/jpeg;base64,' in html and "cid:" not in html
        assert "no quieres recibir promociones" in html

    def test_imagen_que_ya_no_existe_no_rompe_el_correo(self, client, db, seed, media_dir):
        (media_dir / IMAGE.removeprefix("/media/")).unlink()
        resp = client.post("/broadcasts/email-preview", headers=login(client, "admin_b"),
                           json={"kind": "aviso", "title": "Feriado", "body": "Cerramos", "image_url": IMAGE})
        assert "<img" not in resp.json()["html"]
        assert "no quieres recibir promociones" not in resp.json()["html"]

    def test_el_correo_lleva_la_imagen_incrustada(self, client, db, seed, media_dir, monkeypatch):
        messages = []

        class FakeServer:
            def send_message(self, message):
                messages.append(message)

        @contextmanager
        def fake_connection():
            yield FakeServer()

        monkeypatch.setattr(delivery, "smtp_connection", fake_connection)
        monkeypatch.setattr(settings, "smtp_host", "smtp.test.com")
        monkeypatch.setattr(settings, "smtp_from_email", "salon@test.com")
        client.post("/broadcasts", headers=login(client, "admin_b"),
                    json=payload(send_push=False, send_email=True, image_url=IMAGE))

        message = messages[0]
        image = next(part for part in message.walk() if part.get_content_maintype() == "image")
        cid = image["Content-ID"].strip("<>")
        html = message.get_body(preferencelist=("html",)).get_content()
        assert f'src="cid:{cid}"' in html
        assert image.get_content_disposition() == "inline"
        assert image.get_filename() == "comunicado.jpg"
        assert image.get_payload(decode=True) == JPEG_BYTES
        assert message.get_body(preferencelist=("plain",)).get_content().startswith("Cerramos el lunes")

    def test_sin_permiso_403(self, client, db, seed):
        resp = client.post("/broadcasts/email-preview", headers=login(client, "cajera_b"),
                           json={"kind": "aviso", "title": "t", "body": "b"})
        assert resp.status_code == 403


def test_read_media_file_no_sale_de_media_root(media_dir):
    assert media.read_media_file(IMAGE) == JPEG_BYTES
    assert media.read_media_file("/media/../secreto.txt") is None
    assert media.read_media_file("/otra/ruta.jpg") is None


# ── App y mantenimiento ──────────────────────────────────────────────────────

class TestBandejaYReinicio:
    def _broadcast(self, db, seed, *, days_ago=0, send_push=True, status="sent") -> Broadcast:
        broadcast = Broadcast(kind="promocion", title="2x1", body="Solo hoy", audience="all", status=status,
                              send_push=send_push, created_at=datetime.utcnow() - timedelta(days=days_ago))
        db.add(broadcast)
        db.flush()
        db.add(BroadcastRecipient(broadcast_id=broadcast.id, client_id=seed["ana"].id))
        db.commit()
        return broadcast

    def test_bandeja_solo_recientes_con_push(self, db, seed):
        self._broadcast(db, seed)
        self._broadcast(db, seed, days_ago=8)
        self._broadcast(db, seed, send_push=False)
        feed = client_broadcast_feed(db, seed["ana"].id)
        assert [item["titulo"] for item in feed] == ["2x1"]
        assert feed[0]["categoria"] == "promocion" and feed[0]["imagen_url"] is None
        assert client_broadcast_feed(db, seed["bea"].id) == []

    def test_reinicio_marca_interrumpidos(self, db, seed):
        broadcast = self._broadcast(db, seed, status="sending")
        assert mark_interrupted_broadcasts(db) == 1
        db.refresh(broadcast)
        assert broadcast.status == "interrupted" and broadcast.finished_at is not None


def test_fcm_manda_imagen_en_android_e_ios(monkeypatch):
    sent = {}

    class Response:
        status_code = 200

    def fake_post(url, json, headers, timeout):
        sent.update(json["message"])
        return Response()

    client = FcmClient(credentials=None, project_id="p")
    monkeypatch.setattr(client, "_access_token", lambda: "tok")
    monkeypatch.setattr("app.infrastructure.push.fcm_client.httpx.post", fake_post)
    image = "https://elashes.test/api/media/broadcasts/x.jpg"
    client.send_data("t", {"a": "1"}, FcmNotification("T", "B", "canal", "tag", image=image))

    assert sent["notification"]["image"] == image
    assert sent["apns"]["fcm_options"]["image"] == image
    assert sent["apns"]["payload"]["aps"]["mutable-content"] == 1
