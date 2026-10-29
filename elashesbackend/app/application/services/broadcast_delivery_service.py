"""
Envío de un comunicado, después de responder al panel (BackgroundTasks).

Va por lotes y guarda el avance después de cada uno, así el panel muestra el
progreso mientras tanto. Push y correo son de mejor esfuerzo: un fallo se
cuenta y el envío sigue con las demás. Si algo inesperado lo corta, el
comunicado queda "interrupted" (nunca "sending" para siempre).
"""
import logging
import smtplib
from dataclasses import dataclass
from datetime import datetime
from html import escape
from typing import Callable, Iterable, Iterator, Sequence, TypeVar

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.application.services.broadcast_audience_service import has_email
from app.application.services.broadcast_service import broadcast_aviso
from app.application.services.push_service import (
    ANDROID_AVISOS_CHANNEL,
    active_devices_query,
    send_push_to_devices,
)
from app.core.media import read_media_file
from app.domain.entities.broadcast import (
    DELIVERY_FAILED,
    DELIVERY_NO_APP,
    DELIVERY_NO_EMAIL,
    DELIVERY_SENT,
    MARKETING_KINDS,
    STATUS_INTERRUPTED,
    STATUS_SENDING,
    STATUS_SENT,
    Broadcast,
    BroadcastRecipient,
)
from app.domain.entities.client import Client
from app.domain.entities.client_device import ClientDevice
from app.infrastructure.email.inline_image import InlineImage, inline_image
from app.infrastructure.email.layout import AUTOMATIC_FOOTER, paragraph_html, render_email
from app.infrastructure.email.smtp_client import build_message, smtp_connection
from app.infrastructure.push.fcm_client import FcmNotification

logger = logging.getLogger("elashes.broadcasts")

# Envíos entre cada guardado del avance (y correos por conexión SMTP).
BATCH_SIZE = 25

MARKETING_FOOTER = (
    "Recibes este correo por ser clienta de Elashes. "
    "Si no quieres recibir promociones, pídelo en tu sucursal."
)

T = TypeVar("T")


def _batches(items: Sequence[T], size: int = BATCH_SIZE) -> Iterator[Sequence[T]]:
    for start in range(0, len(items), size):
        yield items[start:start + size]


# ── Mensajes ─────────────────────────────────────────────────────────────────

def broadcast_push_data(aviso: dict) -> dict[str, str]:
    """Data message: el mismo aviso que GET /avisos/comunicados, más type.
    FCM solo admite strings; imagen_url se omite si no hay."""
    data = {"type": "broadcast", "tipo": "comunicado"}
    data.update({key: str(value) for key, value in aviso.items() if value is not None})
    return data


def broadcast_notification(aviso: dict) -> FcmNotification:
    return FcmNotification(
        title=aviso["titulo"],
        body=aviso["cuerpo"],
        channel_id=ANDROID_AVISOS_CHANNEL,
        tag=f"aviso_{aviso['aviso_id']}",
        image=aviso["imagen_url"],
    )


@dataclass(frozen=True)
class BroadcastEmail:
    subject: str
    html: str
    text: str
    images: tuple[InlineImage, ...] = ()


def build_broadcast_email(broadcast: Broadcast) -> BroadcastEmail:
    """El correo del comunicado. La imagen va incrustada (CID): se ve sin URL
    pública y no la bloquean como contenido remoto. Todo lo del panel se escapa."""
    image = inline_image(read_media_file(broadcast.image_url), broadcast.image_url or "", "comunicado")
    image_html = (
        f'<img src="{image.src}" alt="{escape(broadcast.title)}" width="464" style="display:block;width:100%;'
        'max-width:464px;height:auto;border:0;border-radius:10px;margin:14px 0 18px;">'
        if image else ""
    )
    content_html = (
        f'{image_html}<p style="margin:{"0" if image else "14px 0 0"};color:#5c4a54;font-size:15px;'
        f'line-height:1.5;">{paragraph_html(broadcast.body)}</p>'
    )
    footer = MARKETING_FOOTER if broadcast.kind in MARKETING_KINDS else AUTOMATIC_FOOTER
    return BroadcastEmail(
        subject=broadcast.title,
        html=render_email(broadcast.title, content_html, footer),
        text=f"{broadcast.title}\n\n{broadcast.body}",
        images=(image,) if image else (),
    )


# ── Envío ────────────────────────────────────────────────────────────────────

def _recipients(db: Session, broadcast_id: int):
    return db.query(BroadcastRecipient).filter(BroadcastRecipient.broadcast_id == broadcast_id)


def _mark(db: Session, broadcast_id: int, column, value: str, client_ids: Iterable[int]) -> None:
    """Resultado de un canal para esas clientas (un lote: el IN queda acotado)."""
    client_ids = list(client_ids)
    if client_ids:
        _recipients(db, broadcast_id).filter(BroadcastRecipient.client_id.in_(client_ids)).update(
            {column: value}, synchronize_session=False
        )


