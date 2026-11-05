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
from app.application.services.tracking_service import (
    appointment_primary_service,
    followup_kinds,
    resolve_service,
)
from app.domain.entities.broadcast import Broadcast
from app.domain.entities.client import Client
from app.domain.entities.retouch_reminder import RetouchReminder
from app.domain.entities.service_agenda import Appointment, AppointmentService, Service
from app.domain.entities.tracking import Tracking

VENCIDOS_DIAS = 7
ATTENDED_STATUSES = ("completed", "finalizado", "atendido", "done")
CANCELLED_STATUSES = ("cancelled", "cancelado", "no_show")
# Estado del seguimiento en las pestañas tipadas (Estado de retoques/retirados).
ESTADO_PENDIENTE = "pendiente_atencion"
ESTADO_HABILITADO = "habilitado"
ESTADO_ENVIADO = "recordatorio_enviado"
ESTADO_VENCIDO = "vencido"
ESTADO_CANCELADO = "cancelado"


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
    db: Session, dias: int, branch_id: Optional[int], today: date, include_recent: bool = False,
    branch_by_tracking: bool = False,
) -> list[tuple[Tracking, list[tuple[str, date]]]]:
    """(último seguimiento, [(tipo, fecha objetivo)]) de cada clienta con
    mantenimiento/retiro entre hoy - VENCIDOS_DIAS y hoy + dias.

    include_recent: también las atenciones finalizadas en los últimos
    VENCIDOS_DIAS días aunque su fecha caiga después de hoy + dias, para que
    al finalizar la clienta pase a "Habilitado" y no desaparezca de la lista."""
    desde = today - timedelta(days=VENCIDOS_DIAS)
    hasta = today + timedelta(days=dias)

    lo, hi = _utc_naive_start_of(desde), _utc_naive_start_of(hasta + timedelta(days=1))
    conditions = [
        and_(Tracking.next_maintenance_date >= lo, Tracking.next_maintenance_date < hi),
        and_(Tracking.next_removal_date >= lo, Tracking.next_removal_date < hi),
    ]
    if include_recent:
        conditions.append(and_(
            Tracking.last_application_date >= lo,
            or_(Tracking.next_maintenance_date >= lo, Tracking.next_removal_date >= lo),
        ))
    in_range = or_(*conditions)
    query = db.query(Tracking.client_id).join(Client, Client.id == Tracking.client_id).filter(in_range)
    if branch_id is not None:
        # Pestañas tipadas: sucursal donde se realizó la atención (seguimiento).
        # Resto (audiencias de comunicados): sucursal de la ficha, sin cambios.
        query = query.filter((Tracking.branch_id if branch_by_tracking else Client.branch_id) == branch_id)
    client_ids = [client_id for (client_id,) in query.distinct()]

    # Las candidatas salen de cualquier seguimiento, pero solo cuenta el último:
    # si es más nuevo y sin fechas en rango (ej. un lifting), la clienta no sale.
    due = []
    for tracking in latest_trackings(db, client_ids).values():
        if branch_by_tracking and branch_id is not None and tracking.branch_id != branch_id:
            continue  # el último seguimiento es de otra sucursal: no se expone aquí
        recent = include_recent and utc_naive_to_local(tracking.last_application_date).date() >= desde
        targets = [
            (tipo, day)
            for tipo, target in tracking_targets(tracking)
            if desde <= (day := utc_naive_to_local(target).date()) and (day <= hasta or recent)
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


def pending_followup_appointments(
    db: Session,
    tipo: str,
    today: date,
    branch_id: Optional[int] = None,
    client_ids: Optional[list[int]] = None,
) -> dict[int, Appointment]:
    """Cita activa (no en estado final) más próxima de cada clienta cuyo
    servicio generará un seguimiento `tipo` al finalizar. Desde hace
    VENCIDOS_DIAS días y sin límite futuro: la reserva aparece en cuanto se
    crea. branch_id filtra por la sucursal de la CITA (donde se atenderá),
    como Próximas citas; la sucursal de la ficha no interviene."""
    since = datetime.combine(today - timedelta(days=VENCIDOS_DIAS), time(0, 0))
    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.client),
            joinedload(Appointment.service).joinedload(Service.category),
            joinedload(Appointment.appointment_services)
            .joinedload(AppointmentService.service)
            .joinedload(Service.category),
        )
        .filter(
            Appointment.status.notin_(FINAL_STATUSES),
            Appointment.start_time >= since,
            Appointment.branch_id.isnot(None),
        )
    )
    if branch_id is not None:
        query = query.filter(Appointment.branch_id == branch_id)
    if client_ids is not None:
        query = query.filter(Appointment.client_id.in_(client_ids))
    pending: dict[int, Appointment] = {}
    for appointment in query.order_by(Appointment.start_time, Appointment.id):
        if tipo in followup_kinds(appointment_primary_service(appointment)):
            pending.setdefault(appointment.client_id, appointment)
    return pending


