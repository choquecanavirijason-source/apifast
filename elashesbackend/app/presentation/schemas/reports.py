from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


COMMISSION_RATE = 0.40


class DailyClosingItem(BaseModel):
    appointment_id: int
    ticket_code: Optional[str] = None
    client_name: str
    service_names: List[str]
    professional_name: str
    start_time: datetime
    duration_minutes: int
    status: str
    total_price: float
    commission: float
    branch_name: str

    class Config:
        from_attributes = True


class DailyClosingResponse(BaseModel):
    date: str
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    items: List[DailyClosingItem]
    grand_total: float
    grand_commission: float


class UpdateStatusBody(BaseModel):
    status: str  # "completed" | "cancelled" | "pending" | "in_service"
