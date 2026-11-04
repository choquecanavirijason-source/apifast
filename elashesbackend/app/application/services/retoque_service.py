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

from sqlalchemy import and_, or_, func
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
from app.application.services.manual_reminder_service import last_reminders_by_appointment
from app.application.services.tracking_service import resolve_service
from app.domain.entities.client import Client
from app.domain.entities.service_agenda import Appointment, AppointmentService
from app.domain.entities.tracking import Tracking

VENCIDOS_DIAS = 7
ATTENDED_STATUSES = ("completed", "finalizado", "atendido", "done")


def later_attended_appointment(db: Session, tracking: Tracking, now_utc: datetime):
    """A later attendance is evidence to review, never proof of removal.

    Only this client's branch is considered. No name/category heuristics.
    """
    applied = utc_naive_to_local(tracking.last_application_date).replace(tzinfo=None)
    query = db.query(Appointment).filter(
        Appointment.client_id == tracking.client_id,
        Appointment.branch_id == tracking.branch_id,
        Appointment.status.in_(ATTENDED_STATUSES),
        Appointment.start_time > applied,
        Appointment.start_time <= now_utc.astimezone(LA_PAZ).replace(tzinfo=None),
    )
    if tracking.appointment_id is not None:
        query = query.filter(Appointment.id != tracking.appointment_id)
    return query.order_by(Appointment.start_time.desc(), Appointment.id.desc()).first()


def _utc_naive_start_of(day: date) -> datetime:
    """Medianoche de La Paz de ese día, en UTC naive (como en client_tracking)."""
    return datetime.combine(day, time(0, 0), tzinfo=LA_PAZ).astimezone(timezone.utc).replace(tzinfo=None)


def _due_targets(
    db: Session, dias: int, branch_id: Optional[int], today: date
) -> list[tuple[Tracking, list[tuple[str, date]]]]:
    """(último seguimiento, [(tipo, fecha objetivo)]) de cada clienta con
    mantenimiento/retiro entre hoy - VENCIDOS_DIAS y hoy + dias."""
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
    due = []
    for tracking in latest_trackings(db, client_ids).values():
        targets = [
            (tipo, day)
            for tipo, target in tracking_targets(tracking)
            if desde <= (day := utc_naive_to_local(target).date()) <= hasta
        ]
        if targets:
            due.append((tracking, targets))
    return due


def retouch_due_client_ids(
    db: Session, dias: int, branch_id: Optional[int] = None, now_utc: Optional[datetime] = None
) -> set[int]:
    """Las clientas que aparecen en "Estado de retoques" con el mismo rango."""
    today = (now_utc or datetime.now(timezone.utc)).astimezone(LA_PAZ).date()
    return {tracking.client_id for tracking, _ in _due_targets(db, dias, branch_id, today)}


def list_retoques(
    db: Session,
    dias: int,
    branch_id: Optional[int] = None,
    now_utc: Optional[datetime] = None,
    tipo: Optional[str] = None,
) -> list[dict]:
    """Una fila por clienta y tipo con fecha objetivo entre hoy - VENCIDOS_DIAS
    y hoy + dias, ordenadas por fecha objetivo. branch_id filtra por la
    sucursal de la clienta."""
    now_utc = now_utc or datetime.now(timezone.utc)
    today = now_utc.astimezone(LA_PAZ).date()
    due = _due_targets(db, dias, branch_id, today)
    proximas = next_appointments(db, [tracking.client_id for tracking, _ in due], now_utc)
    if tipo is not None:
        # Scoped lists must not expose another branch's appointment dates.
        proximas = dict(db.query(Appointment.client_id, func.min(Appointment.start_time))
            .join(Client, Client.id == Appointment.client_id)
            .filter(Appointment.client_id.in_([t.client_id for t, _ in due]),
                    Appointment.branch_id == Client.branch_id,
                    Appointment.status.notin_(FINAL_STATUSES),
                    Appointment.start_time > now_utc.astimezone(LA_PAZ).replace(tzinfo=None))
            .group_by(Appointment.client_id).all())

    rows = []
    for tracking, targets in due:
        client_id = tracking.client_id
        client = tracking.client
        service = resolve_service(db, tracking.appointment_id)
        origin = db.get(Appointment, tracking.appointment_id) if tracking.appointment_id else None
        if tipo is not None and (tracking.branch_id != client.branch_id or (
            origin and (origin.client_id != client.id or origin.branch_id != client.branch_id)
        )):
            continue
        later = later_attended_appointment(db, tracking, now_utc) if (
            tipo != "mantenimiento" and any(kind == "retiro" for kind, _ in targets)
        ) else None
        for target_type, day in targets:
            if tipo is not None and target_type != tipo:
                continue
            dias_restantes = (day - today).days
            rows.append(
                {
                    "client_id": client_id,
                    "seguimiento_id": tracking.id,
                    "clienta": f"{client.name} {client.last_name}".strip(),
                    "servicio": service.name if service else None,
                    "tipo": target_type,
                    "fecha_aplicacion": utc_naive_to_local(tracking.last_application_date).date(),
                    "fecha_objetivo": day,
                    "dias_restantes": dias_restantes,
                    "vencido": dias_restantes < 0,
                    "proxima_cita": proximas.get(client_id),
                    "notificaciones_activas": client.notificaciones_activas,
                    "branch_id": client.branch_id,
                    "estado_retiro": ("atencion_posterior" if later else "por_verificar") if target_type == "retiro" else None,
                    "observacion": ("Existe una atención posterior; verifica si el retiro ya fue realizado. No se enviarán recordatorios."
                                    if later else "Fecha recomendada; el historial no confirma si el retiro ya se realizó.") if target_type == "retiro" else None,
                    "recordatorio_permitido": target_type != "retiro" or (not later and bool(origin and origin.status in ATTENDED_STATUSES)),
                    # has_removal describes follow-up needs, NOT the purpose of
                    # a booked service. No persisted purpose/link verifies a
                    # removal reservation today; do not infer one by name.
                    "reserva_retiro_estado": "por_verificar" if target_type == "retiro" and proximas.get(client_id) else "sin_reserva",
                    "reserva_retiro_fecha": None,
                    "reserva_retiro_detalle": (
                        "Hay una cita futura, pero el servicio no está identificado con certeza como retiro. Confirma el servicio reservado."
                        if target_type == "retiro" and proximas.get(client_id) else None
                    ),
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

    appointments = query.order_by(Appointment.start_time, Appointment.id).all()
    ultimos = last_reminders_by_appointment(db, [a.id for a in appointments])

    rows = []
    for appointment in appointments:
        client = appointment.client
        ultimo = ultimos.get(appointment.id)
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
                "tiene_email": bool((client.email or "").strip()),
                "ultimo_recordatorio": ultimo.replace(tzinfo=timezone.utc) if ultimo else None,
            }
        )
    return rows
