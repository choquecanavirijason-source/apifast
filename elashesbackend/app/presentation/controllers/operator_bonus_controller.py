"""Pagos extra / bonos a operarias (ver Corte de Caja). Cuentan como egreso
en /reports/cash-summary, junto a los gastos y las comisiones pagadas."""
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session, joinedload

from app.core.audit import record_audit
from app.core.dependencies import get_db, require_any_permission, resolve_branch_id
from app.domain.entities.operator_bonus import OperatorBonus
from app.domain.entities.user import User

router = APIRouter(prefix="/operator-bonuses", tags=["Pagos extra"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class OperatorBonusCreate(BaseModel):
    professional_id: int
    amount: float = Field(..., gt=0, le=100000)
    bonus_date: date
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    # Caja de la que sale. Si no viene, la sucursal de la operaria.
    branch_id: Optional[int] = Field(default=None, ge=1)


class OperatorBonusOut(BaseModel):
    id: int
    professional_id: int
    professional_name: str
    branch_id: Optional[int]
    branch_name: Optional[str]
    amount: float
    bonus_date: str
    reason: str
    created_at: str
    created_by_name: Optional[str]


def _to_out(b: OperatorBonus) -> OperatorBonusOut:
    return OperatorBonusOut(
        id=b.id,
        professional_id=b.professional_id,
        professional_name=b.professional.username if b.professional else "—",
        branch_id=b.branch_id,
        branch_name=b.branch.name if b.branch else None,
        amount=b.amount,
        bonus_date=b.bonus_date.isoformat(),
        reason=b.reason,
        created_at=b.created_at.isoformat() if b.created_at else "",
        created_by_name=b.created_by.username if b.created_by else None,
    )


def _check_branch(branch_id: Optional[int], user: User) -> None:
    # Roles acotados a su sucursal (Cajera...) solo tocan los de su caja.
    if resolve_branch_id(branch_id, user) != branch_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes registrar o eliminar pagos extra de tu sucursal.",
        )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[OperatorBonusOut])
def list_operator_bonuses(
    branch_id: Optional[int] = Query(default=None, ge=1),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    professional_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:view", "payments:manage")),
):
    q = db.query(OperatorBonus).options(
        joinedload(OperatorBonus.professional),
        joinedload(OperatorBonus.branch),
        joinedload(OperatorBonus.created_by),
    )
    if branch_id:
        q = q.filter(OperatorBonus.branch_id == branch_id)
    if from_date:
        q = q.filter(OperatorBonus.bonus_date >= from_date)
    if to_date:
        q = q.filter(OperatorBonus.bonus_date <= to_date)
    if professional_id:
        q = q.filter(OperatorBonus.professional_id == professional_id)
    return [_to_out(b) for b in q.order_by(OperatorBonus.bonus_date.desc(), OperatorBonus.id.desc()).all()]


@router.post("", response_model=OperatorBonusOut, status_code=status.HTTP_201_CREATED)
def create_operator_bonus(
    body: OperatorBonusCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:manage")),
):
    professional = db.query(User).filter(User.id == body.professional_id).first()
    if not professional:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operaria no encontrada.")
    branch_id = body.branch_id if body.branch_id is not None else professional.branch_id
    _check_branch(branch_id, current_user)

    bonus = OperatorBonus(
        professional_id=professional.id,
        branch_id=branch_id,
        amount=round(body.amount, 2),
        bonus_date=body.bonus_date,
        reason=body.reason,
        created_by_id=current_user.id,
    )
    db.add(bonus)
    db.commit()
    db.refresh(bonus)
    record_audit(
        db, current_user, "create", "operator_bonus", bonus.id,
        f"Registró un pago extra de Bs {bonus.amount:.2f} a '{professional.username}': {bonus.reason}",
        branch_id=branch_id,
    )
    return _to_out(bonus)


@router.delete("/{bonus_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_operator_bonus(
    bonus_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:manage")),
):
    bonus = (
        db.query(OperatorBonus)
        .options(joinedload(OperatorBonus.professional))
        .filter(OperatorBonus.id == bonus_id)
        .first()
    )
    if not bonus:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pago extra no encontrado.")
    _check_branch(bonus.branch_id, current_user)
    description = (
        f"Eliminó el pago extra de Bs {bonus.amount:.2f} a "
        f"'{bonus.professional.username if bonus.professional else bonus.professional_id}': {bonus.reason}"
    )
    branch_id = bonus.branch_id
    db.delete(bonus)
    db.commit()
    record_audit(db, current_user, "delete", "operator_bonus", bonus_id, description, branch_id=branch_id)
