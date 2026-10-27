"""
Push por Firebase Cloud Messaging de los recordatorios manuales, para que
lleguen con la app cerrada. Es un canal más, de mejor esfuerzo: el
recordatorio ya está guardado y emitido por WebSocket cuando se llama aquí,
y la app lo vuelve a recibir en /avisos/programados (mismo aviso_id).
"""
import logging
import time

from sqlalchemy.orm import Session

from app.domain.entities.client_device import ClientDevice
from app.domain.entities.manual_reminder import ManualReminder
from app.infrastructure.push.fcm_client import FcmResult, get_fcm_client, mask_token

logger = logging.getLogger("elashes.fcm")

# Tope para todos los dispositivos de la clienta juntos (cada llamada tiene
# además su propio timeout en el cliente).
PUSH_DEADLINE_SECONDS = 8.0


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


def push_manual_reminder(db: Session, reminder: ManualReminder, aviso: dict) -> dict[str, int]:
    """Envía el recordatorio a los dispositivos activos (no revocados, con
    token FCM) de la clienta y borra los tokens que FCM da por inválidos.
    Nunca lanza: cualquier fallo se registra y el recordatorio sigue su curso.
    Devuelve un resumen {sent, invalid, failed} (para tests y logs)."""
    summary = {"sent": 0, "invalid": 0, "failed": 0}
    try:
        client = get_fcm_client()
        if client is None:
            return summary

        devices = (
            db.query(ClientDevice)
            .filter(ClientDevice.client_id == reminder.client_id)
            .filter(ClientDevice.revoked_at.is_(None))
            .filter(ClientDevice.fcm_token.isnot(None))
            .all()
        )
        if not devices:
            return summary

        data = manual_reminder_push_data(aviso, reminder.appointment_id)
        deadline = time.monotonic() + PUSH_DEADLINE_SECONDS
        invalid: list[ClientDevice] = []
        for device in devices:
            if time.monotonic() >= deadline:
                summary["failed"] += 1
                continue
            result = client.send_data(device.fcm_token, data)
            if result is FcmResult.SENT:
                summary["sent"] += 1
            elif result is FcmResult.INVALID_TOKEN:
                summary["invalid"] += 1
                invalid.append(device)
            else:
                summary["failed"] += 1

        if invalid:
            _clear_invalid_tokens(db, invalid)
    except Exception as exc:
        logger.warning(
            "FCM: falló el envío del recordatorio %s: %s", reminder.id, type(exc).__name__
        )
        db.rollback()
    return summary


def _clear_invalid_tokens(db: Session, devices: list[ClientDevice]) -> None:
    for device in devices:
        logger.info("FCM: se borra el token %s del dispositivo %s", mask_token(device.fcm_token), device.id)
        device.fcm_token = None
        device.fcm_token_updated_at = None
    db.commit()
