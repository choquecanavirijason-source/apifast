from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.client import ClientSummary
from app.schemas.payment import PaymentResponse
from app.schemas.service_agenda import AppointmentResponse
from app.schemas.user import UserSummary


class PosSaleItemCreate(BaseModel):
    service_id: int = Field(..., ge=1)
    professional_id: Optional[int] = Field(default=None, ge=1)
    is_ia: bool = False
    start_time: datetime
    end_time: datetime
    branch_id: Optional[int] = Field(default=None, ge=1)


class PosSaleCreate(BaseModel):
    client_id: int = Field(..., ge=1)
    branch_id: Optional[int] = Field(default=None, ge=1)
    payment_method: str = Field(default="cash", min_length=2, max_length=50)
    discount_type: Literal["amount", "percent"] = "amount"
    discount_value: float = Field(default=0, ge=0)
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[PosSaleItemCreate] = Field(..., min_length=1)


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
