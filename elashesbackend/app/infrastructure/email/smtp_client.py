"""
Cliente SMTP mínimo (smtplib de la librería estándar, sin dependencias).

Pensado para Gmail (smtp.gmail.com:587 con STARTTLS y una contraseña de
aplicación), pero vale cualquier servidor SMTP. Configuración en settings.smtp_*;
sin host o sin remitente, is_email_configured() es False y no se envía nada.

Nunca se registra la contraseña ni la dirección completa del destinatario en
los logs (ver mask_email).
"""
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional

from app.config.settings import settings

logger = logging.getLogger("elashes.email")
# Igual que en fcm_client: sin handler propio solo se verían los WARNING.
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s: %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)


def mask_email(address: Optional[str]) -> str:
    """'ana.lopez@gmail.com' -> 'a…@gmail.com'."""
    if not address or "@" not in address:
        return "<vacío>"
    local, domain = address.rsplit("@", 1)
    return f"{local[:1]}…@{domain}"


def _sender() -> Optional[str]:
    return (settings.smtp_from_email or settings.smtp_username or "").strip() or None


def is_email_configured() -> bool:
    return bool((settings.smtp_host or "").strip() and _sender())


def send_email(to: str, subject: str, html: str, text: str) -> bool:
    """Envía un correo HTML con alternativa en texto plano. Nunca lanza:
    devuelve True si el servidor lo aceptó."""
    if not is_email_configured():
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((settings.smtp_from_name, _sender()))
    message["To"] = to
    message.set_content(text)
    message.add_alternative(html, subtype="html")

    host = settings.smtp_host.strip()
    port = settings.smtp_port
    timeout = settings.smtp_timeout_seconds
    context = ssl.create_default_context()
    try:
        if settings.smtp_use_tls:
            server = smtplib.SMTP(host, port, timeout=timeout)
        else:
            server = smtplib.SMTP_SSL(host, port, timeout=timeout, context=context)
        with server:
            if settings.smtp_use_tls:
                server.starttls(context=context)
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
    except Exception as exc:  # red, timeout, credenciales rechazadas...
        logger.warning("Correo: no se pudo enviar a %s: %s", mask_email(to), type(exc).__name__)
        return False
    logger.info("Correo enviado a %s.", mask_email(to))
    return True
