"""
Correo de los recordatorios manuales (Atención > Próximas citas, canal
"Correo"). Se envía a Client.email después de guardar el recordatorio; es de
mejor esfuerzo: el resultado queda en manual_reminders.email_status y vuelve
al panel en la respuesta, pero un fallo nunca deshace el recordatorio.
"""
import logging
from datetime import datetime
from html import escape
from typing import Optional

from sqlalchemy.orm import Session

from app.application.services.appointment_notice_service import (
    RECORDATORIO_MANUAL_TITULO,
    appointment_service_names,
)
from app.domain.entities.manual_reminder import (
    EMAIL_FAILED,
    EMAIL_NO_ADDRESS,
    EMAIL_NOT_CONFIGURED,
    EMAIL_SENT,
    ManualReminder,
)
from app.domain.entities.service_agenda import Appointment
from app.infrastructure.email.smtp_client import is_email_configured, send_email

logger = logging.getLogger("elashes.email")

_DIAS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
_MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)


def client_email(appointment: Appointment) -> Optional[str]:
    email = (appointment.client.email or "").strip() if appointment.client else ""
    return email or None


def email_unavailable_reason(appointment: Appointment) -> Optional[str]:
    """Por qué no se podría enviar el correo de esta cita, o None si se puede."""
    if not is_email_configured():
        return EMAIL_NOT_CONFIGURED
    if not client_email(appointment):
        return EMAIL_NO_ADDRESS
    return None


def format_fecha(start_time: datetime) -> str:
    """'martes 21 de octubre de 2026' (start_time ya está en hora de La Paz)."""
    return (
        f"{_DIAS[start_time.weekday()]} {start_time.day} de "
        f"{_MESES[start_time.month - 1]} de {start_time.year}"
    )


def reminder_email_details(appointment: Appointment) -> dict[str, str]:
    client = appointment.client
    names = appointment_service_names(appointment) or (
        [appointment.service.name] if appointment.service else []
    )
    return {
        "clienta": f"{client.name} {client.last_name}".strip(),
        "nombre": client.name.strip() or client.last_name.strip(),
        "servicio": ", ".join(names) or "—",
        "fecha": format_fecha(appointment.start_time),
        "hora": appointment.start_time.strftime("%H:%M"),
        "sucursal": appointment.branch.name if appointment.branch else "—",
        "direccion": (appointment.branch.address or "").strip() if appointment.branch else "",
    }


def build_reminder_email(appointment: Appointment, message: str) -> tuple[str, str, str]:
    """(asunto, html, texto plano). Todo dato de la BD o del panel se escapa."""
    d = reminder_email_details(appointment)
    subject = f"{RECORDATORIO_MANUAL_TITULO}: {d['fecha']} a las {d['hora']}"
    sucursal = d["sucursal"] + (f" · {d['direccion']}" if d["direccion"] else "")

    rows = [
        ("Clienta", d["clienta"]),
        ("Servicio", d["servicio"]),
        ("Fecha", d["fecha"]),
        ("Hora", d["hora"]),
        ("Sucursal", sucursal),
    ]
    rows_html = "".join(
        f'<tr><td style="padding:10px 0;border-bottom:1px solid #f1e4ea;color:#8a7380;'
        f'font-size:13px;width:110px;vertical-align:top;">{escape(label)}</td>'
        f'<td style="padding:10px 0;border-bottom:1px solid #f1e4ea;color:#2d1f27;'
        f'font-size:15px;font-weight:600;">{escape(value)}</td></tr>'
        for label, value in rows
    )
    message_html = escape(message).replace("\n", "<br>")

    html = f"""<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f2f4;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f2f4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;">
<tr><td style="background:#2d1f27;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;">Elashes</td></tr>
<tr><td style="padding:28px;">
<p style="margin:0 0 6px;color:#2d1f27;font-size:18px;font-weight:700;">{escape(RECORDATORIO_MANUAL_TITULO)}</p>
<p style="margin:0 0 20px;color:#5c4a54;font-size:15px;line-height:1.5;">{message_html}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows_html}</table>
<p style="margin:22px 0 0;color:#8a7380;font-size:13px;line-height:1.5;">Si necesitas cambiar o cancelar tu cita, comunícate con la sucursal.</p>
</td></tr>
<tr><td style="padding:16px 28px;background:#fbf7f9;color:#a8949f;font-size:11px;">Este es un mensaje automático; no respondas a este correo.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""

    text = "\n".join(
        [RECORDATORIO_MANUAL_TITULO, "", message, ""]
        + [f"{label}: {value}" for label, value in rows]
        + ["", "Si necesitas cambiar o cancelar tu cita, comunícate con la sucursal."]
    )
    return subject, html, text


def send_reminder_email(
    db: Session, reminder: ManualReminder, appointment: Appointment, email_from: Optional[str] = None
) -> str:
    """Envía el correo (desde email_from si viene; ya validado en
    send_manual_reminder) y guarda el resultado en reminder.email_status.
    Nunca lanza; devuelve el estado (ver EMAIL_STATUSES)."""
    status_value = email_unavailable_reason(appointment)
    if status_value is None:
        try:
            subject, html, text = build_reminder_email(appointment, reminder.message)
            sent = send_email(client_email(appointment), subject, html, text, from_email=email_from)
        except Exception as exc:
            logger.warning("Correo: falló el recordatorio %s: %s", reminder.id, type(exc).__name__)
            sent = False
        status_value = EMAIL_SENT if sent else EMAIL_FAILED
    try:
        reminder.email_status = status_value
        db.commit()
    except Exception as exc:
        logger.warning("Correo: no se guardó el estado del recordatorio %s: %s", reminder.id, type(exc).__name__)
        db.rollback()
    return status_value
