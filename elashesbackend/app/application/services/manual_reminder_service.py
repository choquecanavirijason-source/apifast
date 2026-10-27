"""
Recordatorios manuales: el salón le envía a una clienta un mensaje sobre su
cita desde Atención > Próximas citas. Se guarda en manual_reminders y la app
lo recibe como aviso "recordatorio_manual" (GET /avisos/programados) y, si
está conectada, por el WebSocket de la clienta (lo emite el controller).
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Query, Session

from app.application.services.appointment_notice_service import (
    FINAL_STATUSES,
    LA_PAZ,
    manual_reminder_aviso,
)
from app.application.services.reminder_email_service import email_unavailable_reason
from app.core.audit import record_audit
from app.core.dependencies import resolve_branch_id
from app.domain.entities.manual_reminder import (
    EMAIL_NO_ADDRESS,
    EMAIL_NOT_CONFIGURED,
    ManualReminder,
)
from app.domain.entities.service_agenda import Appointment
from app.domain.entities.user import User
from app.infrastructure.email.smtp_client import resolve_sender, sender_address

def last_reminders_by_appointment(db: Session, appointment_ids: list[int]) -> dict[int, datetime]:
    """Último envío (UTC naive) de cada cita; las que no tienen no aparecen."""
    if not appointment_ids:
        return {}
    rows = (
        db.query(ManualReminder.appointment_id, func.max(ManualReminder.created_at))
        .filter(ManualReminder.appointment_id.in_(appointment_ids))
        .group_by(ManualReminder.appointment_id)
        .all()
    )
    return dict(rows)


def lock_appointment_query(db: Session, appointment_id: int) -> Query:
    """SELECT ... FOR UPDATE de la fila de la cita, sin joins.

    No añadir joinedload aquí: el LEFT OUTER JOIN que genera hace que
    PostgreSQL rechace el FOR UPDATE ("cannot be applied to the nullable side
    of an outer join"). SQLite ignora FOR UPDATE, así que los tests con SQLite
    no lo ven (ver test_manual_reminders.TestBloqueoEnPostgres). La clienta se
    carga después, en una consulta aparte. `of=Appointment` acota el bloqueo a
    appointments aunque alguien sume un join en el futuro."""
    return (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .with_for_update(of=Appointment)
    )


def send_manual_reminder(
    db: Session,
    appointment_id: int,
    message: str,
    user: User,
    now_utc: Optional[datetime] = None,
    send_push: bool = True,
    send_email: bool = False,
    email_from: Optional[str] = None,
) -> tuple[ManualReminder, dict]:
    """Valida y guarda el recordatorio. Devuelve (recordatorio, aviso) — el
    aviso es el mismo que verá en /avisos/programados, para emitirlo por WS.
    El correo no se envía aquí (lo hace el controller después de guardar);
    solo se rechaza de antemano si es el único canal y no se puede enviar.
    email_from: remitente elegido en el panel; debe estar en allowed_senders()."""
    now_utc = now_utc or datetime.now(timezone.utc)
    now_utc_naive = now_utc.replace(tzinfo=None)

    # Mantiene estable la cita mientras se valida y registra el envío.
    appointment = lock_appointment_query(db, appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cita no encontrada")

    # Roles acotados a su sucursal (si se les da el permiso) solo envían a
    # citas de esa sucursal.
    if resolve_branch_id(appointment.branch_id, user) != appointment.branch_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes enviar recordatorios de citas de tu sucursal.",
        )
    if appointment.status in FINAL_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La cita ya está cerrada; no se puede enviar un recordatorio.",
        )
    if appointment.start_time <= now_utc.astimezone(LA_PAZ).replace(tzinfo=None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La hora de la cita ya pasó; no se puede enviar un recordatorio.",
        )

    if not send_push and not send_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Elige al menos un canal de envío (push o correo).",
        )
    # Un remitente no autorizado se rechaza aunque también vaya push: si no,
    # el panel creería que el correo salió desde esa cuenta.
    if send_email and email_from and not resolve_sender(email_from):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El correo emisor {email_from} no está autorizado en el servidor (SMTP_ALLOWED_FROM).",
        )
    # La clienta se carga aquí (consulta aparte, sin bloqueo), no en la de arriba.
    if send_email and not send_push:
        reason = email_unavailable_reason(appointment)
        if reason == EMAIL_NOT_CONFIGURED:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="El envío de correos no está configurado en el servidor.",
            )
        if reason == EMAIL_NO_ADDRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La clienta no tiene correo registrado.",
            )

    reminder = ManualReminder(
        appointment_id=appointment.id,
        client_id=appointment.client_id,
        message=message,
        sent_by=user.id,
        created_at=now_utc_naive,
        send_push=send_push,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)

    clienta = f"{appointment.client.name} {appointment.client.last_name}".strip()
    canales = " y ".join(
        nombre for nombre, activo in (("push", send_push), ("correo", send_email)) if activo
    )
    sender = resolve_sender(email_from) if send_email else None
    if sender and sender != sender_address():
        canales += f"; desde {sender}"
    record_audit(
        db, user, "create", "manual_reminder", reminder.id,
        f"Envió un recordatorio ({canales}) de la cita #{appointment.id} a '{clienta}'",
        branch_id=appointment.branch_id,
    )
    return reminder, manual_reminder_aviso(reminder, appointment)
