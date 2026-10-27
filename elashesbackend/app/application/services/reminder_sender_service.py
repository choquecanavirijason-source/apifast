"""
Remitentes de los recordatorios por correo (Atención > Próximas citas).

Los permitidos son los del .env (SMTP_FROM_EMAIL y SMTP_ALLOWED_FROM, ver
smtp_client.env_senders) más los que un administrador agrega desde el panel
(tabla reminder_email_senders), que no necesitan reiniciar el servidor.
La comparación no distingue mayúsculas.
"""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.domain.entities.reminder_email_sender import ReminderEmailSender
from app.domain.entities.user import User
from app.infrastructure.email.smtp_client import env_senders, sender_address


def registered_senders(db: Session) -> list[ReminderEmailSender]:
    return db.query(ReminderEmailSender).order_by(ReminderEmailSender.email).all()


def allowed_senders(db: Session) -> list[str]:
    """Los del .env primero (el por defecto al inicio) y luego los del panel."""
    result = env_senders()
    seen = {address.lower() for address in result}
    for row in registered_senders(db):
        if row.email.lower() not in seen:
            result.append(row.email)
            seen.add(row.email.lower())
    return result


def resolve_sender(db: Session, from_email: Optional[str]) -> Optional[str]:
    """La dirección permitida que corresponde a from_email (vacío = la por
    defecto), o None si no está permitida."""
    wanted = (from_email or "").strip().lower()
    if not wanted:
        return sender_address()
    return next((a for a in allowed_senders(db) if a.lower() == wanted), None)


def add_sender(db: Session, email: str, user: User) -> ReminderEmailSender:
    """Registra un remitente. 409 si ya está permitido (en el .env o en la tabla)."""
    email = email.strip().lower()
    if email in {address.lower() for address in allowed_senders(db)}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El correo {email} ya está en la lista de remitentes.",
        )
    row = ReminderEmailSender(email=email, created_by=user.id)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:  # otro admin lo agregó a la vez
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El correo {email} ya está en la lista de remitentes.",
        )
    db.refresh(row)
    record_audit(
        db, user, "create", "reminder_email_sender", row.id,
        f"Agregó el remitente de recordatorios {email}",
    )
    return row


def delete_sender(db: Session, sender_id: int, user: User) -> None:
    """Quita un remitente agregado desde el panel (los del .env no se tocan)."""
    row = db.query(ReminderEmailSender).filter(ReminderEmailSender.id == sender_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Remitente no encontrado")
    email = row.email
    db.delete(row)
    db.commit()
    record_audit(
        db, user, "delete", "reminder_email_sender", sender_id,
        f"Quitó el remitente de recordatorios {email}",
    )