def _deliver_push(db: Session, broadcast: Broadcast) -> None:
    # Sin un dispositivo con push no hay a dónde enviarlo.
    with_app = active_devices_query(db).with_entities(ClientDevice.client_id).statement
    _recipients(db, broadcast.id).filter(BroadcastRecipient.client_id.notin_(with_app)).update(
        {BroadcastRecipient.push_status: DELIVERY_NO_APP}, synchronize_session=False
    )
    db.commit()

    devices = (
        active_devices_query(db)
        .join(BroadcastRecipient, and_(
            BroadcastRecipient.client_id == ClientDevice.client_id,
            BroadcastRecipient.broadcast_id == broadcast.id,
        ))
        .order_by(ClientDevice.client_id, ClientDevice.id)
        .all()
    )
    by_client: dict[int, list[ClientDevice]] = {}
    for device in devices:
        by_client.setdefault(device.client_id, []).append(device)

    aviso = broadcast_aviso(broadcast)
    data, notification = broadcast_push_data(aviso), broadcast_notification(aviso)
    # Por clientas (no por dispositivos): así cada lote sabe si a cada una le
    # llegó a al menos uno de sus celulares.
    for batch in _batches(list(by_client.items())):
        summary = send_push_to_devices(db, [d for _, ds in batch for d in ds], data, notification)
        sent = {cid for cid, ds in batch if any(d.id in summary.sent_device_ids for d in ds)}
        _mark(db, broadcast.id, BroadcastRecipient.push_status, DELIVERY_SENT, sent)
        _mark(db, broadcast.id, BroadcastRecipient.push_status, DELIVERY_FAILED,
              (cid for cid, _ in batch if cid not in sent))
        # Un token inválido es una app desinstalada: no le llegó.
        broadcast.push_sent += summary.sent
        broadcast.push_failed += summary.failed + summary.invalid
        db.commit()


def _send_email_batch(clients: Sequence[Client], email: BroadcastEmail, sender: str) -> set[int]:
    """Una conexión SMTP por lote. Una dirección rechazada no frena a las
    demás; si se cae la conexión (o se agota el cupo diario) el resto del
    lote cuenta como fallido. Devuelve las clientas que aceptó el servidor."""
    sent: set[int] = set()
    try:
        with smtp_connection() as server:
            for client in clients:
                try:
                    server.send_message(build_message(
                        client.email.strip(), email.subject, email.html, email.text, sender, email.images,
                    ))
                    sent.add(client.id)
                except smtplib.SMTPRecipientsRefused:
                    continue
    except Exception as exc:
        logger.warning("Correo: se cortó un lote del comunicado: %s", type(exc).__name__)
    return sent


def _deliver_email(db: Session, broadcast: Broadcast) -> None:
    without_email = db.query(Client.id).filter(~has_email()).statement
    _recipients(db, broadcast.id).filter(BroadcastRecipient.client_id.in_(without_email)).update(
        {BroadcastRecipient.email_status: DELIVERY_NO_EMAIL}, synchronize_session=False
    )
    db.commit()

    clients = (
        db.query(Client)
        .join(BroadcastRecipient, and_(
            BroadcastRecipient.client_id == Client.id,
            BroadcastRecipient.broadcast_id == broadcast.id,
        ))
        .filter(has_email())
        .order_by(Client.id)
        .all()
    )
    email = build_broadcast_email(broadcast)
    for batch in _batches(clients):
        sent = _send_email_batch(batch, email, broadcast.email_from)
        _mark(db, broadcast.id, BroadcastRecipient.email_status, DELIVERY_SENT, sent)
        _mark(db, broadcast.id, BroadcastRecipient.email_status, DELIVERY_FAILED,
              (c.id for c in batch if c.id not in sent))
        broadcast.email_sent += len(sent)
        broadcast.email_failed += len(batch) - len(sent)
        db.commit()


def deliver_broadcast(broadcast_id: int, session_factory: Callable[[], Session]) -> None:
    """Envía el comunicado por sus canales y lo cierra. Nunca lanza."""
    db = session_factory()
    try:
        broadcast = db.get(Broadcast, broadcast_id)
        if broadcast is None or broadcast.status != STATUS_SENDING:
            return
        final_status = STATUS_SENT
        try:
            if broadcast.send_push:
                _deliver_push(db, broadcast)
            if broadcast.send_email:
                _deliver_email(db, broadcast)
        except Exception as exc:
            logger.warning("Comunicado %s: el envío se cortó: %s", broadcast_id, type(exc).__name__)
            db.rollback()
            final_status = STATUS_INTERRUPTED
        broadcast.status = final_status
        broadcast.finished_at = datetime.utcnow()
        db.commit()
    except Exception as exc:
        logger.warning("Comunicado %s: no se pudo cerrar el envío: %s", broadcast_id, type(exc).__name__)
        db.rollback()
    finally:
        db.close()
