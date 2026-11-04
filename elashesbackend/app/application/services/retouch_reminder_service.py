"""Manual retouch reminders reuse Broadcast delivery, without changing its API.

The unique event receipt and broadcast are committed together. Repeated POSTs
return that receipt and never schedule delivery again. This is at-most-once
dispatch creation, not a guarantee of exactly-once delivery by SMTP/FCM.
"""
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.application.services.appointment_notice_service import (
    FINAL_STATUSES, LA_PAZ, latest_trackings, utc_naive_to_local,
)
from app.application.services.push_service import active_devices_query
from app.application.services.tracking_service import resolve_service
from app.core.dependencies import resolve_branch_id
from app.config.settings import settings
from app.domain.entities.audit_log import AuditLog
from app.domain.entities.broadcast import Broadcast, BroadcastRecipient
from app.domain.entities.client import Client
from app.domain.entities.retouch_reminder import RetouchReminder
from app.domain.entities.service_agenda import Appointment
from app.domain.entities.tracking import Tracking
from app.domain.entities.user import User
from app.infrastructure.email.smtp_client import is_email_configured, sender_address
from app.infrastructure.push.fcm_client import get_fcm_client
from app.presentation.schemas.retouch_reminder import RetouchReminderResult


def _hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def delivery_enabled():
    default = "disabled" if settings.environment.strip().lower() in {"production", "prod"} else "live"
    return os.environ.get("RETOUCH_REMINDERS_DELIVERY_MODE", default) == "live"


def _context(db, tracking_id, tipo, user, now):
    tracking = db.get(Tracking, tracking_id)
    if tracking is None:
        raise HTTPException(404, "Seguimiento no encontrado.")
    client = db.get(Client, tracking.client_id)
    if client is None:
        raise HTTPException(404, "Clienta no encontrada.")
    # A restricted user without a branch must never get an unscoped query.
    unrestricted = user.role and user.role.name in {"SuperAdmin", "Admin", "Secretaria"}
    if (not unrestricted and user.branch_id is None) or (
        resolve_branch_id(client.branch_id, user) != client.branch_id
    ):
        raise HTTPException(403, "La clienta no pertenece a tu sucursal.")
    appointment = db.get(Appointment, tracking.appointment_id) if tracking.appointment_id else None
    if (client.branch_id is None or tracking.branch_id != client.branch_id or not appointment
        or appointment.client_id != client.id or appointment.branch_id != client.branch_id):
        raise HTTPException(409, "Revisa la relación entre clienta, atención y sucursal.")
    if appointment.status not in {"completed", "finalizado", "atendido", "done"}:
        raise HTTPException(409, "La atención de origen todavía no está completada.")
    latest = latest_trackings(db, [client.id]).get(client.id)
    if not latest or latest.id != tracking.id:
        raise HTTPException(409, "El seguimiento cambió. Actualiza la tabla.")
    target = tracking.next_maintenance_date if tipo == "mantenimiento" else tracking.next_removal_date
    if target is None:
        raise HTTPException(409, "El seguimiento no tiene fecha para este tipo de recordatorio.")
    day = utc_naive_to_local(target).date()
    today = now.astimezone(LA_PAZ).date()
    if not today - timedelta(days=7) <= day <= today + timedelta(days=365):
        raise HTTPException(409, "La fecha ya no está en el rango de Estado de retoques.")
    service = resolve_service(db, tracking.appointment_id)
    if service is None:
        raise HTTPException(409, "La atención no tiene un servicio verificable.")
    return tracking, client, service, day, today


def _result(db, receipt):
    if receipt is None:
        return None
    broadcast = db.get(Broadcast, receipt.broadcast_id)
    recipient = db.query(BroadcastRecipient).filter_by(broadcast_id=broadcast.id).one()
    return RetouchReminderResult(
        broadcast_id=broadcast.id, status=broadcast.status,
        send_push=broadcast.send_push or recipient.push_status is not None,
        send_email=broadcast.send_email or recipient.email_status is not None,
        push_status=recipient.push_status, email_status=recipient.email_status,
    )


