"""
Push por Firebase Cloud Messaging a los celulares de las clientas.

Las piezas comunes (qué dispositivos pueden recibir push, enviar a una lista
de dispositivos y borrar los tokens que FCM da por inválidos) las usan los
recordatorios manuales (aquí), los avisos programados (fcm_notice_service) y
los comunicados (broadcast_service).

El push es un canal de mejor esfuerzo: lo que se envía ya está guardado y la
app lo vuelve a recibir al sincronizar.
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Iterable, Optional

from sqlalchemy.orm import Query, Session

from app.domain.entities.client_device import ClientDevice
from app.domain.entities.manual_reminder import ManualReminder
from app.infrastructure.push.fcm_client import FcmNotification, FcmResult, get_fcm_client, mask_token

logger = logging.getLogger("elashes.fcm")

# Canal de avisos de la app de marketplace (NotificationService,
# 'elashes_marketplace_citas'): el mismo que usa la app para los avisos.
ANDROID_AVISOS_CHANNEL = "elashes_marketplace_citas"

# Tope para todos los dispositivos de la clienta juntos (cada llamada tiene
# además su propio timeout en el cliente).
PUSH_DEADLINE_SECONDS = 8.0


@dataclass
class PushSummary:
    sent: int = 0
    invalid: int = 0
    failed: int = 0
    # Dispositivos que FCM aceptó (para el resultado por clienta).
    sent_device_ids: set[int] = field(default_factory=set)

    def as_dict(self) -> dict[str, int]:
        return {"sent": self.sent, "invalid": self.invalid, "failed": self.failed}


def active_devices_query(db: Session) -> Query:
    """Dispositivos que pueden recibir push: no revocados y con token FCM."""
    return (
        db.query(ClientDevice)
        .filter(ClientDevice.revoked_at.is_(None))
        .filter(ClientDevice.fcm_token.isnot(None))
    )


def clear_invalid_tokens(db: Session, devices: Iterable[ClientDevice]) -> None:
    for device in devices:
        logger.info("FCM: se borra el token %s del dispositivo %s", mask_token(device.fcm_token), device.id)
        device.fcm_token = None
        device.fcm_token_updated_at = None
    db.commit()


def send_push_to_devices(
    db: Session,
    devices: list[ClientDevice],
    data: dict[str, str],
    notification: Optional[FcmNotification] = None,
    deadline_seconds: Optional[float] = None,
) -> PushSummary:
    """Envía el mismo mensaje a cada dispositivo y borra los tokens inválidos.
    Con deadline_seconds, los que no alcanzan a salir cuentan como fallidos.
    Sin cliente FCM configurado no envía nada (resumen en cero)."""
    summary = PushSummary()
    client = get_fcm_client()
    if client is None or not devices:
        return summary

    deadline = time.monotonic() + deadline_seconds if deadline_seconds else None
    invalid: list[ClientDevice] = []
    for device in devices:
        if deadline is not None and time.monotonic() >= deadline:
            summary.failed += 1
            continue
        result = client.send_data(device.fcm_token, data, notification)
        if result is FcmResult.SENT:
            summary.sent += 1
            summary.sent_device_ids.add(device.id)
        elif result is FcmResult.INVALID_TOKEN:
            summary.invalid += 1
            invalid.append(device)
        else:
            summary.failed += 1

    if invalid:
        clear_invalid_tokens(db, invalid)
    return summary


# ── Recordatorios manuales ───────────────────────────────────────────────────

def manual_reminder_push_data(aviso: dict, appointment_id: int) -> dict[str, str]:
    """Data message del recordatorio: el mismo aviso que /avisos/programados y
    el WebSocket (aviso_id, mostrar_en... para que la app deduplique igual),
    más type/appointment_id/fecha_cita. FCM solo admite strings."""
    return {
        "type": "manual_reminder",
        "aviso_id": str(aviso["aviso_id"]),
        "appointment_id": str(appointment_id),
        "cita_id": str(appointment_id),
        "tipo": aviso["tipo"],
        "titulo": aviso["titulo"],
        "cuerpo": aviso["cuerpo"],
        # La cita es a la hora en que caduca el aviso (ISO con offset de La Paz).
        "fecha_cita": aviso["expira_en"],
        "mostrar_en": aviso["mostrar_en"],
        "expira_en": aviso["expira_en"],
    }


def manual_reminder_notification(aviso: dict) -> FcmNotification:
    """Notificación del sistema del recordatorio: así llega aunque la clienta
    haya cerrado la app (ver FcmClient.send_data)."""
    return FcmNotification(
        title=aviso["titulo"],
        body=aviso["cuerpo"],
        channel_id=ANDROID_AVISOS_CHANNEL,
        tag=f"aviso_{aviso['aviso_id']}",
    )


def push_manual_reminder(db: Session, reminder: ManualReminder, aviso: dict) -> dict[str, int]:
    """Envía el recordatorio a los dispositivos activos de la clienta.
    Nunca lanza: cualquier fallo se registra y el recordatorio sigue su curso.
    Devuelve un resumen {sent, invalid, failed} (para tests y logs)."""
    try:
        devices = active_devices_query(db).filter(ClientDevice.client_id == reminder.client_id).all()
        return send_push_to_devices(
            db,
            devices,
            manual_reminder_push_data(aviso, reminder.appointment_id),
            manual_reminder_notification(aviso),
            deadline_seconds=PUSH_DEADLINE_SECONDS,
        ).as_dict()
    except Exception as exc:
        logger.warning(
            "FCM: falló el envío del recordatorio %s: %s", reminder.id, type(exc).__name__
        )
        db.rollback()
        return PushSummary().as_dict()


# ── Reserva agendada desde el panel ──────────────────────────────────────────

_DIAS = ("lun", "mar", "mié", "jue", "vie", "sáb", "dom")


def _reservation_when(start) -> str:
    # start_time es hora local de La Paz; si llega con zona (columna
    # timestamptz) solo se quita: el reloj ya es el local.
    start = start.replace(tzinfo=None)
    return f"{_DIAS[start.weekday()]} {start:%d/%m} a las {start:%H:%M}"


def reservation_created_message(appointments: list) -> tuple[str, str]:
    """Título y cuerpo del aviso. Con varios tickets (un servicio cada uno)
    se anuncia la hora del primero."""
    first = min(appointments, key=lambda a: a.start_time)
    branch = first.branch.name if first.branch else None
    where = f" en {branch}" if branch else ""
    body = f"Tu reserva{where} quedó agendada para el {_reservation_when(first.start_time)}."
    return "Reserva agendada", body


def push_reservation_created(appointment_ids: list[int]) -> dict[str, int]:
    """Avisa por push a la clienta que el personal le agendó una reserva.

    Pensado para BackgroundTasks: abre su propia sesión (la del request ya se
    cerró) y nunca lanza; es de mejor esfuerzo, la reserva ya está guardada.
    Sin dispositivos con push, sin FCM configurado o con los avisos de
    clientas desactivados, no envía nada."""
    # Import local: appointment_notice_service ya importa entidades pesadas y
    # evita un ciclo con este módulo.
    from app.application.services.appointment_notice_service import FINAL_STATUSES, client_notices_active
    from app.domain.entities.service_agenda import Appointment
    from app.infrastructure.database.session import SessionLocal

    summary = PushSummary()
    if not appointment_ids or not client_notices_active():
        return summary.as_dict()
    db = SessionLocal()
    try:
        appointments = (
            db.query(Appointment).filter(Appointment.id.in_(appointment_ids)).all()
        )
        by_client: dict[int, list] = {}
        for appointment in appointments:
            if appointment.status in FINAL_STATUSES:
                continue
            by_client.setdefault(appointment.client_id, []).append(appointment)

        for client_id, client_appointments in by_client.items():
            devices = active_devices_query(db).filter(ClientDevice.client_id == client_id).all()
            if not devices:
                continue
            title, body = reservation_created_message(client_appointments)
            first = min(client_appointments, key=lambda a: a.start_time)
            result = send_push_to_devices(
                db,
                devices,
                {
                    "type": "reservation_created",
                    "appointment_id": str(first.id),
                    "cita_id": str(first.id),
                    "titulo": title,
                    "cuerpo": body,
                },
                FcmNotification(
                    title=title,
                    body=body,
                    channel_id=ANDROID_AVISOS_CHANNEL,
                    tag=f"reserva_{first.id}",
                ),
                deadline_seconds=PUSH_DEADLINE_SECONDS,
            )
            summary.sent += result.sent
            summary.invalid += result.invalid
            summary.failed += result.failed
    except Exception as exc:
        logger.warning("FCM: falló el aviso de reserva %s: %s", appointment_ids, type(exc).__name__)
        db.rollback()
    finally:
        db.close()
    return summary.as_dict()
