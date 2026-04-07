import csv
import io
from datetime import date, datetime, time
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import case, distinct, func
from sqlalchemy.orm import Session, aliased, joinedload

from app.core.dependencies import get_db, require_any_permission
from app.models.branch import Branch
from app.models.client import Client
from app.models.inventory import Batch, Product
from app.models.payment import Payment
from app.models.pos_sale import PosSale
from app.models.service_agenda import Appointment, Service
from app.models.user import User


router = APIRouter(tags=["Dashboard"])

DashboardGroupBy = Literal["day", "month"]


def _parse_date_value(value: str, label: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El parámetro {label} debe tener formato YYYY-MM-DD.",
        ) from exc


def _parse_date_range(from_date: Optional[str], to_date: Optional[str]) -> tuple[Optional[datetime], Optional[datetime]]:
    start = datetime.combine(_parse_date_value(from_date, "from"), time.min) if from_date else None
    end = datetime.combine(_parse_date_value(to_date, "to"), time.max) if to_date else None

    if start and end and start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rango de fechas no es válido: 'from' no puede ser mayor que 'to'.",
        )

    return start, end


def _bucket_expression(column, group_by: DashboardGroupBy):
    fmt = "%Y-%m-%d" if group_by == "day" else "%Y-%m"
    return func.strftime(fmt, column)


def _apply_appointment_filters(query, start_at: Optional[datetime], end_at: Optional[datetime], branch_id: Optional[int], service_id: Optional[int]):
    if start_at is not None:
        query = query.filter(Appointment.start_time >= start_at)
    if end_at is not None:
        query = query.filter(Appointment.start_time <= end_at)
    if branch_id is not None:
        query = query.filter(Appointment.branch_id == branch_id)
    if service_id is not None:
        query = query.filter(Appointment.service_id == service_id)
    return query


def _apply_payment_filters(query, start_at: Optional[datetime], end_at: Optional[datetime], branch_id: Optional[int], service_id: Optional[int]):
    if start_at is not None:
        query = query.filter(Payment.paid_at >= start_at)
    if end_at is not None:
        query = query.filter(Payment.paid_at <= end_at)
    if branch_id is not None:
        query = query.filter(Payment.branch_id == branch_id)
    if service_id is not None:
        query = query.join(Appointment, Appointment.id == Payment.appointment_id)
        query = query.filter(Appointment.service_id == service_id)
    return query


def _apply_sale_filters(query, start_at: Optional[datetime], end_at: Optional[datetime], branch_id: Optional[int], service_id: Optional[int]):
    if start_at is not None:
        query = query.filter(PosSale.created_at >= start_at)
    if end_at is not None:
        query = query.filter(PosSale.created_at <= end_at)
    if branch_id is not None:
        query = query.filter(PosSale.branch_id == branch_id)
    if service_id is not None:
        query = query.filter(PosSale.appointments.any(Appointment.service_id == service_id))
    return query


