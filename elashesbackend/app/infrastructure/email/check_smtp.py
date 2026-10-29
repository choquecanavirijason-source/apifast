"""
Prueba la configuración SMTP del .env sin pasar por el panel, y explica en
castellano qué falla (puerto bloqueado, contraseña, cifrado...).

  python -m app.infrastructure.email.check_smtp               # conecta e inicia sesión
  python -m app.infrastructure.email.check_smtp tu@correo.com # además envía un correo de prueba

Con Docker:
  docker compose exec backend python -m app.infrastructure.email.check_smtp tu@correo.com
"""
import smtplib
import socket
import ssl
import sys
from typing import Optional

from app.config.settings import settings
from app.infrastructure.email.smtp_client import build_message, sender_address, smtp_connection

SSL_PORT = 465


def missing_settings() -> list[str]:
    required = {
        "SMTP_HOST": settings.smtp_host,
        "SMTP_USERNAME": settings.smtp_username,
        "SMTP_PASSWORD": settings.smtp_password,
        "SMTP_FROM_EMAIL o SMTP_USERNAME": sender_address(),
    }
    return [name for name, value in required.items() if not (value or "").strip()]


def tls_mismatch() -> Optional[str]:
    """465 es SSL directo; el resto (587, 25) usa STARTTLS."""
    if settings.smtp_port == SSL_PORT and settings.smtp_use_tls:
        return "El puerto 465 usa SSL directo: pon SMTP_USE_TLS=false."
    if settings.smtp_port != SSL_PORT and not settings.smtp_use_tls:
        return f"El puerto {settings.smtp_port} usa STARTTLS: pon SMTP_USE_TLS=true (o usa el puerto 465)."
    return None


def explain_error(exc: Exception) -> str:
    """Qué significa cada error y qué revisar."""
    host, port = settings.smtp_host, settings.smtp_port
    if isinstance(exc, socket.gaierror):
        return f"No existe el servidor '{host}': revisa SMTP_HOST (y que su registro DNS exista)."
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return (f"'{host}' no responde en el puerto {port}: el puerto está bloqueado por un firewall "
                "(del VPS o del proveedor) o el servidor de correo está apagado.")
    if isinstance(exc, ConnectionRefusedError):
        return f"'{host}' rechazó la conexión en el puerto {port}: el servidor de correo no escucha en ese puerto."
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return "Usuario o contraseña incorrectos (SMTP_USERNAME / SMTP_PASSWORD)."
    if isinstance(exc, smtplib.SMTPNotSupportedError):
        return "El servidor no ofrece STARTTLS en este puerto: prueba el 465 con SMTP_USE_TLS=false."
    if isinstance(exc, (ssl.SSLError, smtplib.SMTPServerDisconnected)):
        return tls_mismatch() or f"Falló el cifrado TLS con '{host}': el certificado no es válido o el puerto no coincide."
    if isinstance(exc, smtplib.SMTPSenderRefused):
        return f"El servidor no deja enviar como {sender_address()}: esa cuenta no puede usar ese remitente."
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return "El servidor rechazó el destinatario de prueba."
    return f"Error inesperado: {type(exc).__name__}: {exc}"


def check(recipient: Optional[str] = None) -> bool:
    missing = missing_settings()
    if missing:
        print(f"Falta configurar en el .env: {', '.join(missing)}")
        return False
    print(f"Servidor: {settings.smtp_host}:{settings.smtp_port} "
          f"({'STARTTLS' if settings.smtp_use_tls else 'SSL'}) · remitente {sender_address()}")
    if warning := tls_mismatch():
        print(f"Aviso: {warning}")

    try:
        with smtp_connection() as server:
            print("OK: conectó e inició sesión.")
            if recipient:
                server.send_message(build_message(
                    recipient,
                    "Prueba de correo de Elashes",
                    "<p>Si lees esto, el correo del panel está bien configurado.</p>",
                    "Si lees esto, el correo del panel está bien configurado.",
                ))
                print(f"OK: el servidor aceptó el correo a {recipient}. Si no llega, revisa spam (SPF/DKIM/DMARC).")
    except Exception as exc:
        print(f"ERROR: {explain_error(exc)}")
        return False
    return True


if __name__ == "__main__":
    sys.exit(0 if check(sys.argv[1] if len(sys.argv) > 1 else None) else 1)
