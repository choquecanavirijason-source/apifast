"""
Recordatorio manual por correo (Atención > Próximas citas, canales Push/Correo):
  - POST /agenda/appointments/{id}/reminder con send_push / send_email;
  - solo correo: no llega a la app y se rechaza si no se puede enviar;
  - plantilla HTML (datos de la cita, escapado) y cliente SMTP simulado
    (nunca se conecta a un servidor real);
  - GET /clients/citas-proximas indica si la clienta tiene correo.

Reutiliza los datos y fixtures de test_manual_reminders.

Ejecutar:
  cd elashesbackend
  pytest tests/test_reminder_email.py -v
"""
from __future__ import annotations

import pytest

from app.application.services import reminder_email_service
from app.application.services.appointment_notice_service import get_scheduled_notices
from app.application.services.reminder_email_service import build_reminder_email, format_fecha
from app.config.settings import settings
from app.domain.entities.manual_reminder import ManualReminder
from app.infrastructure.email import smtp_client
from tests.test_manual_reminders import (  # noqa: F401  (fixtures)
    MSG,
    add_cita,
    client,
    db,
    login,
    manuales,
    seed,
    setup_db,
    ws_events,
)

ANA_EMAIL = "ana.lopez@example.com"


@pytest.fixture
def outbox(monkeypatch) -> list[dict]:
    """SMTP configurado y simulado: cada correo enviado queda en la lista."""
    sent: list[dict] = []

    def fake_send(to, subject, html, text):
        sent.append({"to": to, "subject": subject, "html": html, "text": text})
        return True

    monkeypatch.setattr(reminder_email_service, "is_email_configured", lambda: True)
    monkeypatch.setattr(reminder_email_service, "send_email", fake_send)
    return sent


@pytest.fixture
def ana_con_email(db, seed):
    seed["ana"].email = ANA_EMAIL
    db.commit()
    return seed["ana"]


def send(client, headers, appointment_id, **channels):
    return client.post(
        f"/agenda/appointments/{appointment_id}/reminder",
        json={"message": MSG, **channels},
        headers=headers,
    )


# ── Endpoint ─────────────────────────────────────────────────────────────────

class TestCanales:
    def test_por_defecto_solo_push_sin_correo(self, client, db, seed, ws_events, outbox, ana_con_email):
        appt = add_cita(db, seed)
        resp = send(client, login(client, "admin_r"), appt.id)
        assert resp.status_code == 201, resp.text
        assert resp.json()["send_push"] is True
        assert resp.json()["email_status"] is None
        assert outbox == []
        assert len(ws_events) == 1

    def test_push_y_correo(self, client, db, seed, ws_events, outbox, ana_con_email):
        appt = add_cita(db, seed)
        resp = send(client, login(client, "admin_r"), appt.id, send_email=True)
        assert resp.status_code == 201, resp.text
        assert resp.json()["email_status"] == "sent"
        [mail] = outbox
        assert mail["to"] == ANA_EMAIL
        assert MSG in mail["text"]
        assert len(ws_events) == 1
        assert db.query(ManualReminder).one().email_status == "sent"

    def test_solo_correo_no_llega_a_la_app(self, client, db, seed, ws_events, outbox, ana_con_email):
        appt = add_cita(db, seed)
        resp = send(client, login(client, "admin_r"), appt.id, send_push=False, send_email=True)
        assert resp.status_code == 201, resp.text
        assert resp.json()["send_push"] is False
        assert len(outbox) == 1
        assert ws_events == []
        assert manuales(get_scheduled_notices(db, seed["ana"].id)) == []
        assert db.query(ManualReminder).one().send_push is False

    def test_sin_canales_400(self, client, db, seed, ws_events):
        appt = add_cita(db, seed)
        resp = send(client, login(client, "admin_r"), appt.id, send_push=False)
        assert resp.status_code == 400
        assert db.query(ManualReminder).count() == 0

    def test_solo_correo_sin_email_400(self, client, db, seed, ws_events, outbox):
        appt = add_cita(db, seed)
        resp = send(client, login(client, "admin_r"), appt.id, send_push=False, send_email=True)
        assert resp.status_code == 400
        assert "correo" in resp.json()["detail"]
        assert db.query(ManualReminder).count() == 0

    def test_solo_correo_sin_smtp_503(self, client, db, seed, ws_events, ana_con_email, monkeypatch):
        monkeypatch.setattr(reminder_email_service, "is_email_configured", lambda: False)
        appt = add_cita(db, seed)
        resp = send(client, login(client, "admin_r"), appt.id, send_push=False, send_email=True)
        assert resp.status_code == 503
        assert db.query(ManualReminder).count() == 0

    def test_push_y_correo_sin_email_guarda_y_avisa(self, client, db, seed, ws_events, outbox):
        appt = add_cita(db, seed)
        resp = send(client, login(client, "admin_r"), appt.id, send_email=True)
        assert resp.status_code == 201
        assert resp.json()["email_status"] == "no_email"
        assert outbox == []
        assert len(ws_events) == 1

    def test_fallo_smtp_no_deshace_el_recordatorio(self, client, db, seed, ws_events, ana_con_email, monkeypatch):
        monkeypatch.setattr(reminder_email_service, "is_email_configured", lambda: True)
        monkeypatch.setattr(reminder_email_service, "send_email", lambda *a: False)
        appt = add_cita(db, seed)
        resp = send(client, login(client, "admin_r"), appt.id, send_email=True)
        assert resp.status_code == 201
        assert resp.json()["email_status"] == "failed"
        assert db.query(ManualReminder).one().email_status == "failed"


