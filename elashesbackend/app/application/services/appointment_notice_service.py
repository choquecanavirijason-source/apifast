"""
Avisos programados de citas ("manana" / "hoy") para la app de la clienta.

El backend decide qué avisar y cuándo; el teléfono los programa como
notificaciones locales. Ver docs/Recordatorios_de_citas_sin_Firebase.pdf.

Todas las reglas se calculan en hora de Bolivia (America/La_Paz). Convenciones
de fechas de la BD:
  - appointments.start_time: hora local de La Paz, naive.
  - appointments.created_at: UTC naive (como pos_sales/inventory).

No confundir con reminder_service.py (mantenimiento/retiro), que es otro flujo.
"""
import hashlib
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload

from app.domain.entities.service_agenda import Appointment, AppointmentService

LA_PAZ = ZoneInfo("America/La_Paz")

TIPO_MANANA = "manana"
TIPO_HOY = "hoy"

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


@dataclass(frozen=True)
class Notice:
    tipo: str
    mostrar_en: datetime  # aware, La Paz
    expira_en: datetime  # aware, La Paz


def to_local_aware(naive_local: datetime) -> datetime:
    """start_time (naive, hora de La Paz) -> aware."""
    return naive_local.replace(tzinfo=LA_PAZ)


def utc_naive_to_local(naive_utc: datetime) -> datetime:
    """created_at (naive, UTC) -> aware en La Paz."""
    return naive_utc.replace(tzinfo=timezone.utc).astimezone(LA_PAZ)


def make_aviso_id(appointment_id: int, tipo: str, start_time: datetime) -> int:
    """Entero positivo de 31 bits, estable para cita + tipo + fecha de la cita.
    Si la cita se reprograma cambia el id (el teléfono cancela el viejo)."""
    raw = f"{appointment_id}|{tipo}|{start_time.replace(tzinfo=None).isoformat()}"
    digest = hashlib.sha256(raw.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") & 0x7FFFFFFF


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
                    "tipo": notice.tipo,
                    "mostrar_en": notice.mostrar_en.isoformat(),
                    "expira_en": notice.expira_en.isoformat(),
                    "titulo": titulo,
                    "cuerpo": cuerpo,
                    "_orden": notice.mostrar_en,
                }
            )

    avisos.sort(key=lambda a: (a["_orden"], a["aviso_id"]))
    for aviso in avisos:
        del aviso["_orden"]
    return {"generado_en": now.isoformat(), "avisos": avisos}
