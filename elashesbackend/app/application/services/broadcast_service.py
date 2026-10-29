"""
Comunicados (Notificaciones > Comunicados): crear, consultar y la bandeja
que lee la app.

create_broadcast guarda el comunicado y su lista exacta de destinatarias en
la transacción del request; el envío corre después de responder (ver
broadcast_delivery_service.deliver_broadcast), así el panel no espera a que
salgan cientos de push y correos.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.application.services.appointment_notice_service import make_broadcast_aviso_id, utc_naive_to_local
from app.application.services.broadcast_audience_service import AudienceSpec, audience_client_ids
from app.application.services.reminder_sender_service import resolve_sender
from app.core.audit import record_audit
from app.core.dependencies import resolve_branch_id
from app.core.media import public_media_url
from app.domain.entities.broadcast import (
    STATUS_INTERRUPTED,
    STATUS_SENDING,
    Broadcast,
    BroadcastRecipient,
)
from app.domain.entities.client import Client
from app.domain.entities.user import User
from app.infrastructure.email.smtp_client import is_email_configured

# La bandeja de la app muestra los comunicados de la última semana.
FEED_MAX_AGE = timedelta(days=7)
FEED_MAX_ITEMS = 20

KIND_LABELS = {"aviso": "Aviso", "promocion": "Promoción", "novedad": "Novedad"}


@dataclass(frozen=True)
class BroadcastDraft:
    """Lo que el panel pide enviar (ya validado por el schema)."""

    kind: str
    title: str
    body: str
    audience: str
    image_url: Optional[str] = None
    audience_days: Optional[int] = None
    branch_id: Optional[int] = None
    send_push: bool = True
    send_email: bool = False
    email_from: Optional[str] = None
    # Solo con audience "selected".
    client_ids: tuple[int, ...] = ()


def _bad_request(detail: str, code: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


def _validate_channels(db: Session, draft: BroadcastDraft) -> None:
    if not draft.send_email:
        return
    if not is_email_configured():
        raise _bad_request("El envío de correos no está configurado en el servidor.", status.HTTP_503_SERVICE_UNAVAILABLE)
    if draft.email_from and not resolve_sender(db, draft.email_from):
        raise _bad_request(f"El correo emisor {draft.email_from} no está en la lista de remitentes autorizados.")


def create_broadcast(
    db: Session, draft: BroadcastDraft, user: User, now_utc: Optional[datetime] = None
) -> Broadcast:
    """Valida, fija las destinatarias y deja el comunicado en "sending"."""
    now_utc = now_utc or datetime.now(timezone.utc)
    if db.query(Broadcast.id).filter(Broadcast.status == STATUS_SENDING).first():
        raise _bad_request("Ya hay un comunicado enviándose; espera a que termine.", status.HTTP_409_CONFLICT)
    _validate_channels(db, draft)

    # Un rol acotado a su sucursal solo le escribe a las clientas de la suya.
    branch_id = resolve_branch_id(draft.branch_id, user)
    spec = AudienceSpec(draft.audience, draft.kind, branch_id, draft.audience_days, draft.client_ids)
    client_ids = audience_client_ids(db, spec, now_utc)
    if not client_ids:
        raise _bad_request("No hay clientas en este grupo.")

    broadcast = Broadcast(
        kind=draft.kind,
        title=draft.title,
        body=draft.body,
        image_url=draft.image_url,
        audience=draft.audience,
        audience_days=draft.audience_days,
        branch_id=branch_id,
        send_push=draft.send_push,
        send_email=draft.send_email,
        email_from=resolve_sender(db, draft.email_from) if draft.send_email else None,
        status=STATUS_SENDING,
        recipients_count=len(client_ids),
        created_by=user.id,
        created_at=now_utc.replace(tzinfo=None),
    )
    db.add(broadcast)
    db.flush()
    db.bulk_insert_mappings(
        BroadcastRecipient, [{"broadcast_id": broadcast.id, "client_id": client_id} for client_id in client_ids]
    )
    canales = " y ".join(name for name, on in (("push", draft.send_push), ("correo", draft.send_email)) if on)
    record_audit(
        db, user, "create", "broadcast", broadcast.id,
        f"Envió el comunicado '{draft.title}' ({KIND_LABELS[draft.kind]}, {canales}) a {len(client_ids)} clientas",
        branch_id=branch_id,
    )
    db.commit()
    db.refresh(broadcast)
    return broadcast


def _scoped_query(db: Session, user: User):
    query = db.query(Broadcast).options(joinedload(Broadcast.branch), joinedload(Broadcast.author))
    scope = resolve_branch_id(None, user)
    return query if scope is None else query.filter(Broadcast.branch_id == scope)


def list_broadcasts(db: Session, user: User, limit: int) -> list[Broadcast]:
    return _scoped_query(db, user).order_by(Broadcast.created_at.desc(), Broadcast.id.desc()).limit(limit).all()


def get_broadcast(db: Session, broadcast_id: int, user: User) -> Broadcast:
    broadcast = _scoped_query(db, user).filter(Broadcast.id == broadcast_id).first()
    if broadcast is None:
        raise _bad_request("Comunicado no encontrado", status.HTTP_404_NOT_FOUND)
    return broadcast


def list_recipients(db: Session, broadcast_id: int, user: User) -> list[BroadcastRecipient]:
    """Destinatarias del comunicado con su resultado por canal, por nombre."""
    get_broadcast(db, broadcast_id, user)  # 404 si no existe o es de otra sucursal
    return (
        db.query(BroadcastRecipient)
        .join(Client, Client.id == BroadcastRecipient.client_id)
        .options(joinedload(BroadcastRecipient.client).joinedload(Client.branch))
        .filter(BroadcastRecipient.broadcast_id == broadcast_id)
        .order_by(Client.name, Client.last_name)
        .all()
    )


def broadcast_aviso(broadcast: Broadcast) -> dict:
    """El comunicado como lo ve la app: en la bandeja y en el push (mismo aviso_id)."""
    return {
        "aviso_id": make_broadcast_aviso_id(broadcast.id),
        "categoria": broadcast.kind,
        "titulo": broadcast.title,
        "cuerpo": broadcast.body,
        "imagen_url": public_media_url(broadcast.image_url),
        "enviado_en": utc_naive_to_local(broadcast.created_at).isoformat(),
    }


def client_broadcast_feed(db: Session, client_id: int, now_utc: Optional[datetime] = None) -> list[dict]:
    """Comunicados de la última semana que le tocaron a la clienta por push,
    del más nuevo al más viejo."""
    now_utc = now_utc or datetime.now(timezone.utc)
    since = now_utc.replace(tzinfo=None) - FEED_MAX_AGE
    broadcasts = (
        db.query(Broadcast)
        .join(BroadcastRecipient, BroadcastRecipient.broadcast_id == Broadcast.id)
        .filter(BroadcastRecipient.client_id == client_id)
        .filter(Broadcast.send_push.is_(True))
        .filter(Broadcast.created_at >= since)
        .order_by(Broadcast.created_at.desc(), Broadcast.id.desc())
        .limit(FEED_MAX_ITEMS)
        .all()
    )
    return [broadcast_aviso(broadcast) for broadcast in broadcasts]


def mark_interrupted_broadcasts(db: Session) -> int:
    """Al arrancar: un comunicado que seguía "enviando" se cortó con el
    reinicio. Se marca para que el panel no lo muestre en curso para siempre
    y deje enviar otro."""
    count = (
        db.query(Broadcast)
        .filter(Broadcast.status == STATUS_SENDING)
        .update({Broadcast.status: STATUS_INTERRUPTED, Broadcast.finished_at: datetime.utcnow()})
    )
    db.commit()
    return count
