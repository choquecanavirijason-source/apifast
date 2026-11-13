from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class BirthdayCouponConfigResponse(BaseModel):
    enabled: bool
    percent: float
    window_days: int


class BirthdayCouponConfigUpdate(BaseModel):
    enabled: bool
    percent: float = Field(..., ge=0, le=100)
    window_days: int = Field(..., ge=0, le=30)

    @model_validator(mode="after")
    def percent_required_when_enabled(self):
        if self.enabled and self.percent <= 0:
            raise ValueError("Para activar el cupón, el descuento debe ser mayor que 0.")
        return self


class BirthdayCouponEligibility(BaseModel):
    """Si a esta clienta se le puede ofrecer hoy el cupón de cumpleaños."""
    eligible: bool
    # Por qué no: disabled | no_client | generic | no_birth_date | outside_window | already_used
    reason: Optional[str] = None
    message: Optional[str] = None
    percent: float = 0
    window_days: int = 0
    birthday: Optional[date] = None


class BirthdayCouponRedemptionResponse(BaseModel):
    id: int
    client_id: int
    client_name: str
    sale_id: Optional[int] = None
    sale_code: Optional[str] = None
    percent: float
    discount_amount: float
    applied_by: Optional[str] = None
    created_at: datetime


class BirthdayCouponRedemptionList(BaseModel):
    items: List[BirthdayCouponRedemptionResponse]