def preview_reminder(db: Session, tracking_id, tipo, user, now=None):
    now = now or datetime.now(timezone.utc)
    tracking, client, service, day, today = _context(db, tracking_id, tipo, user, now)
    # No explicit retouch/appointment relation exists in this model. A future
    # appointment (even confirmed, even same service) is not proof of retouch.
    upcoming = db.query(Appointment).filter(
        Appointment.client_id == client.id, Appointment.branch_id == client.branch_id,
        Appointment.status.notin_(FINAL_STATUSES),
        Appointment.start_time > now.astimezone(LA_PAZ).replace(tzinfo=None),
    ).order_by(Appointment.start_time, Appointment.id).first()
    state = "no_verificada" if upcoming else "sin_cita"
    note = (f"Cita futura el {upcoming.start_time:%d/%m/%Y %H:%M}; no se ha verificado que sea de {tipo}."
            if upcoming else f"No consta una cita de {tipo} verificada en esta sucursal.")
    remaining = (day - today).days
    period = f"venció hace {-remaining} días" if remaining < 0 else (
        "corresponde hoy" if remaining == 0 else f"corresponde en {remaining} días")
    message = (f"Hola {client.name}, tu {tipo} de {service.name} {period} "
               f"(fecha recomendada: {day:%d/%m/%Y}). "
               + ("Tienes una cita futura; consulta con tu sucursal si cubre este servicio."
                  if upcoming else f"Contacta con tu sucursal para agendar tu {tipo}."))
    event_key = _hash([client.id, tracking.id, tipo, day.isoformat()])
    # Availability and consent are revalidated on POST, never trusted from UI.
    push = get_fcm_client() is not None and active_devices_query(db).filter_by(client_id=client.id).first() is not None
    email = is_email_configured() and bool((client.email or "").strip())
    preview = dict(
        client_id=client.id, clienta=f"{client.name} {client.last_name}".strip(),
        servicio=service.name, tipo=tipo, fecha_objetivo=day.isoformat(), dias_restantes=remaining,
        appointment_state=state, appointment_note=note, message=message,
        push_available=push, email_available=email, consent=client.notificaciones_activas,
        delivery_enabled=delivery_enabled(),
    )
    preview["preview_version"] = _hash([preview, client.email, client.branch_id,
                                          upcoming.id if upcoming else None])
    preview["result"] = _result(db, db.get(RetouchReminder, event_key))
    return preview, event_key


def create_reminder(db, tracking_id, tipo, payload, user):
    preview, event_key = preview_reminder(db, tracking_id, tipo, user)
    # Return original outcome after timeouts/reloads; never enqueue it again.
    if preview["result"] is not None:
        return preview["result"], False
    if not delivery_enabled():
        raise HTTPException(503, "Envío de recordatorios de retoques deshabilitado para esta release.")
    if not preview["consent"]:
        raise HTTPException(409, "La clienta tiene las notificaciones desactivadas.")
    if preview["preview_version"] != payload.preview_version:
        raise HTTPException(409, "Los datos cambiaron. Vuelve a abrir la confirmación.")
    if not payload.send_push and not payload.send_email:
        raise HTTPException(400, "Selecciona al menos un canal disponible.")
    if (payload.send_push and not preview["push_available"]) or (payload.send_email and not preview["email_available"]):
        raise HTTPException(409, "Uno de los canales seleccionados ya no está disponible.")
    client = db.get(Client, preview["client_id"])
    broadcast = Broadcast(
        kind="aviso", title=f"Recordatorio de {tipo}", body=preview["message"],
        audience="selected", branch_id=client.branch_id, send_push=payload.send_push,
        send_email=payload.send_email, email_from=sender_address() if payload.send_email else None,
        status="sending", recipients_count=1, created_by=user.id,
    )
    try:
        db.add(broadcast)
        db.flush()
        db.add(BroadcastRecipient(broadcast_id=broadcast.id, client_id=client.id))
        db.add(RetouchReminder(event_key=event_key, broadcast_id=broadcast.id,
                              preview_version=preview["preview_version"]))
        # record_audit() commits internally; add the audit in this transaction.
        db.add(AuditLog(user_id=user.id, branch_id=client.branch_id, action="create",
                        entity_type="retouch_reminder", entity_id=broadcast.id,
                        description=f"Recordatorio manual de {tipo}, seguimiento #{tracking_id}"))
        db.commit()
    except IntegrityError:
        db.rollback()
        receipt = db.get(RetouchReminder, event_key)
        if receipt is None:
            raise
        return _result(db, receipt), False
    return _result(db, db.get(RetouchReminder, event_key)), True


def deliver_reminder(broadcast_id, tracking_id, tipo, session_factory):
    """Recheck consent/scope/context before delegating to existing providers.

    Interrupted deliveries are never automatically retried: a provider may
    already have accepted a message before the process lost its response.
    """
    from app.application.services.broadcast_delivery_service import deliver_broadcast

    with session_factory() as db:
        broadcast = db.get(Broadcast, broadcast_id)
        if broadcast is None or broadcast.status != "sending":
            return
        receipt = db.query(RetouchReminder).filter_by(broadcast_id=broadcast_id).one()
        user = db.get(User, broadcast.created_by)
        allowed = False
        try:
            from app.core.dependencies import _user_has_permission
            if user and user.is_active and all(_user_has_permission(user, p) for p in ("reminders:send", "clients:view")):
                preview, _ = preview_reminder(db, tracking_id, tipo, user)
                allowed = delivery_enabled() and preview["consent"] and preview["preview_version"] == receipt.preview_version
        except HTTPException:
            pass
        if not allowed:
            broadcast.status = "interrupted"
            broadcast.finished_at = datetime.utcnow()
            recipient = db.query(BroadcastRecipient).filter_by(broadcast_id=broadcast_id).one()
            if broadcast.send_push:
                recipient.push_status = "failed"
            if broadcast.send_email:
                recipient.email_status = "failed"
            # The existing app feed includes push broadcasts. A cancelled
            # reminder must not remain visible there via later synchronization.
            broadcast.send_push = False
            broadcast.send_email = False
            db.commit()
            return
    deliver_broadcast(broadcast_id, session_factory)
