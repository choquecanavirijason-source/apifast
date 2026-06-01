from collections import defaultdict
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.dependencies import get_db, require_any_permission
from app.domain.entities.branch import Branch
from app.domain.entities.inventory import Batch, Product
from app.domain.entities.payment import Payment
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.service_agenda import Appointment, AppointmentService
from app.domain.entities.user import User
from app.presentation.schemas.reports import (
    DEFAULT_COMMISSION_RATE,
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
    payments_by_sale: dict[int, list[Payment]] = defaultdict(list)
    if sale_ids:
        sales = db.query(PosSale).filter(PosSale.id.in_(sale_ids)).all()
        sales_by_id = {s.id: s for s in sales}
        # Cargar payments individuales para desglosar pago mixto
        all_payments = db.query(Payment).filter(Payment.sale_id.in_(sale_ids), Payment.status == "paid").all()
        for p in all_payments:
            payments_by_sale[p.sale_id].append(p)

    items: list[DailyClosingItem] = []
    totals_by_payment: dict[str, float] = defaultdict(float)
    total_paid = 0.0
    total_unpaid = 0.0

    # Solo tickets completados cuentan para comisiones y totales de ingresos
    COMPLETED_STATUS = {"completed", "confirmed"}
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

        # ── Comisión: solo si el ticket está completado ───────────────────
        commission_rate = (
            appt.professional.commission_rate
            if appt.professional and appt.professional.commission_rate is not None
            else DEFAULT_COMMISSION_RATE
        )
        is_completed = appt.status in COMPLETED_STATUS
        commission = round(total_price * commission_rate, 2) if is_completed else 0.0

        # ── Datos de la venta POS vinculada ───────────────────────────────
        sale = sales_by_id.get(appt.sale_id) if appt.sale_id else None
        payment_method = sale.payment_method if sale else None
        is_paid = sale is not None and sale.status == "paid"
        sale_code = sale.sale_code if sale else None

        # ── Totales por método de pago (solo tickets completados y pagados) ─
        if is_completed and is_paid:
            sale_payments = payments_by_sale.get(appt.sale_id, [])
            if sale_payments:
                # Pago mixto: distribuir precio del ticket proporcional por método
                sale_total_paid = sum(p.amount for p in sale_payments)
                for p in sale_payments:
                    ratio = (p.amount / sale_total_paid) if sale_total_paid > 0 else (1 / len(sale_payments))
                    totals_by_payment[p.method] += round(total_price * ratio, 2)
            elif payment_method and payment_method != "mixed":
                totals_by_payment[payment_method] += total_price
            total_paid += total_price
        elif not is_paid and appt.status not in {"cancelled"}:
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

        # ── Acumulado por operaria (solo tickets completados) ─────────────
        if is_completed:
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

    # Grand total y comisión: solo tickets completados
    grand_total = round(sum(i.total_price for i in items if i.status in COMPLETED_STATUS), 2)
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
