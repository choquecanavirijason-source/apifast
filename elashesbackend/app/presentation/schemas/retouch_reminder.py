from typing import Literal, Optional

from pydantic import BaseModel, Field

RetouchType = Literal["mantenimiento", "retiro"]


class RetouchReminderSend(BaseModel):
    # Confirms the exact server-generated preview; no arbitrary recipient/body.
    preview_version: str = Field(min_length=64, max_length=64)
    send_push: bool = False
    send_email: bool = False


class RetouchReminderResult(BaseModel):
    broadcast_id: int
    status: str
    send_push: bool
    send_email: bool
    push_status: Optional[str] = None
    email_status: Optional[str] = None


class RetouchReminderPreview(BaseModel):
    client_id: int
    clienta: str
    servicio: str
    tipo: RetouchType
    fecha_objetivo: str
    dias_restantes: int
    appointment_state: Literal["sin_cita", "no_verificada"]
    appointment_note: str
    message: str
    push_available: bool
    email_available: bool
    consent: bool
    delivery_enabled: bool
    preview_version: str
    result: Optional[RetouchReminderResult] = None