def _csv_response(filename: str, headers: list[str], rows: list[list[object]]) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    content = buffer.getvalue()
    buffer.close()
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/dashboard/overview")
def get_dashboard_overview(
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    branch_id: Optional[int] = Query(default=None, ge=1),
    service_id: Optional[int] = Query(default=None, ge=1),
    low_stock_threshold: float = Query(default=5, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            "payments:view",
            "appointments:view",
            "inventory:view",
            "branches:view",
            "catalog:view",
        )
    ),
):
    start_at, end_at = _parse_date_range(from_date, to_date)

    appointment_summary = (
        _apply_appointment_filters(
            db.query(
                func.count(Appointment.id).label("total"),
                func.sum(case((Appointment.status == "pending", 1), else_=0)).label("pending"),
                func.sum(case((Appointment.status == "confirmed", 1), else_=0)).label("confirmed"),
                func.sum(case((Appointment.status == "completed", 1), else_=0)).label("completed"),
                func.sum(case((Appointment.status == "cancelled", 1), else_=0)).label("cancelled"),
            ),
            start_at,
            end_at,
            branch_id,
            service_id,
        )
        .one()
    )

    payment_summary = (
        _apply_payment_filters(
            db.query(
                func.count(Payment.id).label("count"),
                func.coalesce(func.sum(Payment.amount), 0).label("total_amount"),
            ).filter(Payment.status == "paid"),
            start_at,
            end_at,
            branch_id,
            service_id,
        )
        .one()
    )

    active_client_ids = set(
        client_id
        for (client_id,) in _apply_appointment_filters(
            db.query(distinct(Appointment.client_id)),
            start_at,
            end_at,
            branch_id,
            service_id,
        ).all()
        if client_id is not None
    )
    active_client_ids.update(
        client_id
        for (client_id,) in _apply_payment_filters(
            db.query(distinct(Payment.client_id)),
            start_at,
            end_at,
            branch_id,
            service_id,
        ).all()
        if client_id is not None
    )

    pos_sales_count = (
        _apply_sale_filters(
            db.query(func.count(distinct(PosSale.id))),
            start_at,
            end_at,
            branch_id,
            service_id,
        ).scalar()
        or 0
    )

    clients_total = db.query(func.count(Client.id)).scalar() or 0

    active_employees_query = db.query(func.count(User.id)).filter(User.is_active.is_(True))
    if branch_id is not None:
        active_employees_query = active_employees_query.filter(User.branch_id == branch_id)
    active_employees = active_employees_query.scalar() or 0

    services_count = db.query(func.count(Service.id)).scalar() or 0
    products_active_count = db.query(func.count(Product.id)).filter(Product.status.is_(True)).scalar() or 0

    stock_query = (
        db.query(
            Product.id.label("product_id"),
            func.coalesce(func.sum(Batch.current_quantity), 0).label("total_stock"),
        )
        .join(Batch, Batch.product_id == Product.id)
        .group_by(Product.id)
    )
    if branch_id is not None:
        stock_query = stock_query.filter(Batch.branch_id == branch_id)
    stock_rows = stock_query.all()
    low_stock_items = sum(1 for row in stock_rows if float(row.total_stock or 0) <= low_stock_threshold)

    branch_name = None
    if branch_id is not None:
        branch_name = db.query(Branch.name).filter(Branch.id == branch_id).scalar()

    payments_count = int(payment_summary.count or 0)
    payments_total = float(payment_summary.total_amount or 0)

    return {
        "period": {
            "from": from_date,
            "to": to_date,
        },
        "scope": {
            "branch_id": branch_id,
            "branch_name": branch_name,
            "service_id": service_id,
        },
        "cards": {
            "clients_total": int(clients_total),
            "clients_with_activity": len(active_client_ids),
            "appointments_total": int(appointment_summary.total or 0),
            "appointments_pending": int(appointment_summary.pending or 0),
            "appointments_confirmed": int(appointment_summary.confirmed or 0),
            "appointments_completed": int(appointment_summary.completed or 0),
            "appointments_cancelled": int(appointment_summary.cancelled or 0),
            "payments_paid_total": payments_total,
            "payments_count": payments_count,
            "avg_payment": round(payments_total / payments_count, 2) if payments_count else 0,
            "pos_sales_count": int(pos_sales_count),
            "active_employees": int(active_employees),
            "services_count": int(services_count),
            "products_active_count": int(products_active_count),
            "low_stock_items": int(low_stock_items),
        },
    }


