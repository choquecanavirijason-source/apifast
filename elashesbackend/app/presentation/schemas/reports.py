from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel

DEFAULT_COMMISSION_RATE = 0.40


class DailyClosingItem(BaseModel):
    appointment_id: int
    ticket_code: Optional[str] = None
    sale_code: Optional[str] = None          # código de venta POS vinculada
    client_name: str
    service_names: List[str]
    professional_name: str
    professional_id: Optional[int] = None
    start_time: datetime
    duration_minutes: int
    status: str
    total_price: float
    commission_rate: float                   # porcentaje real de la operaria (0.0–1.0)
    commission: float
    branch_name: str
    sale_id: Optional[int] = None           # id de la venta POS vinculada (para cobrar al finalizar)
    payment_method: Optional[str] = None    # efectivo, QR, transferencia, tarjeta
    is_paid: bool = False                   # tiene venta POS pagada vinculada
    advance_payment_amount: float = 0.0    # adelanto registrado al hacer la reserva
    balance_due: float = 0.0               # saldo pendiente = total_price - advance_payment_amount

    class Config:
        from_attributes = True


class ProfessionalSummary(BaseModel):
    professional_id: Optional[int]
    professional_name: str
    ticket_count: int
    total_price: float
    commission: float
    commission_rate: float


class DailyClosingResponse(BaseModel):
    date: str
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    items: List[DailyClosingItem]
    grand_total: float
    grand_commission: float
    total_paid: float                        # suma de tickets con venta POS pagada
    total_unpaid: float                      # suma de tickets sin venta o sin pagar
    totals_by_payment: Dict[str, float]      # {"cash": 600, "qr": 400, ...}
    summary_by_professional: List[ProfessionalSummary]


class UpdateStatusBody(BaseModel):
    status: str  # "completed" | "cancelled" | "pending" | "in_service"


# ── Cierre de Caja ────────────────────────────────────────────────────────────

class CashCloseCreate(BaseModel):
    date: str
    branch_id: Optional[int] = None
    grand_total: float = 0.0
    grand_commission: float = 0.0
    total_paid: float = 0.0
    total_unpaid: float = 0.0
    notes: Optional[str] = None


class CashCloseResponse(BaseModel):
    id: int
    date: str
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    closed_by_id: Optional[int] = None
    closed_by_name: Optional[str] = None
    closed_at: datetime
    grand_total: float
    grand_commission: float
    total_paid: float
    total_unpaid: float
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class CommissionReceiptCreate(BaseModel):
    date: str
    branch_id: Optional[int] = None
    professional_id: Optional[int] = None
    professional_name: str
    amount: float = 0.0


class CommissionReceiptResponse(BaseModel):
    id: int
    date: str
    branch_id: Optional[int] = None
    professional_id: Optional[int] = None
    professional_name: str
    amount: float
    confirmed_by_id: Optional[int] = None
    confirmed_by_name: Optional[str] = None
    confirmed_at: datetime

    class Config:
        from_attributes = True
