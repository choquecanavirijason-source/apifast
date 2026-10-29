"""
Comunicados a clientas (Notificaciones > Comunicados): avisos, promociones y
novedades a un grupo o a todas, por push y/o correo. Permiso broadcasts:send.
"""
from datetime import datetime, timezone
from typing import Callable, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.application.services.broadcast_audience_service import (
    AudienceSpec,
    audience_client_ids,
    search_recipients,
    summarize_audience,
)
from app.application.services.broadcast_delivery_service import build_broadcast_email, deliver_broadcast
from app.application.services.broadcast_service import (
    BroadcastDraft,
    create_broadcast,
    get_broadcast,
    list_broadcasts,
    list_recipients,
)
from app.config.settings import settings
from app.core.dependencies import get_db, get_session_factory, require_permission, resolve_branch_id
from app.core.media import MAX_NOTIFICATION_IMAGE_BYTES, public_media_url, save_catalog_image
from app.domain.entities.broadcast import MAX_SELECTED_CLIENTS, Broadcast, BroadcastRecipient
from app.domain.entities.user import User
from app.infrastructure.email.inline_image import with_data_uris
from app.presentation.schemas.broadcast import (
    AudienceDays,
    AudiencePreviewResponse,
    BroadcastAudience,
    BroadcastContent,
    BroadcastCreate,
    BroadcastImageResponse,
    BroadcastKind,
    BroadcastRecipientResponse,
    BroadcastResponse,
    EmailPreviewResponse,
    RecipientCandidateResponse,
)

router = APIRouter(prefix="/broadcasts", tags=["Comunicados"])
can_send = require_permission("broadcasts:send")


def _utc(value: Optional[datetime]) -> Optional[datetime]:
    return value.replace(tzinfo=timezone.utc) if value else None


def to_response(broadcast: Broadcast) -> BroadcastResponse:
    return BroadcastResponse.model_validate(broadcast, from_attributes=True).model_copy(update={
        "branch_name": broadcast.branch.name if broadcast.branch else None,
        "created_by_name": broadcast.author.username if broadcast.author else None,
        "created_at": _utc(broadcast.created_at),
        "finished_at": _utc(broadcast.finished_at),
    })


@router.get("/audience", response_model=AudiencePreviewResponse)
def preview_audience(
    kind: BroadcastKind = "aviso",
    audience: BroadcastAudience = "all",
    days: Optional[AudienceDays] = Query(default=None),
    branch_id: Optional[int] = None,
    client_ids: list[int] = Query(default=[], max_length=MAX_SELECTED_CLIENTS),
    db: Session = Depends(get_db),
    current_user: User = Depends(can_send),
):
    """Cuántas clientas recibirían el comunicado y por qué canal, antes de enviarlo."""
    spec = AudienceSpec(audience, kind, resolve_branch_id(branch_id, current_user), days, tuple(client_ids))
    summary = summarize_audience(db, audience_client_ids(db, spec))
    return AudiencePreviewResponse(
        clients=summary.clients,
        with_push=summary.with_push,
        with_email=summary.with_email,
        email_daily_limit=settings.smtp_daily_limit,
    )


@router.post(
    "/image",
    response_model=BroadcastImageResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_send)],
)
def upload_broadcast_image(file: UploadFile = File(...)):
    """Imagen del comunicado (máx. 1 MB: Firebase descarta las más pesadas)."""
    image_url = save_catalog_image(file, "broadcasts", max_bytes=MAX_NOTIFICATION_IMAGE_BYTES)
    return BroadcastImageResponse(image_url=image_url, public_url=public_media_url(image_url))


@router.post("/email-preview", response_model=EmailPreviewResponse, dependencies=[Depends(can_send)])
def preview_email(payload: BroadcastContent):
    """El correo tal como se enviaría (misma plantilla que el envío real).
    La imagen incrustada se pasa a data: URI porque "cid:" solo existe dentro
    de un programa de correo."""
    email = build_broadcast_email(Broadcast(**payload.model_dump()))
    return EmailPreviewResponse(subject=email.subject, html=with_data_uris(email.html, email.images))


@router.post("", response_model=BroadcastResponse, status_code=status.HTTP_202_ACCEPTED)
def send_broadcast(
    payload: BroadcastCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    session_factory: Callable[[], Session] = Depends(get_session_factory),
    current_user: User = Depends(can_send),
):
    """Guarda el comunicado y responde de inmediato (202); el envío sigue en
    segundo plano. El avance se consulta con GET /broadcasts/{id}.
    409 si ya hay otro enviándose; 400 si el grupo no tiene clientas."""
    draft = BroadcastDraft(**{**payload.model_dump(), "client_ids": tuple(payload.client_ids)})
    broadcast = create_broadcast(db, draft, current_user)
    background_tasks.add_task(deliver_broadcast, broadcast.id, session_factory)
    return to_response(broadcast)


@router.get("/clients", response_model=list[RecipientCandidateResponse])
def search_clients(
    search: str = Query(..., min_length=2, max_length=100),
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(can_send),
):
    """Buscador de "Clientas específicas": nombre, teléfono, correo o CI."""
    return search_recipients(db, search, resolve_branch_id(branch_id, current_user))


@router.get("", response_model=list[BroadcastResponse])
def broadcast_history(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(can_send),
):
    return [to_response(b) for b in list_broadcasts(db, current_user, limit)]


@router.get("/{broadcast_id}", response_model=BroadcastResponse)
def broadcast_detail(
    broadcast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(can_send),
):
    return to_response(get_broadcast(db, broadcast_id, current_user))


def _recipient_response(recipient: BroadcastRecipient) -> BroadcastRecipientResponse:
    client = recipient.client
    return BroadcastRecipientResponse(
        client_id=client.id,
        name=f"{client.name} {client.last_name}".strip(),
        phone=client.phone,
        email=client.email,
        branch_name=client.branch.name if client.branch else None,
        push_status=recipient.push_status,
        email_status=recipient.email_status,
    )


@router.get("/{broadcast_id}/recipients", response_model=list[BroadcastRecipientResponse])
def broadcast_recipients(
    broadcast_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(can_send),
):
    """A quién se le envió y cómo le fue por canal, clienta por clienta."""
    return [_recipient_response(r) for r in list_recipients(db, broadcast_id, current_user)]
