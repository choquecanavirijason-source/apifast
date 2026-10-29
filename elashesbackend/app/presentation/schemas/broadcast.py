from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, BeforeValidator, EmailStr, Field, StringConstraints, model_validator

from app.domain.entities.broadcast import (
    BROADCAST_BODY_MAX_LENGTH,
    BROADCAST_TITLE_MAX_LENGTH,
    MAX_SELECTED_CLIENTS,
)

BroadcastKind = Literal["aviso", "promocion", "novedad"]
BroadcastAudience = Literal["all", "upcoming_appointment", "retouch_due", "inactive", "selected"]
BroadcastStatus = Literal["sending", "sent", "interrupted"]
PushDelivery = Literal["sent", "failed", "no_app"]
EmailDelivery = Literal["sent", "failed", "no_email"]
AudienceDays = Annotated[int, Field(ge=1, le=365)]

# Solo imágenes subidas con POST /broadcasts/image: nada de URLs de afuera
# (píxeles de rastreo, sitios ajenos) en el push o el correo de las clientas.
BROADCAST_IMAGE_PATTERN = r"^/media/broadcasts/[0-9a-f]{32}\.(jpg|jpeg|png|webp|bmp)$"


def _blank_as_none(value):
    return (value.strip() or None) if isinstance(value, str) else value


class BroadcastContent(BaseModel):
    """Lo que ve la clienta: sirve para enviar y para la vista previa del correo."""

    kind: BroadcastKind
    # Se recortan los espacios antes de validar: un texto en blanco no vale.
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=BROADCAST_TITLE_MAX_LENGTH)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=BROADCAST_BODY_MAX_LENGTH)]
    image_url: Optional[Annotated[str, StringConstraints(pattern=BROADCAST_IMAGE_PATTERN)]] = None


class BroadcastCreate(BroadcastContent):
    audience: BroadcastAudience = "all"
    audience_days: Optional[AudienceDays] = None
    # Vacío = todas las sucursales (solo Admin/Secretaria; el resto, la suya).
    branch_id: Optional[int] = None
    send_push: bool = True
    send_email: bool = False
    # Uno de los remitentes autorizados; vacío = el por defecto del servidor.
    email_from: Annotated[Optional[EmailStr], BeforeValidator(_blank_as_none)] = None
    # Con audience "selected": las clientas elegidas (sin repetir).
    client_ids: list[int] = Field(default_factory=list, max_length=MAX_SELECTED_CLIENTS)

    @model_validator(mode="after")
    def _check_channels_and_clients(self):
        if not (self.send_push or self.send_email):
            raise ValueError("Elige al menos un canal de envío (push o correo).")
        if self.audience == "selected" and not self.client_ids:
            raise ValueError("Elige al menos una clienta.")
        self.client_ids = sorted(set(self.client_ids)) if self.audience == "selected" else []
        return self


class EmailPreviewResponse(BaseModel):
    subject: str
    html: str


class AudiencePreviewResponse(BaseModel):
    clients: int
    with_push: int
    with_email: int
    # Cupo diario de la cuenta SMTP, para avisar antes de pasarse.
    email_daily_limit: int


class BroadcastImageResponse(BaseModel):
    image_url: str
    # Como la ven los celulares; null = falta PUBLIC_BASE_URL y la imagen no
    # saldrá en el push (el correo la lleva incrustada).
    public_url: Optional[str] = None


class BroadcastResponse(BaseModel):
    id: int
    kind: BroadcastKind
    title: str
    body: str
    image_url: Optional[str] = None
    audience: BroadcastAudience
    audience_days: Optional[int] = None
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    send_push: bool
    send_email: bool
    email_from: Optional[str] = None
    status: BroadcastStatus
    recipients_count: int
    push_sent: int
    push_failed: int
    email_sent: int
    email_failed: int
    created_by_name: Optional[str] = None
    # UTC con zona ("Z") para que el panel muestre la hora local sin adivinar.
    created_at: datetime
    finished_at: Optional[datetime] = None


class BroadcastRecipientResponse(BaseModel):
    client_id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    branch_name: Optional[str] = None
    # null = ese canal no se pidió o todavía no se procesó.
    push_status: Optional[PushDelivery] = None
    email_status: Optional[EmailDelivery] = None


class RecipientCandidateResponse(BaseModel):
    id: int
    name: str
    branch_name: Optional[str] = None
    has_app: bool
    has_email: bool
    notificaciones_activas: bool
