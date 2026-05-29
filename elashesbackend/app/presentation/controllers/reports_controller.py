from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.dependencies import get_db, require_any_permission
from app.domain.entities.branch import Branch
from app.domain.entities.inventory import Batch, Product
from app.domain.entities.service_agenda import Appointment, AppointmentService
from app.domain.entities.user import User
from app.presentation.schemas.reports import (
    COMMISSION_RATE,
    DailyClosingItem,
    DailyClosingResponse,
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

    items: list[DailyClosingItem] = []
    for appt in appointments:
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

        commission = round(total_price * COMMISSION_RATE, 2)
        duration_minutes = max(
            int((appt.end_time - appt.start_time).total_seconds() / 60), 0
        )

        professional_name = appt.professional.username if appt.professional else "Sin asignar"
        client_name = (
            f"{appt.client.name} {appt.client.last_name or ''}".strip()
            if appt.client
            else "Sin cliente"
        )
        branch_name = appt.branch.name if appt.branch else ""

        items.append(
            DailyClosingItem(
                appointment_id=appt.id,
                ticket_code=appt.ticket_code,
                client_name=client_name,
                service_names=service_names,
                professional_name=professional_name,
                start_time=appt.start_time,
                duration_minutes=duration_minutes,
                status=appt.status,
                total_price=total_price,
                commission=commission,
                branch_name=branch_name,
            )
        )

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
    """Devuelve productos cuyo stock actual está por debajo del mínimo configurado."""
    query = (
        db.query(
            Product.id,
            Product.sku,
            Product.name,
            Product.min_stock,
            func.coalesce(func.sum(Batch.current_quantity), 0).label("total_stock"),
            Branch.id.label("branch_id"),
            Branch.name.label("branch_name"),
        )
        .join(Batch, Batch.product_id == Product.id, isouter=True)
        .join(Branch, Branch.id == Batch.branch_id, isouter=True)
        .filter(Product.min_stock.isnot(None))
        .group_by(Product.id, Product.sku, Product.name, Product.min_stock, Branch.id, Branch.name)
    )

    if branch_id:
        query = query.filter(Batch.branch_id == branch_id)

    rows = query.all()

    alerts = []
    for row in rows:
        if row.total_stock <= (row.min_stock or 0):
            alerts.append({
                "product_id": row.id,
                "sku": row.sku,
                "name": row.name,
                "min_stock": row.min_stock,
                "current_stock": float(row.total_stock),
                "branch_id": row.branch_id,
                "branch_name": row.branch_name,
            })

    return alerts
