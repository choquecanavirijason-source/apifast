"""Gastos de caja por sucursal (ver Corte de Caja / Caja en Salones)."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_any_permission
from app.core.media import save_catalog_image
from app.domain.entities.expense import Expense
from app.domain.entities.user import User

router = APIRouter(prefix="/expenses", tags=["Gastos"])


# Subida de la foto del comprobante — endpoint propio (no /catalog/upload-image)
# porque ese pide catalog:manage, un permiso sin relación con registrar un
# gasto de caja; acá se pide payments:manage, que sí es el correcto.
@router.post("/upload-photo", status_code=status.HTTP_201_CREATED)
def upload_expense_photo(
    file: UploadFile = File(...),
    _: User = Depends(require_any_permission("payments:manage")),
):
    image_path = save_catalog_image(file=file, folder="expenses")
    return {"image": image_path}


# ── Schemas ───────────────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    branch_id: int
    amount: float = Field(..., gt=0)
    description: str = Field(..., min_length=1, max_length=500)
    expense_date: date
    photo_url: Optional[str] = None


class ExpenseOut(BaseModel):
    id: int
    branch_id: int
    branch_name: str
    amount: float
    description: str
    expense_date: str
    photo_url: Optional[str]
    created_at: str
    created_by_name: Optional[str]

    class Config:
        from_attributes = True


def _to_out(e: Expense) -> ExpenseOut:
    return ExpenseOut(
        id=e.id,
        branch_id=e.branch_id,
        branch_name=e.branch.name if e.branch else "—",
        amount=e.amount,
        description=e.description,
        expense_date=e.expense_date.isoformat(),
        photo_url=e.photo_url,
        created_at=e.created_at.isoformat() if e.created_at else "",
        created_by_name=e.created_by.username if e.created_by else None,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    branch_id: Optional[int] = Query(default=None, ge=1),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:view", "payments:manage")),
):
    q = db.query(Expense).options(joinedload(Expense.branch), joinedload(Expense.created_by))
    if branch_id:
        q = q.filter(Expense.branch_id == branch_id)
    if from_date:
        q = q.filter(Expense.expense_date >= from_date)
    if to_date:
        q = q.filter(Expense.expense_date <= to_date)

    expenses = q.order_by(Expense.expense_date.desc(), Expense.id.desc()).all()
    return [_to_out(e) for e in expenses]


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(
    body: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:manage")),
):
    expense = Expense(
        branch_id=body.branch_id,
        amount=body.amount,
        description=body.description,
        expense_date=body.expense_date,
        photo_url=body.photo_url,
        created_by_id=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _to_out(expense)


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:manage")),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    db.delete(expense)
    db.commit()
