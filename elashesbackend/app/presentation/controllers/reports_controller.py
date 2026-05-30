from collections import defaultdict
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.dependencies import get_db, require_any_permission
from app.domain.entities.branch import Branch
from app.domain.entities.cash_close import CashClose, CommissionReceipt
from app.domain.entities.inventory import Batch, Product
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.service_agenda import Appointment, AppointmentService
from app.domain.entities.user import User
from app.presentation.schemas.reports import (
    DEFAULT_COMMISSION_RATE,
    CashCloseCreate,
    CashCloseResponse,
    CommissionReceiptCreate,
    CommissionReceiptResponse,
    DailyClosingItem,
    DailyClosingResponse,
    ProfessionalSummary,
    UpdateStatusBody,
)


router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/daily-closing", response_model=DailyClosingResponse)
def get_daily_closing(
    date: str = Query(..., description="Fecha en formato YYYY-MM-DD"),
    branch_id: Optional[int] = Query(default=None, ge=1),
    professional_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:view", "payments:manage")),
):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")

    query = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.client),
            joinedload(Appointment.professional),
            joinedload(Appointment.branch),
            joinedload(Appointment.service),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service),
        )
        .filter(func.date(Appointment.start_time) == target_date)
    )

    if branch_id:
        query = query.filter(Appointment.branch_id == branch_id)
    if professional_id:
        query = query.filter(Appointment.professional_id == professional_id)

    appointments = query.order_by(Appointment.start_time).all()

    # Cargar ventas POS vinculadas en una sola consulta
    sale_ids = [a.sale_id for a in appointments if a.sale_id is not None]
    sales_by_id: dict[int, PosSale] = {}
    if sale_ids:
        sales = db.query(PosSale).filter(PosSale.id.in_(sale_ids)).all()
        sales_by_id = {s.id: s for s in sales}

    items: list[DailyClosingItem] = []
    totals_by_payment: dict[str, float] = defaultdict(float)
    total_paid = 0.0
    total_unpaid = 0.0

    prof_agg: dict[int | None, dict] = {}

    for appt in appointments:
        # ── Servicios y precio ────────────────────────────────────────────
        service_names: list[str] = []
        total_price = 0.0

        if appt.appointment_services:
            for as_item in sorted(appt.appointment_services, key=lambda x: x.sort_order):
                if as_item.service:
                    service_names.append(as_item.service.name)
                    total_price += as_item.service.price

        if not service_names and appt.service:
            service_names.append(appt.service.name)
            total_price = appt.service.price

        if not service_names:
            service_names = ["Sin servicio"]

        # ── Comisión por operaria ─────────────────────────────────────────
        commission_rate = (
            appt.professional.commission_rate
            if appt.professional and appt.professional.commission_rate is not None
            else DEFAULT_COMMISSION_RATE
        )
        commission = round(total_price * commission_rate, 2)

        # ── Datos de la venta POS vinculada ───────────────────────────────
        sale = sales_by_id.get(appt.sale_id) if appt.sale_id else None
        payment_method = sale.payment_method if sale else None
        is_paid = sale is not None and sale.status == "paid"
        sale_code = sale.sale_code if sale else None

        # ── Totales agrupados ─────────────────────────────────────────────
        if is_paid and payment_method:
            totals_by_payment[payment_method] += total_price
            total_paid += total_price
        else:
            total_unpaid += total_price

        # ── Duración ─────────────────────────────────────────────────────
        duration_minutes = max(
            int((appt.end_time - appt.start_time).total_seconds() / 60), 0
        ) if appt.end_time and appt.start_time else 0

        professional_name = appt.professional.username if appt.professional else "Sin asignar"
        professional_id_val = appt.professional.id if appt.professional else None
        client_name = (
            f"{appt.client.name} {appt.client.last_name or ''}".strip()
            if appt.client else "Sin cliente"
        )
        branch_name = appt.branch.name if appt.branch else ""

        advance = float(appt.advance_payment_amount or 0.0)
        balance_due = max(0.0, total_price - advance) if not is_paid else 0.0

        items.append(DailyClosingItem(
            appointment_id=appt.id,
            ticket_code=appt.ticket_code,
            sale_id=appt.sale_id,
            sale_code=sale_code,
            client_name=client_name,
            service_names=service_names,
            professional_name=professional_name,
            professional_id=professional_id_val,
            start_time=appt.start_time,
            duration_minutes=duration_minutes,
            status=appt.status,
            total_price=total_price,
            commission_rate=commission_rate,
            commission=commission,
            branch_name=branch_name,
            payment_method=payment_method,
            is_paid=is_paid,
            advance_payment_amount=advance,
            balance_due=round(balance_due, 2),
        ))

        # ── Acumulado por operaria ────────────────────────────────────────
        key = professional_id_val
        if key not in prof_agg:
            prof_agg[key] = {
                "professional_id": professional_id_val,
                "professional_name": professional_name,
                "ticket_count": 0,
                "total_price": 0.0,
                "commission": 0.0,
                "commission_rate": commission_rate,
            }
        prof_agg[key]["ticket_count"] += 1
        prof_agg[key]["total_price"] += total_price
        prof_agg[key]["commission"] += commission

    summary_by_professional = [
        ProfessionalSummary(
            professional_id=v["professional_id"],
            professional_name=v["professional_name"],
            ticket_count=v["ticket_count"],
            total_price=round(v["total_price"], 2),
            commission=round(v["commission"], 2),
            commission_rate=v["commission_rate"],
        )
        for v in sorted(prof_agg.values(), key=lambda x: x["professional_name"])
    ]

    grand_total = round(sum(i.total_price for i in items), 2)
    grand_commission = round(sum(i.commission for i in items), 2)

    branch_name_label: Optional[str] = None
    if branch_id:
        branch_obj = db.query(Branch).filter(Branch.id == branch_id).first()
        if branch_obj:
            branch_name_label = branch_obj.name

    return DailyClosingResponse(
        date=date,
        branch_id=branch_id,
        branch_name=branch_name_label,
        items=items,
        grand_total=grand_total,
        grand_commission=grand_commission,
        total_paid=round(total_paid, 2),
        total_unpaid=round(total_unpaid, 2),
        totals_by_payment={k: round(v, 2) for k, v in totals_by_payment.items()},
        summary_by_professional=summary_by_professional,
    )


