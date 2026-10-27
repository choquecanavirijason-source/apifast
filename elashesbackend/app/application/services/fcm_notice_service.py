"""
Push por FCM de los avisos programados (manana / hoy / mantenimiento /
retiro) cuando llega su hora de mostrarse, para que lleguen con la app
cerrada. Lo dispara un job de APScheduler cada minuto (ver main.py).

Usa el mismo token (client_devices.fcm_token) y el mismo cliente HTTP v1
que los recordatorios manuales (push_service). Los recordatorios manuales se
omiten aquí: push_service ya los envía en el momento en que se crean.

Cada aviso aceptado por FCM se anota en fcm_notice_deliveries por
dispositivo, para no reenviarlo en el siguiente sondeo. La app deduplica por
aviso_id contra las notificaciones locales que programó al sincronizar.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.application.services.appointment_notice_service import (
    LA_PAZ,
    TIPO_RECORDATORIO_MANUAL,
    client_notices_active,
    get_scheduled_notices,
)
from app.domain.entities.client_device import ClientDevice, FcmNoticeDelivery
from app.infrastructure.push.fcm_client import FcmResult, get_fcm_client, mask_token

logger = logging.getLogger("elashes.fcm")


def _notice_key(notice: dict) -> str:
    return ":".join(
        str(notice.get(field) or "")
        for field in ("aviso_id", "tipo", "cita_id", "seguimiento_id")
    )


def scheduled_notice_push_data(notice: dict) -> dict[str, str]:
    """Data message del aviso: los mismos campos que /avisos/programados más
    type, para que la app lo trate igual que el aviso sincronizado. FCM solo
    admite strings; cita_id / seguimiento_id se omiten cuando son null."""
    data = {
        "type": "scheduled_notice",
        "aviso_id": str(notice["aviso_id"]),
        "tipo": notice["tipo"],
        "titulo": notice["titulo"],
        "cuerpo": notice["cuerpo"],
        "mostrar_en": notice["mostrar_en"],
        "expira_en": notice["expira_en"],
    }
    for field in ("cita_id", "seguimiento_id"):
        if notice.get(field) is not None:
            data[field] = str(notice[field])
    return data


def send_due_fcm_notices(db: Session, now_utc: Optional[datetime] = None) -> int:
    """Entrega una vez por dispositivo cada aviso cuya hora de mostrar ya llegó
    y que aún no caducó. Devuelve cuántos envíos aceptó FCM."""
    if not client_notices_active():
        return 0
    client = get_fcm_client()
    if client is None:
        return 0

    now_utc = now_utc or datetime.now(timezone.utc)
    now_local = now_utc.astimezone(LA_PAZ)
    devices = (
        db.query(ClientDevice)
        .filter(ClientDevice.revoked_at.is_(None))
        .filter(ClientDevice.fcm_token.isnot(None))
        .all()
    )
    by_client: dict[int, list[ClientDevice]] = {}
    for device in devices:
        by_client.setdefault(device.client_id, []).append(device)

    sent = 0
    for client_id, client_devices in by_client.items():
        notices = get_scheduled_notices(db, client_id, now_utc)["avisos"]
        due_notices = [
            notice for notice in notices
            if notice["tipo"] != TIPO_RECORDATORIO_MANUAL
            and datetime.fromisoformat(notice["mostrar_en"]) <= now_local
            and datetime.fromisoformat(notice["expira_en"]) > now_local
        ]
        if not due_notices:
            continue

        for device in client_devices:
            for notice in due_notices:
                key = _notice_key(notice)
                already_sent = (
                    db.query(FcmNoticeDelivery)
                    .filter(
                        FcmNoticeDelivery.device_id == device.id,
                        FcmNoticeDelivery.notice_key == key,
                    )
                    .first()
                )
                if already_sent is not None:
                    continue

                result = client.send_data(device.fcm_token, scheduled_notice_push_data(notice))
                if result is FcmResult.INVALID_TOKEN:
                    logger.info(
                        "FCM: se borra el token %s del dispositivo %s",
                        mask_token(device.fcm_token),
                        device.id,
                    )
                    device.fcm_token = None
                    device.fcm_token_updated_at = None
                    db.commit()
                    break
                if result is not FcmResult.SENT:
                    # Error transitorio: se reintenta en el siguiente sondeo.
                    continue

                db.add(
                    FcmNoticeDelivery(
                        device_id=device.id,
                        notice_key=key,
                        sent_at=now_utc.replace(tzinfo=None),
                    )
                )
                db.commit()
                sent += 1

    return sent
