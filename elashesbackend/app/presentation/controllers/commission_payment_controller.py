"""Historial de pagos de comisiones a operarias."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_any_permission
from app.domain.entities.commission_payment import CommissionPayment
from app.domain.entities.user import User

router = APIRouter(prefix="/commission-payments", tags=["Comisiones"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CommissionPaymentCreate(BaseModel):
    professional_id: int
    amount: float = Field(..., gt=0)
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    registered_at: Optional[str] = None   # ISO string; si no viene usa now()


class CommissionPaymentOut(BaseModel):
    id: int
    professional_id: int
    professional_name: str
    amount: float
    period_start: Optional[str]
    period_end: Optional[str]
    notes: Optional[str]
    registered_at: str
    registered_by_name: Optional[str]

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CommissionPaymentOut])
def list_commission_payments(
    professional_id: Optional[int] = Query(default=None),
    from_date: Optional[str] = Query(default=None),
    to_date: Optional[str] = Query(default=None),
    # Coincidencia exacta de período — usado por Cierre de Caja para saber si
    # ya se confirmó la entrega de comisión de un rango de fechas puntual.
    period_start: Optional[str] = Query(default=None),
    period_end: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:view", "payments:manage")),
):
    q = db.query(CommissionPayment).options(
        joinedload(CommissionPayment.professional),
        joinedload(CommissionPayment.registered_by),
    )
    if professional_id:
        q = q.filter(CommissionPayment.professional_id == professional_id)
    if from_date:
        q = q.filter(CommissionPayment.registered_at >= from_date)
    if to_date:
        q = q.filter(CommissionPayment.registered_at <= f"{to_date}T23:59:59")
    if period_start:
        q = q.filter(CommissionPayment.period_start == period_start)
    if period_end:
        q = q.filter(CommissionPayment.period_end == period_end)

    payments = q.order_by(CommissionPayment.registered_at.desc()).all()

    return [
        CommissionPaymentOut(
            id=p.id,
            professional_id=p.professional_id,
            professional_name=p.professional.username if p.professional else "—",
            amount=p.amount,
            period_start=p.period_start,
            period_end=p.period_end,
            notes=p.notes,
            registered_at=p.registered_at.isoformat() if p.registered_at else "",
            registered_by_name=p.registered_by.username if p.registered_by else None,
        )
        for p in payments
    ]


@router.post("", response_model=CommissionPaymentOut, status_code=201)
def create_commission_payment(
    body: CommissionPaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:manage")),
):
    reg_at = datetime.now(timezone.utc)
    if body.registered_at:
        try:
            reg_at = datetime.fromisoformat(body.registered_at.replace("Z", "+00:00"))
        except ValueError:
            pass

    payment = CommissionPayment(
        professional_id=body.professional_id,
        amount=body.amount,
        period_start=body.period_start,
        period_end=body.period_end,
        notes=body.notes,
        registered_at=reg_at,
        registered_by_id=current_user.id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    pro = db.query(User).filter(User.id == payment.professional_id).first()
    by = db.query(User).filter(User.id == payment.registered_by_id).first() if payment.registered_by_id else None

    return CommissionPaymentOut(
        id=payment.id,
        professional_id=payment.professional_id,
        professional_name=pro.username if pro else "—",
        amount=payment.amount,
        period_start=payment.period_start,
        period_end=payment.period_end,
        notes=payment.notes,
        registered_at=payment.registered_at.isoformat(),
        registered_by_name=by.username if by else None,
    )


@router.delete("/{payment_id}", status_code=204)
def delete_commission_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:manage")),
):
    payment = db.query(CommissionPayment).filter(CommissionPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Registro no encontrado.")
    db.delete(payment)
    db.commit()
