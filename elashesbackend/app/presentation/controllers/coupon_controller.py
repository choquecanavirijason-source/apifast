from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.application.services import birthday_coupon_service as coupons
from app.core.audit import record_audit
from app.core.dependencies import get_db, require_any_permission, require_any_role
from app.domain.entities.user import User
from app.presentation.schemas.coupon import (
    BirthdayCouponConfigResponse,
    BirthdayCouponConfigUpdate,
    BirthdayCouponEligibility,
    BirthdayCouponRedemptionList,
    BirthdayCouponRedemptionResponse,
)

router = APIRouter(prefix="/coupons", tags=["Cupones"])

ADMIN_ROLES = ("Admin", "SuperAdmin")


def _config_response(config) -> BirthdayCouponConfigResponse:
    return BirthdayCouponConfigResponse(
        enabled=bool(config.enabled), percent=float(config.percent or 0), window_days=int(config.window_days or 0)
    )


@router.get("/birthday/config", response_model=BirthdayCouponConfigResponse)
def get_birthday_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(*ADMIN_ROLES)),
):
    return _config_response(coupons.get_config(db))


@router.put("/birthday/config", response_model=BirthdayCouponConfigResponse)
def update_birthday_config(
    payload: BirthdayCouponConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(*ADMIN_ROLES)),
):
    config = coupons.update_config(
        db, enabled=payload.enabled, percent=payload.percent, window_days=payload.window_days, user_id=current_user.id
    )
    record_audit(
        db, current_user, "update", "coupon_config", 1,
        f"Cupón de cumpleaños: {'activo' if payload.enabled else 'desactivado'}, "
        f"{payload.percent:g}% de descuento, {payload.window_days} día(s) de vigencia",
    )
    return _config_response(config)


@router.get("/birthday/eligibility", response_model=BirthdayCouponEligibility)
def get_birthday_eligibility(
    client_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:manage", "appointments:manage")),
):
    """Si a esta clienta se le puede ofrecer hoy el cupón (el POS lo consulta al elegirla)."""
    return coupons.check_eligibility(db, client_id)


@router.get("/birthday/redemptions", response_model=BirthdayCouponRedemptionList)
def list_birthday_redemptions(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(*ADMIN_ROLES)),
):
    items = []
    for row in coupons.list_redemptions(db, limit=limit):
        client = row.client
        items.append(
            BirthdayCouponRedemptionResponse(
                id=row.id,
                client_id=row.client_id,
                client_name=f"{client.name} {client.last_name}".strip() if client else "—",
                sale_id=row.sale_id,
                sale_code=row.sale.sale_code if row.sale else None,
                percent=float(row.percent),
                discount_amount=float(row.discount_amount or 0),
                applied_by=row.applied_by.username if row.applied_by else None,
                created_at=row.created_at,
            )
        )
    return BirthdayCouponRedemptionList(items=items)