class TestProximasCitas:
    def test_indica_si_tiene_email(self, client, db, seed, ana_con_email):
        add_cita(db, seed)
        add_cita(db, seed, client="bea", branch="norte")
        resp = client.get("/clients/citas-proximas", params={"dias": 7}, headers=login(client, "admin_r"))
        assert resp.status_code == 200, resp.text
        by_client = {row["client_id"]: row["tiene_email"] for row in resp.json()}
        assert by_client == {seed["ana"].id: True, seed["bea"].id: False}


# ── Plantilla ────────────────────────────────────────────────────────────────

class TestPlantilla:
    def test_incluye_los_datos_de_la_cita(self, db, seed, ana_con_email):
        appt = add_cita(db, seed)
        subject, html, text = build_reminder_email(appt, MSG)
        fecha = format_fecha(appt.start_time)
        hora = appt.start_time.strftime("%H:%M")
        assert fecha in subject and hora in subject
        for value in ("Ana Lopez", "Extensiones", fecha, hora, "Centro"):
            assert value in html
            assert value in text

    def test_escapa_el_mensaje(self, db, seed):
        appt = add_cita(db, seed)
        _, html, _ = build_reminder_email(appt, "<script>alert(1)</script>")
        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_fecha_en_espanol(self):
        from datetime import datetime
        assert format_fecha(datetime(2026, 10, 27, 10, 0)) == "martes 27 de octubre de 2026"


# ── Cliente SMTP ─────────────────────────────────────────────────────────────

class FakeSMTP:
    instances: list["FakeSMTP"] = []

    def __init__(self, host, port, timeout=None, **_kwargs):
        self.host, self.port, self.timeout = host, port, timeout
        self.calls: list[str] = []
        self.sent = []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(f"login:{user}")

    def send_message(self, message):
        self.sent.append(message)


@pytest.fixture
def gmail(monkeypatch):
    FakeSMTP.instances = []
    monkeypatch.setattr(settings, "smtp_host", "smtp.gmail.com")
    monkeypatch.setattr(settings, "smtp_port", 587)
    monkeypatch.setattr(settings, "smtp_username", "salon@gmail.com")
    monkeypatch.setattr(settings, "smtp_password", "app-password")
    monkeypatch.setattr(settings, "smtp_from_email", None)
    monkeypatch.setattr(settings, "smtp_use_tls", True)
    monkeypatch.setattr(smtp_client.smtplib, "SMTP", FakeSMTP)


class TestSmtpClient:
    def test_sin_host_no_configurado(self, monkeypatch):
        monkeypatch.setattr(settings, "smtp_host", None)
        assert smtp_client.is_email_configured() is False
        assert smtp_client.send_email("a@b.com", "s", "<p>h</p>", "t") is False

    def test_envia_con_starttls_y_login(self, gmail):
        assert smtp_client.send_email(ANA_EMAIL, "Asunto", "<p>Hola</p>", "Hola") is True
        [server] = FakeSMTP.instances
        assert (server.host, server.port) == ("smtp.gmail.com", 587)
        assert server.calls == ["starttls", "login:salon@gmail.com"]
        [message] = server.sent
        assert message["To"] == ANA_EMAIL
        assert "salon@gmail.com" in message["From"]  # remitente = usuario si no hay from
        assert message.get_body(("html",)).get_content().strip() == "<p>Hola</p>"
        assert message.get_body(("plain",)).get_content().strip() == "Hola"

    def test_error_smtp_devuelve_false_sin_exponer_datos(self, gmail, monkeypatch, caplog):
        def boom(self, message):
            raise smtp_client.smtplib.SMTPAuthenticationError(535, b"bad credentials")
        monkeypatch.setattr(FakeSMTP, "send_message", boom)
        with caplog.at_level("WARNING", logger="elashes.email"):
            assert smtp_client.send_email(ANA_EMAIL, "s", "<p>h</p>", "t") is False
        assert ANA_EMAIL not in caplog.text and "app-password" not in caplog.text
        assert "a…@example.com" in caplog.text
