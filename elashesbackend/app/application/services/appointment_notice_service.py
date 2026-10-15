"""
Avisos programados para la app de la clienta: de citas ("manana" / "hoy") y
de seguimiento ("mantenimiento" / "retiro", recordar agendar el retoque).

El backend decide qué avisar y cuándo; el teléfono los programa como
notificaciones locales. Ver docs/Recordatorios_de_citas_sin_Firebase.pdf.

Todas las reglas se calculan en hora de Bolivia (America/La_Paz). Convenciones
de fechas de la BD:
  - appointments.start_time: hora local de La Paz, naive.
  - appointments.created_at: UTC naive (como pos_sales/inventory).
  - client_tracking.next_maintenance_date / next_removal_date: UTC naive
    (last_application_date llega del panel como toISOString()).

Con estos avisos activos, reminder_service.py (WebSocket) deja de enviar
mantenimiento/retiro para no duplicarlos (ver client_notices_active).
"""
import hashlib
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.application.services.tracking_service import resolve_service
from app.config.settings import settings
from app.domain.entities.service_agenda import Appointment, AppointmentService
from app.domain.entities.tracking import Tracking

LA_PAZ = ZoneInfo("America/La_Paz")

TIPO_MANANA = "manana"
TIPO_HOY = "hoy"
TIPO_MANTENIMIENTO = "mantenimiento"
TIPO_RETIRO = "retiro"

STATUS_CANCELLED = "cancelled"

WINDOW_HOURS = 48
MANANA_SHOW_HOUR = 18
HOY_EARLIEST_HOUR = 8
HOY_LEAD = timedelta(hours=3)
HOY_EXPIRE_BEFORE = timedelta(minutes=30)
HOY_MIN_GAP = timedelta(minutes=30)
HOY_MIN_ADVANCE = timedelta(hours=3)

# manana: mostrar_en puede estar hasta ~30 h antes de la cita; margen amplio.
_QUERY_LOOKAHEAD = timedelta(hours=WINDOW_HOURS + 32)

# mantenimiento/retiro: un aviso 3 días antes y otro el mismo día, a las 10:00.
SEGUIMIENTO_SHOW_HOUR = 10
SEGUIMIENTO_DAYS_BEFORE = 3

_TITULOS_SEGUIMIENTO = {
    # tipo: (aviso previo, aviso del mismo día)
    TIPO_MANTENIMIENTO: ("Te toca tu retoque", "Hoy te toca tu retoque"),
    TIPO_RETIRO: ("Te toca tu retiro", "Hoy te toca tu retiro"),
}


def client_notices_active() -> bool:
    """Misma condición con la que main.py monta /avisos/programados: solo en el
    servidor, nunca en el instalador de escritorio (PyInstaller -> sys.frozen)."""
    return settings.client_notices_enabled and not getattr(sys, "frozen", False)


@dataclass(frozen=True)
class Notice:
    tipo: str
    mostrar_en: datetime  # aware, La Paz
    expira_en: datetime  # aware, La Paz
    el_mismo_dia: bool = False  # solo seguimiento: aviso del día objetivo


def to_local_aware(naive_local: datetime) -> datetime:
    """start_time (naive, hora de La Paz) -> aware."""
    return naive_local.replace(tzinfo=LA_PAZ)


def utc_naive_to_local(naive_utc: datetime) -> datetime:
    """created_at (naive, UTC) -> aware en La Paz."""
    return naive_utc.replace(tzinfo=timezone.utc).astimezone(LA_PAZ)