@router.get("/dashboard/revenue-series")
def get_dashboard_revenue_series(
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    branch_id: Optional[int] = Query(default=None, ge=1),
    service_id: Optional[int] = Query(default=None, ge=1),
    group_by: DashboardGroupBy = Query(default="day"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:view", "appointments:view")),
):
    start_at, end_at = _parse_date_range(from_date, to_date)
    bucket = _bucket_expression(Payment.paid_at, group_by).label("bucket")

    rows = (
        _apply_payment_filters(
            db.query(
                bucket,
                func.coalesce(func.sum(Payment.amount), 0).label("paid_amount"),
                func.count(Payment.id).label("payments_count"),
            ).filter(Payment.status == "paid"),
            start_at,
            end_at,
            branch_id,
            service_id,
        )
        .group_by(bucket)
        .order_by(bucket.asc())
        .all()
    )

    return {
        "group_by": group_by,
        "series": [
            {
                "bucket": row.bucket,
                "paid_amount": float(row.paid_amount or 0),
                "payments_count": int(row.payments_count or 0),
            }
            for row in rows
        ],
    }


@router.get("/dashboard/service-distribution")
def get_dashboard_service_distribution(
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    branch_id: Optional[int] = Query(default=None, ge=1),
    service_id: Optional[int] = Query(default=None, ge=1),
    limit: int = Query(default=8, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "services:view")),
):
    start_at, end_at = _parse_date_range(from_date, to_date)

    rows = (
        _apply_appointment_filters(
            db.query(
                Service.id.label("service_id"),
                func.coalesce(Service.name, "Sin servicio").label("service_name"),
                func.count(Appointment.id).label("tickets_count"),
                func.sum(case((Appointment.status == "completed", 1), else_=0)).label("completed_count"),
                func.coalesce(func.sum(Service.price), 0).label("estimated_revenue"),
            )
            .select_from(Appointment)
            .outerjoin(Service, Service.id == Appointment.service_id),
            start_at,
            end_at,
            branch_id,
            service_id,
        )
        .group_by(Service.id, Service.name)
        .order_by(func.count(Appointment.id).desc(), func.coalesce(Service.name, "Sin servicio").asc())
        .limit(limit)
        .all()
    )

    return {
        "rows": [
            {
                "service_id": row.service_id,
                "service_name": row.service_name,
                "tickets_count": int(row.tickets_count or 0),
                "completed_count": int(row.completed_count or 0),
                "estimated_revenue": float(row.estimated_revenue or 0),
            }
            for row in rows
        ]
    }


@router.get("/dashboard/inventory-distribution")
def get_dashboard_inventory_distribution(
    branch_id: Optional[int] = Query(default=None, ge=1),
    limit: int = Query(default=8, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("inventory:view", "branches:view")),
):
    query = (
        db.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            func.coalesce(func.sum(Batch.current_quantity), 0).label("total_stock"),
        )
        .join(Batch, Batch.product_id == Product.id)
        .group_by(Product.id, Product.name)
        .order_by(func.coalesce(func.sum(Batch.current_quantity), 0).desc(), Product.name.asc())
    )
    if branch_id is not None:
        query = query.filter(Batch.branch_id == branch_id)

    rows = query.limit(limit).all()

    return {
        "rows": [
            {
                "product_id": row.product_id,
                "product_name": row.product_name,
                "total_stock": float(row.total_stock or 0),
            }
            for row in rows
        ]
    }


@router.get("/reports/payments.csv")
def download_payments_report(
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    branch_id: Optional[int] = Query(default=None, ge=1),
    service_id: Optional[int] = Query(default=None, ge=1),
    method: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:view", "appointments:view")),
):
    start_at, end_at = _parse_date_range(from_date, to_date)
    registered_by = aliased(User)

    query = (
        db.query(Payment, Client, Branch, Appointment, Service, registered_by)
        .join(Client, Client.id == Payment.client_id)
        .outerjoin(Branch, Branch.id == Payment.branch_id)
        .outerjoin(Appointment, Appointment.id == Payment.appointment_id)
        .outerjoin(Service, Service.id == Appointment.service_id)
        .outerjoin(registered_by, registered_by.id == Payment.registered_by_id)
    )
    query = _apply_payment_filters(query, start_at, end_at, branch_id, service_id)

    if method:
        query = query.filter(Payment.method == method)
    if status_filter:
        query = query.filter(Payment.status == status_filter)

    records = query.order_by(Payment.paid_at.desc(), Payment.id.desc()).all()

    rows = [
        [
            payment.id,
            payment.paid_at.isoformat() if payment.paid_at else "",
            f"{client.name} {client.last_name}".strip(),
            branch.name if branch else "",
            service.name if service else "",
            payment.appointment_id or "",
            payment.sale_id or "",
            payment.amount,
            payment.method,
            payment.status,
            payment.reference or "",
            payment.notes or "",
            user.username if user else "",
        ]
        for payment, client, branch, _appointment, service, user in records
    ]

    return _csv_response(
        filename=f"payments_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv",
        headers=[
            "payment_id",
            "paid_at",
            "client_name",
            "branch_name",
            "service_name",
            "appointment_id",
            "sale_id",
            "amount",
            "method",
            "status",
            "reference",
            "notes",
            "registered_by",
        ],
        rows=rows,
    )


