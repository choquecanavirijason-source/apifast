from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.branch import BranchSummary
from app.schemas.client import ClientSummary
from app.schemas.user import UserSummary


class PaymentBase(BaseModel):
    client_id: int
    branch_id: Optional[int] = None
    appointment_id: Optional[int] = None
    sale_id: Optional[int] = None
    amount: float = Field(..., gt=0)
    method: str = Field(..., min_length=2, max_length=50)
    status: str = Field(default="paid", min_length=2, max_length=30)
    reference: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=500)
    paid_at: Optional[datetime] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(BaseModel):
    client_id: Optional[int] = None
    branch_id: Optional[int] = None
    appointment_id: Optional[int] = None
    sale_id: Optional[int] = None
    amount: Optional[float] = Field(default=None, gt=0)
    method: Optional[str] = Field(default=None, min_length=2, max_length=50)
    status: Optional[str] = Field(default=None, min_length=2, max_length=30)
    reference: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=500)
    paid_at: Optional[datetime] = None


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    branch_id: Optional[int] = None
    appointment_id: Optional[int] = None
    sale_id: Optional[int] = None
    registered_by_id: Optional[int] = None
    amount: float
    method: str
    status: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    paid_at: datetime

    client: ClientSummary
    branch: Optional[BranchSummary] = None
    registered_by: Optional[UserSummary] = None