def _hash31(raw: str) -> int:
    digest = hashlib.sha256(raw.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") & 0x7FFFFFFF


def make_aviso_id(appointment_id: int, tipo: str, start_time: datetime) -> int:
    """Entero positivo de 31 bits, estable para cita + tipo + fecha de la cita.
    Si la cita se reprograma cambia el id (el teléfono cancela el viejo)."""
    return _hash31(f"{appointment_id}|{tipo}|{start_time.replace(tzinfo=None).isoformat()}")


def make_tracking_aviso_id(tracking_id: int, tipo: str, target_day: date, show_day: date) -> int:
    """Como make_aviso_id, para seguimiento + tipo + fecha objetivo. Incluye el
    día en que se muestra para que el aviso previo y el del mismo día no
    compartan id (si no, el teléfono reemplazaría uno con el otro). Prefijo "s"
    para no chocar nunca con el formato de los ids de citas."""
    return _hash31(f"s|{tracking_id}|{tipo}|{target_day.isoformat()}|{show_day.isoformat()}")


def compute_notices(start_time: datetime, created_at: Optional[datetime]) -> list[Notice]:
    """Avisos que corresponden a una cita, sin filtrar por ventana de tiempo.

    start_time: naive, hora de La Paz.  created_at: naive, UTC (None = se
    asume que la cita no es de última hora).
    """
    start = to_local_aware(start_time)
    avisos: list[Notice] = []

    # "manana": 18:00 del día anterior, vale hasta la medianoche del día de la cita.
    day_start = datetime.combine(start.date(), time(0, 0), tzinfo=LA_PAZ)
    avisos.append(
        Notice(
            tipo=TIPO_MANANA,
            mostrar_en=day_start - timedelta(hours=24 - MANANA_SHOW_HOUR),
            expira_en=day_start,
        )
    )

    # "hoy": 3 h antes pero nunca antes de las 08:00; vale hasta 30 min antes.
    earliest = datetime.combine(start.date(), time(HOY_EARLIEST_HOUR, 0), tzinfo=LA_PAZ)
    mostrar_hoy = max(start - HOY_LEAD, earliest)
    booked_last_minute = (
        created_at is not None and start - utc_naive_to_local(created_at) < HOY_MIN_ADVANCE
    )
    if start - mostrar_hoy >= HOY_MIN_GAP and not booked_last_minute:
        avisos.append(
            Notice(
                tipo=TIPO_HOY,
                mostrar_en=mostrar_hoy,
                expira_en=start - HOY_EXPIRE_BEFORE,
            )
        )
    return avisos


def compute_tracking_notices(tipo: str, target_utc: datetime) -> list[Notice]:
    """Avisos de mantenimiento/retiro para una fecha objetivo (naive, UTC), sin
    filtrar por ventana de tiempo: el previo vale hasta la medianoche del día
    objetivo; el del mismo día, hasta la medianoche siguiente."""
    target_day = utc_naive_to_local(target_utc).date()

    def at(day: date, hour: int = 0) -> datetime:
        return datetime.combine(day, time(hour, 0), tzinfo=LA_PAZ)

    return [
        Notice(
            tipo=tipo,
            mostrar_en=at(target_day - timedelta(days=SEGUIMIENTO_DAYS_BEFORE), SEGUIMIENTO_SHOW_HOUR),
            expira_en=at(target_day),
        ),
        Notice(
            tipo=tipo,
            mostrar_en=at(target_day, SEGUIMIENTO_SHOW_HOUR),
            expira_en=at(target_day + timedelta(days=1)),
            el_mismo_dia=True,
        ),
    ]


def _service_names(appointment: Appointment) -> list[str]:
    """Nombres desde appointment_services + services (no appointments.service_id)."""
    links: list[AppointmentService] = sorted(
        appointment.appointment_services, key=lambda link: (link.sort_order or 0, link.id)
    )
    return [link.service.name for link in links if link.service and link.service.name]


def _format_notice(tipo: str, appointment: Appointment) -> tuple[str, str]:
    hora = appointment.start_time.strftime("%H:%M")
    servicios = ", ".join(_service_names(appointment))
    salon = appointment.branch.name if appointment.branch else None

    titulo = "Tu cita es mañana" if tipo == TIPO_MANANA else "Tu cita es hoy"
    cuerpo = f"{hora}"
    if servicios:
        cuerpo += f" · {servicios}"
    if salon:
        cuerpo += f" · {salon}"
    return titulo, cuerpo


def tracking_targets(tracking: Tracking) -> list[tuple[str, datetime]]:
    """(tipo, fecha objetivo UTC naive) de un seguimiento, solo las cargadas."""
    return [
        (tipo, target)
        for tipo, target in (
            (TIPO_MANTENIMIENTO, tracking.next_maintenance_date),
            (TIPO_RETIRO, tracking.next_removal_date),
        )
        if target
    ]


def latest_trackings(db: Session, client_ids: list[int]) -> dict[int, Tracking]:
    """Último seguimiento de cada clienta (last_application_date, luego id):
    uno nuevo anula los avisos de los anteriores. Lo comparten los avisos y
    la tabla de retoques del panel para que nunca digan cosas distintas."""
    if not client_ids:
        return {}
    trackings = (
        db.query(Tracking)
        .options(
            joinedload(Tracking.client),
            joinedload(Tracking.branch),
            joinedload(Tracking.appointment).joinedload(Appointment.branch),
        )
        .filter(Tracking.client_id.in_(client_ids))
        .order_by(Tracking.client_id, Tracking.last_application_date.desc(), Tracking.id.desc())
        .all()
    )
    latest: dict[int, Tracking] = {}
    for tracking in trackings:
        latest.setdefault(tracking.client_id, tracking)
    return latest


def next_appointments(db: Session, client_ids: list[int], now: datetime) -> dict[int, datetime]:
    """Próxima cita no cancelada de cada clienta (start_time, hora de La Paz
    naive). Las que no tienen ninguna no aparecen."""
    if not client_ids:
        return {}
    rows = (
        db.query(Appointment.client_id, func.min(Appointment.start_time))
        .filter(Appointment.client_id.in_(client_ids))
        .filter(Appointment.status != STATUS_CANCELLED)
        .filter(Appointment.start_time > now.astimezone(LA_PAZ).replace(tzinfo=None))
        .group_by(Appointment.client_id)
        .all()
    )
    return dict(rows)


def _tracking_notices(
    db: Session, client_id: int, now: datetime, limit: datetime
) -> list[dict]:
    """Avisos de mantenimiento/retiro del último seguimiento de la clienta.
    Ninguno si la clienta los tiene desactivados o si ya tiene una cita
    futura no cancelada: el objetivo es recordarle agendar, no avisar de más."""
    tracking = latest_trackings(db, [client_id]).get(client_id)
    if not tracking or not tracking_targets(tracking):
        return []
    if not tracking.client.notificaciones_activas:
        return []
    if next_appointments(db, [client_id], now):
        return []

    # Mismo servicio con el que se calcularon los días (tracking_service).
    service = resolve_service(db, tracking.appointment_id)
    branch = tracking.branch or (tracking.appointment.branch if tracking.appointment else None)
    cuerpo = " · ".join(p for p in (service.name if service else None, branch.name if branch else None) if p)

    avisos = []
    for tipo, target in tracking_targets(tracking):
        for notice in compute_tracking_notices(tipo, target):
            if notice.expira_en <= now or notice.mostrar_en > limit:
                continue
            previo, del_dia = _TITULOS_SEGUIMIENTO[tipo]
            avisos.append(
                {
                    "aviso_id": make_tracking_aviso_id(
                        tracking.id, tipo, utc_naive_to_local(target).date(), notice.mostrar_en.date()
                    ),
                    "cita_id": None,
                    "seguimiento_id": tracking.id,
                    "tipo": tipo,
                    "mostrar_en": notice.mostrar_en.isoformat(),
                    "expira_en": notice.expira_en.isoformat(),
                    "titulo": del_dia if notice.el_mismo_dia else previo,
                    "cuerpo": cuerpo or "Agenda tu cita",
                    "_orden": notice.mostrar_en,
                }
            )
    return avisos


def get_scheduled_notices(
    db: Session, client_id: int, now_utc: Optional[datetime] = None
) -> dict:
    """Avisos de la clienta cuyo mostrar_en cae en las próximas 48 h, más los que
    ya pasaron su hora de mostrar pero siguen vigentes (se muestran al sincronizar)."""
    now_utc = now_utc or datetime.now(timezone.utc)
    now = now_utc.astimezone(LA_PAZ)
    now_naive_local = now.replace(tzinfo=None)
    limit = now + timedelta(hours=WINDOW_HOURS)

    appointments = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.branch),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service),
        )
        .filter(Appointment.client_id == client_id)
        .filter(Appointment.status != STATUS_CANCELLED)
        .filter(Appointment.start_time > now_naive_local)
        .filter(Appointment.start_time <= now_naive_local + _QUERY_LOOKAHEAD)
        .all()
    )

    avisos = []
    for appointment in appointments:
        for notice in compute_notices(appointment.start_time, appointment.created_at):
            if notice.expira_en <= now or notice.mostrar_en > limit:
                continue
            titulo, cuerpo = _format_notice(notice.tipo, appointment)
            avisos.append(
                {
                    "aviso_id": make_aviso_id(appointment.id, notice.tipo, appointment.start_time),
                    "cita_id": appointment.id,
                    "seguimiento_id": None,
                    "tipo": notice.tipo,
                    "mostrar_en": notice.mostrar_en.isoformat(),
                    "expira_en": notice.expira_en.isoformat(),
                    "titulo": titulo,
                    "cuerpo": cuerpo,
                    "_orden": notice.mostrar_en,
                }
            )
    avisos.extend(_tracking_notices(db, client_id, now, limit))

    avisos.sort(key=lambda a: (a["_orden"], a["aviso_id"]))
    for aviso in avisos:
        del aviso["_orden"]
    return {"generado_en": now.isoformat(), "avisos": avisos}