@router.get("/reports/tickets.csv")
def download_tickets_report(
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    branch_id: Optional[int] = Query(default=None, ge=1),
    service_id: Optional[int] = Query(default=None, ge=1),
    status_filter: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "payments:view")),
):
    start_at, end_at = _parse_date_range(from_date, to_date)
    professional = aliased(User)
    creator = aliased(User)

    query = (
        db.query(Appointment, Client, Service, Branch, professional, creator)
        .join(Client, Client.id == Appointment.client_id)
        .outerjoin(Service, Service.id == Appointment.service_id)
        .outerjoin(Branch, Branch.id == Appointment.branch_id)
        .outerjoin(professional, professional.id == Appointment.professional_id)
        .outerjoin(creator, creator.id == Appointment.created_by_id)
    )
    query = _apply_appointment_filters(query, start_at, end_at, branch_id, service_id)

    if status_filter:
        query = query.filter(Appointment.status == status_filter)

    records = query.order_by(Appointment.start_time.desc(), Appointment.id.desc()).all()

    rows = [
        [
            appointment.id,
            appointment.ticket_code or "",
            f"{client.name} {client.last_name}".strip(),
            service.name if service else "",
            appointment.start_time.isoformat() if appointment.start_time else "",
            appointment.end_time.isoformat() if appointment.end_time else "",
            appointment.status,
            branch.name if branch else "",
            assigned.username if assigned else "",
            created.username if created else "",
        ]
        for appointment, client, service, branch, assigned, created in records
    ]

    return _csv_response(
        filename=f"tickets_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv",
        headers=[
            "ticket_id",
            "ticket_code",
            "client_name",
            "service_name",
            "start_time",
            "end_time",
            "status",
            "branch_name",
            "assigned_professional",
            "created_by",
        ],
        rows=rows,
    )


@router.get("/reports/pos-sales.csv")
def download_pos_sales_report(
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    branch_id: Optional[int] = Query(default=None, ge=1),
    service_id: Optional[int] = Query(default=None, ge=1),
    payment_method: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("payments:view", "appointments:view")),
):
    start_at, end_at = _parse_date_range(from_date, to_date)

    query = db.query(PosSale).options(
        joinedload(PosSale.client),
        joinedload(PosSale.branch),
        joinedload(PosSale.created_by),
        joinedload(PosSale.appointments).joinedload(Appointment.service),
    )
    query = _apply_sale_filters(query, start_at, end_at, branch_id, service_id)

    if payment_method:
        query = query.filter(PosSale.payment_method == payment_method)
    if status_filter:
        query = query.filter(PosSale.status == status_filter)

    sales = query.order_by(PosSale.created_at.desc(), PosSale.id.desc()).all()

    rows = [
        [
            sale.id,
            sale.sale_code,
            sale.created_at.isoformat() if sale.created_at else "",
            f"{sale.client.name} {sale.client.last_name}".strip() if sale.client else "",
            sale.branch.name if sale.branch else "",
            sale.subtotal,
            sale.discount_type,
            sale.discount_value,
            sale.total,
            sale.payment_method,
            sale.status,
            sale.created_by.username if sale.created_by else "",
            len(sale.appointments or []),
            " | ".join(
                f"{appointment.ticket_code or appointment.id}:{appointment.service.name if appointment.service else 'Sin servicio'}"
                for appointment in (sale.appointments or [])
            ),
            sale.notes or "",
        ]
        for sale in sales
    ]

    return _csv_response(
        filename=f"pos_sales_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv",
        headers=[
            "sale_id",
            "sale_code",
            "created_at",
            "client_name",
            "branch_name",
            "subtotal",
            "discount_type",
            "discount_value",
            "total",
            "payment_method",
            "status",
            "created_by",
            "tickets_count",
            "tickets_summary",
            "notes",
        ],
        rows=rows,
    )