@router.patch("/daily-closing/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    body: UpdateStatusBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:manage")),
):
    allowed = {"pending", "in_service", "completed", "cancelled", "confirmed"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Use: {', '.join(allowed)}")

    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    appt.status = body.status
    db.commit()
    return {"ok": True, "appointment_id": appointment_id, "status": appt.status}


# ─────────────────────────────────────────────────────────────────────────────
# Cierre de Caja
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/cash-close", response_model=Optional[CashCloseResponse])
def get_cash_close(
    date: str = Query(...),
    branch_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:view", "payments:manage")),
):
    """Devuelve el cierre de caja de esa fecha/sucursal, o null si no existe."""
    q = db.query(CashClose).filter(CashClose.date == date)
    if branch_id:
        q = q.filter(CashClose.branch_id == branch_id)
    else:
        q = q.filter(CashClose.branch_id.is_(None))
    record = q.first()
    if not record:
        return None

    branch_name = record.branch.name if record.branch else None
    closed_by_name = record.closed_by.username if record.closed_by else None

    return CashCloseResponse(
        id=record.id,
        date=record.date,
        branch_id=record.branch_id,
        branch_name=branch_name,
        closed_by_id=record.closed_by_id,
        closed_by_name=closed_by_name,
        closed_at=record.closed_at,
        grand_total=record.grand_total,
        grand_commission=record.grand_commission,
        total_paid=record.total_paid,
        total_unpaid=record.total_unpaid,
        notes=record.notes,
    )


@router.post("/cash-close", response_model=CashCloseResponse, status_code=201)
def close_cash_register(
    body: CashCloseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:manage")),
):
    """Cierra la caja para la fecha/sucursal indicada."""
    q = db.query(CashClose).filter(CashClose.date == body.date)
    if body.branch_id:
        q = q.filter(CashClose.branch_id == body.branch_id)
    else:
        q = q.filter(CashClose.branch_id.is_(None))

    if q.first():
        raise HTTPException(status_code=409, detail="La caja ya está cerrada para esta fecha y sucursal.")

    record = CashClose(
        date=body.date,
        branch_id=body.branch_id,
        closed_by_id=current_user.id,
        closed_at=datetime.utcnow(),
        grand_total=body.grand_total,
        grand_commission=body.grand_commission,
        total_paid=body.total_paid,
        total_unpaid=body.total_unpaid,
        notes=body.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    branch_name = record.branch.name if record.branch else None

    return CashCloseResponse(
        id=record.id,
        date=record.date,
        branch_id=record.branch_id,
        branch_name=branch_name,
        closed_by_id=record.closed_by_id,
        closed_by_name=current_user.username,
        closed_at=record.closed_at,
        grand_total=record.grand_total,
        grand_commission=record.grand_commission,
        total_paid=record.total_paid,
        total_unpaid=record.total_unpaid,
        notes=record.notes,
    )


@router.delete("/cash-close/{cash_close_id}", status_code=200)
def reopen_cash_register(
    cash_close_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:manage")),
):
    """Reabre la caja eliminando el registro de cierre."""
    record = db.query(CashClose).filter(CashClose.id == cash_close_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro de cierre no encontrado.")
    db.delete(record)
    db.commit()
    return {"ok": True, "message": "Caja reabierta correctamente."}


@router.get("/commission-receipts", response_model=List[CommissionReceiptResponse])
def get_commission_receipts(
    date: str = Query(...),
    branch_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("payments:view", "payments:manage")),
):
    """Lista las confirmaciones de comisión para la fecha/sucursal."""
    q = db.query(CommissionReceipt).filter(CommissionReceipt.date == date)
    if branch_id:
        q = q.filter(CommissionReceipt.branch_id == branch_id)
    else:
        q = q.filter(CommissionReceipt.branch_id.is_(None))

    records = q.order_by(CommissionReceipt.confirmed_at).all()
    result = []
    for r in records:
        confirmed_by_name = r.confirmed_by.username if r.confirmed_by else None
        result.append(CommissionReceiptResponse(
            id=r.id,
            date=r.date,
            branch_id=r.branch_id,
            professional_id=r.professional_id,
            professional_name=r.professional_name,
            amount=r.amount,
            confirmed_by_id=r.confirmed_by_id,
            confirmed_by_name=confirmed_by_name,
            confirmed_at=r.confirmed_at,
        ))
    return result


@router.post("/commission-receipts", response_model=CommissionReceiptResponse, status_code=201)
def save_commission_receipt(
    body: CommissionReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:manage")),
):
    """Guarda (o actualiza) la confirmación de comisión de una operaria."""
    q = db.query(CommissionReceipt).filter(
        CommissionReceipt.date == body.date,
        CommissionReceipt.professional_name == body.professional_name,
    )
    if body.branch_id:
        q = q.filter(CommissionReceipt.branch_id == body.branch_id)
    else:
        q = q.filter(CommissionReceipt.branch_id.is_(None))

    existing = q.first()
    if existing:
        existing.amount = body.amount
        existing.confirmed_by_id = current_user.id
        existing.confirmed_at = datetime.utcnow()
        if body.professional_id:
            existing.professional_id = body.professional_id
        db.commit()
        db.refresh(existing)
        record = existing
    else:
        record = CommissionReceipt(
            date=body.date,
            branch_id=body.branch_id,
            professional_id=body.professional_id,
            professional_name=body.professional_name,
            amount=body.amount,
            confirmed_by_id=current_user.id,
            confirmed_at=datetime.utcnow(),
        )
        db.add(record)
        db.commit()
        db.refresh(record)

    return CommissionReceiptResponse(
        id=record.id,
        date=record.date,
        branch_id=record.branch_id,
        professional_id=record.professional_id,
        professional_name=record.professional_name,
        amount=record.amount,
        confirmed_by_id=record.confirmed_by_id,
        confirmed_by_name=current_user.username,
        confirmed_at=record.confirmed_at,
    )


@router.get("/low-stock")
def get_low_stock(
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    _: User = Depends(require_any_permission("inventory:view", "inventory:manage")),
):
    query = (
        db.query(
            Product.id, Product.sku, Product.name, Product.min_stock,
            func.coalesce(func.sum(Batch.current_quantity), 0).label("total_stock"),
            Branch.id.label("branch_id"), Branch.name.label("branch_name"),
        )
        .join(Batch, Batch.product_id == Product.id, isouter=True)
        .join(Branch, Branch.id == Batch.branch_id, isouter=True)
        .filter(Product.min_stock.isnot(None))
        .group_by(Product.id, Product.sku, Product.name, Product.min_stock, Branch.id, Branch.name)
    )
    if branch_id:
        query = query.filter(Batch.branch_id == branch_id)

    return [
        {
            "product_id": r.id, "sku": r.sku, "name": r.name,
            "min_stock": r.min_stock, "current_stock": float(r.total_stock),
            "branch_id": r.branch_id, "branch_name": r.branch_name,
        }
        for r in query.all()
        if r.total_stock <= (r.min_stock or 0)
    ]
