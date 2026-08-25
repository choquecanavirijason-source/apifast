from datetime import datetime
from typing import List, Literal, Optional, Set

from pydantic import BaseModel, ConfigDict, Field

from app.presentation.schemas.client import ClientSummary
from app.presentation.schemas.payment import PaymentResponse
from app.presentation.schemas.service_agenda import AppointmentResponse
from app.presentation.schemas.user import UserSummary


class PosSaleItemCreate(BaseModel):
    # Ticket individual: service_id obligatorio
    # Ticket grupal   : service_ids con ≥2 servicios, service_id puede omitirse
    service_id: Optional[int] = Field(default=None, ge=1)
    service_ids: Optional[List[int]] = Field(default=None, min_length=1)
    professional_id: Optional[int] = Field(default=None, ge=1)
    is_ia: bool = False
    start_time: datetime
    end_time: datetime
    branch_id: Optional[int] = Field(default=None, ge=1)


class MixedPaymentEntry(BaseModel):
    method: str = Field(..., min_length=2, max_length=50)
    amount: float = Field(..., gt=0)


class PosSaleCreate(BaseModel):
    # Opcional: si no viene, la venta se registra con el "Cliente Mostrador"
    # de la sucursal (walk-in) para no frenar el servicio por falta de datos.
    client_id: Optional[int] = Field(default=None, ge=1)
    branch_id: Optional[int] = Field(default=None, ge=1)
    payment_method: str = Field(default="cash", min_length=2, max_length=50)
    discount_type: Literal["amount", "percent"] = "amount"
    discount_value: float = Field(default=0, ge=0)
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[PosSaleItemCreate] = Field(..., min_length=1)
    link_appointment_id: Optional[int] = Field(
        default=None,
        ge=1,
        description="Enlaza la venta a esta reserva existente en lugar de crear citas nuevas.",
    )
    sale_without_appointments: bool = Field(
        default=False,
        description="Solo cobro: no crea citas en agenda; los horarios de items se ignoran.",
    )
    reservation_only: bool = Field(
        default=False,
        description="Solo reserva en agenda: una venta reserved, varios tickets, sin pago.",
    )
    mixed_payments: Optional[List[MixedPaymentEntry]] = Field(
        default=None,
        description="Pago mixto: lista de {method, amount}. Si se provee, payment_method se ignora y se usa 'mixed'.",
    )


class PosSaleUpdate(BaseModel):
    client_id: Optional[int] = Field(default=None, ge=1)
    discount_type: Optional[Literal["amount", "percent"]] = None
    discount_value: Optional[float] = Field(default=None, ge=0)
    payment_method: Optional[str] = Field(default=None, min_length=2, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=500)
    status: Optional[Literal["paid", "cancelled"]] = None


class PosSaleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sale_code: str
    client_id: int
    branch_id: Optional[int] = None
    created_by_id: Optional[int] = None
    subtotal: float
    discount_type: str
    discount_value: float
    total: float
    payment_method: str
    status: str
    notes: Optional[str] = None
    created_at: datetime

    client: ClientSummary
    created_by: Optional[UserSummary] = None
    appointments: List[AppointmentResponse] = []
    payments: List[PaymentResponse] = []
