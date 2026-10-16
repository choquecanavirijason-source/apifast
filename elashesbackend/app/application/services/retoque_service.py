"""
Tablas de Atención > Notificaciones en el panel:

- "Estado de retoques": clientas cuyo mantenimiento/retiro cae en los
  próximos días, más las vencidas de los últimos VENCIDOS_DIAS días (las que
  el salón debería llamar). Usa las mismas reglas que los avisos programados
  (appointment_notice_service): solo cuenta el último seguimiento de cada
  clienta y las fechas objetivo se leen en hora de La Paz.
- "Próximas citas": citas activas (no en estado final) de los próximos días, las que
  reciben los avisos "manana"/"hoy".
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.application.services.appointment_notice_service import (
    FINAL_STATUSES,
    LA_PAZ,
    appointment_service_names,
    latest_trackings,
    next_appointments,
    tracking_targets,
    utc_naive_to_local,
)
from app.application.services.tracking_service import resolve_service
from app.domain.entities.client import Client
from app.domain.entities.service_agenda import Appointment, AppointmentService
from app.domain.entities.tracking import Tracking

VENCIDOS_DIAS = 7


def _utc_naive_start_of(day: date) -> datetime:
    """Medianoche de La Paz de ese día, en UTC naive (como en client_tracking)."""
    return datetime.combine(day, time(0, 0), tzinfo=LA_PAZ).astimezone(timezone.utc).replace(tzinfo=None)


def list_retoques(
    db: Session,
    dias: int,
    branch_id: Optional[int] = None,
    now_utc: Optional[datetime] = None,
) -> list[dict]:
    """Una fila por clienta y tipo con fecha objetivo entre hoy - VENCIDOS_DIAS
    y hoy + dias, ordenadas por fecha objetivo. branch_id filtra por la
    sucursal de la clienta."""
    now_utc = now_utc or datetime.now(timezone.utc)
    today = now_utc.astimezone(LA_PAZ).date()
    desde = today - timedelta(days=VENCIDOS_DIAS)
    hasta = today + timedelta(days=dias)

    lo, hi = _utc_naive_start_of(desde), _utc_naive_start_of(hasta + timedelta(days=1))
    in_range = or_(
        and_(Tracking.next_maintenance_date >= lo, Tracking.next_maintenance_date < hi),
        and_(Tracking.next_removal_date >= lo, Tracking.next_removal_date < hi),
    )
    query = db.query(Tracking.client_id).join(Client, Client.id == Tracking.client_id).filter(in_range)
    if branch_id is not None:
        query = query.filter(Client.branch_id == branch_id)
    client_ids = [client_id for (client_id,) in query.distinct()]

    # Las candidatas salen de cualquier seguimiento, pero solo cuenta el último:
    # si es más nuevo y sin fechas en rango (ej. un lifting), la clienta no sale.
    latest = latest_trackings(db, client_ids)
    proximas = next_appointments(db, client_ids, now_utc)

    rows = []
    for client_id, tracking in latest.items():
        targets = [
            (tipo, day)
            for tipo, target in tracking_targets(tracking)
            if desde <= (day := utc_naive_to_local(target).date()) <= hasta
        ]
        if not targets:
            continue

        client = tracking.client
        service = resolve_service(db, tracking.appointment_id)
        for tipo, day in targets:
            dias_restantes = (day - today).days
            rows.append(
                {
                    "client_id": client_id,
                    "seguimiento_id": tracking.id,
                    "clienta": f"{client.name} {client.last_name}".strip(),
                    "servicio": service.name if service else None,
                    "tipo": tipo,
                    "fecha_objetivo": day,
                    "dias_restantes": dias_restantes,
                    "vencido": dias_restantes < 0,
                    "proxima_cita": proximas.get(client_id),
                    "notificaciones_activas": client.notificaciones_activas,
                    "branch_id": client.branch_id,
                }
            )

    rows.sort(key=lambda r: (r["fecha_objetivo"], r["clienta"].lower(), r["tipo"]))
    return rows


def list_citas_proximas(
    db: Session,
    dias: int,
    branch_id: Optional[int] = None,
    now_utc: Optional[datetime] = None,
) -> list[dict]:
    """Citas activas (no en estado final) con start_time entre ahora y ahora + dias (hora de
    La Paz), ordenadas por fecha. branch_id filtra por la sucursal de la cita."""
    now_utc = now_utc or datetime.now(timezone.utc)
    now_local = now_utc.astimezone(LA_PAZ).replace(tzinfo=None)  # como start_time

    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.client),
            joinedload(Appointment.branch),
            joinedload(Appointment.service),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service),
        )
        .filter(Appointment.status.notin_(FINAL_STATUSES))
        .filter(Appointment.start_time > now_local)
        .filter(Appointment.start_time <= now_local + timedelta(days=dias))
    )
    if branch_id is not None:
        query = query.filter(Appointment.branch_id == branch_id)

    rows = []
    for appointment in query.order_by(Appointment.start_time, Appointment.id).all():
        client = appointment.client
        names = appointment_service_names(appointment) or (
            [appointment.service.name] if appointment.service else []
        )
        rows.append(
            {
                "appointment_id": appointment.id,
                "client_id": client.id,
                "clienta": f"{client.name} {client.last_name}".strip(),
                "servicio": ", ".join(names) or None,
                "fecha_hora": appointment.start_time,
                "sucursal": appointment.branch.name if appointment.branch else None,
                "branch_id": appointment.branch_id,
                "estado": appointment.status,
                "notificaciones_activas": client.notificaciones_activas,
            }
        )
    return rows