def _sent_event_keys(db: Session, keys: list[str]) -> set[str]:
    """Recibos de recordatorios ya registrados (deduplicación existente),
    excepto los que nunca llegaron a entregarse."""
    if not keys:
        return set()
    rows = (
        db.query(RetouchReminder.event_key)
        .join(Broadcast, Broadcast.id == RetouchReminder.broadcast_id)
        .filter(RetouchReminder.event_key.in_(keys), Broadcast.status.notin_(("interrupted", "failed")))
        .all()
    )
    return {key for (key,) in rows}


def _list_typed(db: Session, dias: int, branch_id: Optional[int], now_utc: datetime, tipo: str) -> list[dict]:
    """Pestañas Estado de retoques / Estado de retirados: una fila por clienta.

    - Cita activa con un servicio que genera `tipo` -> "pendiente_atencion"
      (sin fecha todavía, sin recordatorio). Tiene prioridad sobre el
      seguimiento anterior: la nueva atención reinicia el ciclo.
    - Último seguimiento con fecha en rango (o atención recién finalizada)
      -> "habilitado" / "vencido" / "recordatorio_enviado"; "cancelado" si la
      atención de origen se canceló.
    """
    from app.application.services.retouch_reminder_service import reminder_event_key

    today = now_utc.astimezone(LA_PAZ).date()
    now_local = now_utc.astimezone(LA_PAZ).replace(tzinfo=None)
    # Sucursal de cada fila = donde se atiende (cita) o se atendió (seguimiento).
    pending = pending_followup_appointments(db, tipo, today, branch_id)
    due = _due_targets(db, dias, branch_id, today, include_recent=True, branch_by_tracking=True)
    due_clients = [tracking.client_id for tracking, _ in due]
    # Reserva pendiente en CUALQUIER sucursal: solo bloquea el recordatorio
    # (igual que el POST); no se expone fecha ni sucursal de esa cita.
    pending_anywhere = pending if branch_id is None else pending_followup_appointments(
        db, tipo, today, client_ids=due_clients)
    client_ids = set(pending) | set(due_clients)
    # Próxima cita solo de la sucursal de la fila: nunca fechas de otra sucursal.
    proximas = {
        (client_id, row_branch): start
        for client_id, row_branch, start in db.query(
            Appointment.client_id, Appointment.branch_id, func.min(Appointment.start_time))
        .filter(Appointment.client_id.in_(client_ids),
                Appointment.status.notin_(FINAL_STATUSES),
                Appointment.start_time > now_local)
        .group_by(Appointment.client_id, Appointment.branch_id).all()
    } if client_ids else {}

    def base_row(client, servicio, row_branch):
        return {
            "client_id": client.id,
            "clienta": f"{client.name} {client.last_name}".strip(),
            "servicio": servicio,
            "tipo": tipo,
            "notificaciones_activas": client.notificaciones_activas,
            "branch_id": row_branch,
            "proxima_cita": proximas.get((client.id, row_branch)),
            "estado_retiro": None,
            "reserva_retiro_estado": "sin_reserva",
            "reserva_retiro_fecha": None,
            "reserva_retiro_detalle": None,
        }

    rows = []
    for appointment in pending.values():
        service = appointment_primary_service(appointment)
        en_servicio = appointment.status == "in_service"
        rows.append({
            **base_row(appointment.client, service.name if service else None, appointment.branch_id),
            "seguimiento_id": None,
            "appointment_id": appointment.id,
            "cita_fecha": appointment.start_time,
            "cita_estado": appointment.status,
            "estado_seguimiento": ESTADO_PENDIENTE,
            "fecha_objetivo": None,
            "fecha_aplicacion": None,
            "dias_restantes": None,
            "vencido": False,
            "recordatorio_permitido": False,
            "observacion": ("En servicio. " if en_servicio else "Cita reservada. ")
            + "La fecha recomendada se calculará al finalizar la atención en Control de servicios.",
        })

    tracking_rows = []
    for tracking, targets in due:
        client = tracking.client
        if tracking.client_id in pending:
            continue
        origin = db.get(Appointment, tracking.appointment_id) if tracking.appointment_id else None
        # Coherencia: el seguimiento es de la sucursal donde se hizo la atención.
        if tracking.branch_id is None or (
            origin and (origin.client_id != client.id or origin.branch_id != tracking.branch_id)
        ):
            continue
        for target_type, day in targets:
            if target_type != tipo:
                continue
            service = resolve_service(db, tracking.appointment_id)
            dias_restantes = (day - today).days
            later = later_attended_appointment(db, tracking, now_utc) if tipo == "retiro" else None
            attended = bool(origin and origin.status in ATTENDED_STATUSES)
            row = {
                **base_row(client, service.name if service else None, tracking.branch_id),
                "seguimiento_id": tracking.id,
                "appointment_id": tracking.appointment_id,
                "cita_fecha": origin.start_time if origin else None,
                "cita_estado": origin.status if origin else None,
                "fecha_objetivo": day,
                "fecha_aplicacion": utc_naive_to_local(tracking.last_application_date).date(),
                "dias_restantes": dias_restantes,
                "vencido": dias_restantes < 0,
                "recordatorio_permitido": attended and not later,
                "observacion": None,
            }
            if origin is not None and origin.status in CANCELLED_STATUSES:
                row.update(estado_seguimiento=ESTADO_CANCELADO,
                           observacion="La atención de origen fue cancelada. No se enviarán recordatorios.")
            elif origin is not None and not attended:
                row.update(estado_seguimiento=ESTADO_PENDIENTE,
                           observacion="La atención de origen todavía no está finalizada.")
            else:
                row["estado_seguimiento"] = ESTADO_VENCIDO if dias_restantes < 0 else ESTADO_HABILITADO
                if origin is None:
                    row["observacion"] = "Sin atención de origen verificable. No se enviarán recordatorios."
                elif tracking.client_id in pending_anywhere:
                    row["recordatorio_permitido"] = False
                    row["observacion"] = "Hay una cita pendiente de atención; el recordatorio se habilita al finalizarla."
            if tipo == "retiro":
                row["estado_retiro"] = "atencion_posterior" if later else "por_verificar"
                if later:
                    row["observacion"] = ("Existe una atención posterior; verifica si el retiro ya fue realizado. "
                                          "No se enviarán recordatorios.")
                elif row["observacion"] is None:
                    row["observacion"] = "Fecha recomendada; el historial no confirma si el retiro ya se realizó."
                if row["proxima_cita"]:
                    row["reserva_retiro_estado"] = "por_verificar"
                    row["reserva_retiro_detalle"] = ("Hay una cita futura, pero el servicio no está identificado "
                                                     "con certeza como retiro. Confirma el servicio reservado.")
            row["_event_key"] = reminder_event_key(client.id, tracking.id, tipo, day)
            tracking_rows.append(row)

    sent = _sent_event_keys(db, [row["_event_key"] for row in tracking_rows])
    for row in tracking_rows:
        if row.pop("_event_key") in sent and row["estado_seguimiento"] in (ESTADO_HABILITADO, ESTADO_VENCIDO):
            row["estado_seguimiento"] = ESTADO_ENVIADO
    rows.extend(tracking_rows)

    rows.sort(key=lambda r: (
        r["fecha_objetivo"] or r["cita_fecha"].date(), r["clienta"].lower(), r["client_id"],
    ))
    return rows


def list_retoques(
    db: Session,
    dias: int,
    branch_id: Optional[int] = None,
    now_utc: Optional[datetime] = None,
    tipo: Optional[str] = None,
) -> list[dict]:
    """Una fila por clienta y tipo con fecha objetivo entre hoy - VENCIDOS_DIAS
    y hoy + dias, ordenadas por fecha objetivo. branch_id filtra por la
    sucursal de la clienta. Con `tipo` (pestañas del panel) incluye además
    las reservas pendientes de atención y el estado del seguimiento."""
    now_utc = now_utc or datetime.now(timezone.utc)
    if tipo is not None:
        return _list_typed(db, dias, branch_id, now_utc, tipo)
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
