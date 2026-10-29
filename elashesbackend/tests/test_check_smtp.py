"""Diagnóstico de la configuración SMTP (app/infrastructure/email/check_smtp.py)."""
import smtplib
import socket
from contextlib import contextmanager

import pytest

from app.config.settings import settings
from app.infrastructure.email import check_smtp


@pytest.fixture
def smtp_env(monkeypatch):
    for name, value in {
        "smtp_host": "mail.elashes.test", "smtp_port": 587, "smtp_use_tls": True,
        "smtp_username": "avisos@elashes.test", "smtp_password": "secreto", "smtp_from_email": None,
    }.items():
        monkeypatch.setattr(settings, name, value)


def test_avisa_lo_que_falta(monkeypatch, smtp_env, capsys):
    monkeypatch.setattr(settings, "smtp_password", "")
    assert check_smtp.check() is False
    assert "SMTP_PASSWORD" in capsys.readouterr().out


@pytest.mark.parametrize("port, use_tls, expected", [
    (465, True, "SMTP_USE_TLS=false"),
    (587, False, "SMTP_USE_TLS=true"),
    (587, True, None),
    (465, False, None),
])
def test_puerto_y_cifrado(monkeypatch, smtp_env, port, use_tls, expected):
    monkeypatch.setattr(settings, "smtp_port", port)
    monkeypatch.setattr(settings, "smtp_use_tls", use_tls)
    warning = check_smtp.tls_mismatch()
    assert (warning is None) if expected is None else (expected in warning)


@pytest.mark.parametrize("exc, expected", [
    (socket.gaierror(), "No existe el servidor"),
    (TimeoutError(), "puerto está bloqueado"),
    (ConnectionRefusedError(), "rechazó la conexión"),
    (smtplib.SMTPAuthenticationError(535, b"bad"), "contraseña incorrectos"),
])
def test_explica_cada_error(smtp_env, exc, expected):
    assert expected in check_smtp.explain_error(exc)


def test_envia_correo_de_prueba(monkeypatch, smtp_env, capsys):
    sent = []

    class FakeServer:
        def send_message(self, message):
            sent.append(message["To"])

    @contextmanager
    def fake_connection():
        yield FakeServer()

    monkeypatch.setattr(check_smtp, "smtp_connection", fake_connection)
    assert check_smtp.check("yo@test.com") is True
    assert sent == ["yo@test.com"]
    assert "aceptó el correo" in capsys.readouterr().out
