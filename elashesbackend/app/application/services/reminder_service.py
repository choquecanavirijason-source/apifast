"""Chequeo diario de recordatorios de mantenimiento/retiro: avisa a la
clienta (solo a ella, vía su canal WebSocket) cuando faltan
REMINDER_DAYS_BEFORE días para su próxima fecha de retoque o retiro. Se
programa desde main.py con APScheduler."""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.tracking import Tracking
from app.domain.entities.service_agenda import Appointment, Service
from app.core.ws_manager import client_ws_manager

REMINDER_DAYS_BEFORE = 3


def _pending_query(db: Session):
    return db.query(Tracking).options(
        joinedload(Tracking.appointment).joinedload(Appointment.service)
    ).filter(
        (Tracking.maintenance_reminder_sent == False)
        | (Tracking.removal_reminder_sent == False)
    )


def collect_due_reminders(db: Session) -> list[dict]:
    """Marca como enviadas (commitea) y devuelve las trackings que hoy caen
    exactamente REMINDER_DAYS_BEFORE días antes de su fecha objetivo."""
    target_date = (datetime.utcnow() + timedelta(days=REMINDER_DAYS_BEFORE)).date()
    due: list[dict] = []

    for tracking in _pending_query(db).all():
        service_name = (
            tracking.appointment.service.name
            if tracking.appointment and tracking.appointment.service
            else None
        )

        if (
            not tracking.maintenance_reminder_sent
            and tracking.next_maintenance_date
            and tracking.next_maintenance_date.date() == target_date
        ):
            tracking.maintenance_reminder_sent = True
            due.append({
                "client_id": tracking.client_id,
                "tracking_id": tracking.id,
                "appointment_id": tracking.appointment_id,
                "type": "maintenance",
                "date": tracking.next_maintenance_date.isoformat(),
                "service_name": service_name,
            })

        if (
            not tracking.removal_reminder_sent
            and tracking.next_removal_date
            and tracking.next_removal_date.date() == target_date
        ):
            tracking.removal_reminder_sent = True
            due.append({
                "client_id": tracking.client_id,
                "tracking_id": tracking.id,
                "appointment_id": tracking.appointment_id,
                "type": "removal",
                "date": tracking.next_removal_date.isoformat(),
                "service_name": service_name,
            })

    if due:
        db.commit()

    return due


async def run_daily_reminder_check(db: Session) -> None:
    for reminder in collect_due_reminders(db):
        event = "maintenance_reminder" if reminder["type"] == "maintenance" else "removal_reminder"
        await client_ws_manager.broadcast(reminder["client_id"], {"event": event, **reminder})
