"""Apertura y cierre de caja por sucursal (ver Salones → Caja).

Mientras una sucursal no tenga una sesión "open", el POS no deja crear
ventas ahí — ver pos_sale_service.create_sale."""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.core.dependencies import get_db, require_any_permission
from app.domain.entities.cash_close import CashClose
from app.domain.entities.expense import Expense
from app.domain.entities.payment import Payment
from app.domain.entities.user import User

router = APIRouter(prefix="/cash-sessions", tags=["Caja"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CashSessionOpen(BaseModel):
    branch_id: int
    opening_amount: float = Field(..., ge=0)
    notes: Optional[str] = Field(default=None, max_length=500)


class CashSessionClose(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=500)
    # Lo que la cajera contó físicamente al cerrar — obligatorio, para que
    # no se pueda cerrar sin hacer el arqueo.
    counted_amount: float = Field(..., ge=0)


class CashSessionOut(BaseModel):
    id: int
    date: str
    branch_id: Optional[int]
    branch_name: str
    status: str
    opened_by_name: Optional[str]
    opened_at: str
    opening_amount: Optional[float]
    closed_by_name: Optional[str]
    closed_at: Optional[str]
    grand_total: float
    grand_commission: float
    total_paid: float
    total_unpaid: float
    cash_sales: Optional[float]
    cash_expenses: Optional[float]
    expected_cash: Optional[float]
    counted_amount: Optional[float]
    difference: Optional[float]
    notes: Optional[str]

    class Config:
        from_attributes = True


def _to_out(c: CashClose) -> CashSessionOut:
    return CashSessionOut(
        id=c.id,
        date=c.date,
        branch_id=c.branch_id,
        branch_name=c.branch.name if c.branch else "—",
        status=c.status,
        opened_by_name=c.opened_by.username if c.opened_by else None,
        opened_at=c.opened_at.isoformat() if c.opened_at else "",
        opening_amount=c.opening_amount,
        closed_by_name=c.closed_by.username if c.closed_by else None,
        closed_at=c.closed_at.isoformat() if c.closed_at else None,
        grand_total=c.grand_total,
        grand_commission=c.grand_commission,
        total_paid=c.total_paid,
        total_unpaid=c.total_unpaid,
        cash_sales=c.cash_sales,
        cash_expenses=c.cash_expenses,
        expected_cash=c.expected_cash,
        counted_amount=c.counted_amount,
        difference=c.difference,
        notes=c.notes,
    )


def _query(db: Session):
    return db.query(CashClose).options(
        joinedload(CashClose.branch),
        joinedload(CashClose.opened_by),
        joinedload(CashClose.closed_by),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/current", response_model=Optional[CashSessionOut])
def get_current_session(
    branch_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:view", "payments:manage")),
):
    """Sesión abierta de esta sucursal, o null si no hay ninguna."""
    session = (
        _query(db)
        .filter(CashClose.branch_id == branch_id, CashClose.status == "open")
        .order_by(CashClose.id.desc())
        .first()
    )
    return _to_out(session) if session else None


@router.get("", response_model=list[CashSessionOut])
def list_sessions(
    branch_id: Optional[int] = Query(default=None, ge=1),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:view", "payments:manage")),
):
    q = _query(db)
    if branch_id:
        q = q.filter(CashClose.branch_id == branch_id)
    if from_date:
        q = q.filter(CashClose.date >= from_date.isoformat())
    if to_date:
        q = q.filter(CashClose.date <= to_date.isoformat())
    sessions = q.order_by(CashClose.id.desc()).all()
    return [_to_out(s) for s in sessions]


@router.post("/open", response_model=CashSessionOut, status_code=201)
def open_cash_session(
    body: CashSessionOpen,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:manage")),
):
    existing = (
        db.query(CashClose)
        .filter(CashClose.branch_id == body.branch_id, CashClose.status == "open")
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Ya hay una caja abierta en esta sucursal. Cerrala antes de abrir una nueva.",
        )

    now = datetime.utcnow()
    session = CashClose(
        date=now.date().isoformat(),
        branch_id=body.branch_id,
        status="open",
        opened_by_id=current_user.id,
        opened_at=now,
        opening_amount=body.opening_amount,
        notes=body.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _to_out(_query(db).filter(CashClose.id == session.id).first())


@router.post("/{session_id}/close", response_model=CashSessionOut)
def close_cash_session(
    session_id: int,
    body: CashSessionClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:manage")),
):
    session = db.query(CashClose).filter(CashClose.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión de caja no encontrada.")
    if session.status != "open":
        raise HTTPException(status_code=409, detail="Esta sesión ya está cerrada.")

    now = datetime.utcnow()
    payments = (
        db.query(Payment)
        .filter(
            Payment.branch_id == session.branch_id,
            Payment.status == "paid",
            Payment.paid_at >= session.opened_at,
            Payment.paid_at <= now,
        )
        .all()
    )
    grand_total = sum(p.amount for p in payments)  # todos los métodos, informativo
    total_paid = grand_total
    total_unpaid = 0.0

    # Arqueo: solo efectivo — es lo único que físicamente pasa por la caja.
    # Tarjeta/QR/transferencia no suman ni restan billetes en el cajón.
    cash_sales = sum(p.amount for p in payments if p.method == "cash")
    cash_expenses_qs = (
        db.query(Expense)
        .filter(
            Expense.branch_id == session.branch_id,
            Expense.created_at >= session.opened_at,
            Expense.created_at <= now,
        )
        .all()
    )
    cash_expenses = sum(e.amount for e in cash_expenses_qs)
    expected_cash = (session.opening_amount or 0.0) + cash_sales - cash_expenses

    session.status = "closed"
    session.closed_by_id = current_user.id
    session.closed_at = now
    session.grand_total = grand_total
    session.total_paid = total_paid
    session.total_unpaid = total_unpaid
    session.cash_sales = cash_sales
    session.cash_expenses = cash_expenses
    session.expected_cash = expected_cash
    session.counted_amount = body.counted_amount
    session.difference = body.counted_amount - expected_cash
    if body.notes:
        session.notes = f"{session.notes}\n{body.notes}".strip() if session.notes else body.notes

    db.commit()
    db.refresh(session)
    return _to_out(_query(db).filter(CashClose.id == session.id).first())


@router.get("/{session_id}/detail")
def get_session_detail(
    session_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:view", "payments:manage")),
):
    """Desglose de una sesión: ingresos por método de pago y gastos
    registrados en su ventana de tiempo (apertura → cierre, o ahora si
    sigue abierta) — para revisar de dónde salió cada monto del cierre."""
    session = db.query(CashClose).filter(CashClose.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Sesión de caja no encontrada.")

    window_end = session.closed_at or datetime.utcnow()

    payments = (
        db.query(Payment)
        .filter(
            Payment.branch_id == session.branch_id,
            Payment.status == "paid",
            Payment.paid_at >= session.opened_at,
            Payment.paid_at <= window_end,
        )
        .order_by(Payment.paid_at.desc())
        .all()
    )
    by_method: dict[str, float] = {"cash": 0.0, "card": 0.0, "transfer": 0.0, "qr": 0.0, "mixed": 0.0}
    for p in payments:
        by_method[p.method] = by_method.get(p.method, 0.0) + p.amount

    expenses = (
        db.query(Expense)
        .filter(
            Expense.branch_id == session.branch_id,
            Expense.created_at >= session.opened_at,
            Expense.created_at <= window_end,
        )
        .order_by(Expense.created_at.desc())
        .all()
    )

    cash_sales_live = by_method["cash"]
    cash_expenses_live = sum(e.amount for e in expenses)
    expected_cash_live = (session.opening_amount or 0.0) + cash_sales_live - cash_expenses_live

    return {
        # Arqueo en vivo — si la sesión sigue abierta, se recalcula con lo
        # que hay hasta este momento (no hace falta cerrar para verlo).
        "cash_sales": cash_sales_live,
        "cash_expenses": cash_expenses_live,
        "expected_cash": expected_cash_live,
        "income_by_method": {
            "efectivo": by_method["cash"],
            "tarjeta": by_method["card"],
            "transferencia": by_method["transfer"],
            "qr": by_method["qr"],
            "mixto": by_method["mixed"],
            "total": sum(by_method.values()),
        },
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "method": p.method,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                "client_name": f"{p.client.name} {p.client.last_name or ''}".strip() if p.client else None,
            }
            for p in payments
        ],
        "expenses": [
            {
                "id": e.id,
                "amount": e.amount,
                "description": e.description,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in expenses
        ],
    }
