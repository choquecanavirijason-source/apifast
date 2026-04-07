from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.branch import Branch
from app.models.client import Client, CLIENT_STATUS_PAGADO
from app.models.payment import Payment
from app.models.pos_sale import PosSale
from app.models.service_agenda import Appointment, Service
from app.models.user import User
from app.schemas.pos_sale import PosSaleCreate
from app.services.service_agenda_service import create_appointment
from app.services.client_service import update_client_status


ALLOWED_POS_PAYMENT_METHODS = {"cash", "card", "transfer", "qr"}
ALLOWED_DISCOUNT_TYPES = {"amount", "percent"}


def _sale_query(db: Session):
    return db.query(PosSale).options(
        joinedload(PosSale.client),
        joinedload(PosSale.created_by),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.client),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.service),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.professional),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.created_by),
        joinedload(PosSale.appointments)
        .joinedload(Appointment.branch),
        joinedload(PosSale.payments)
        .joinedload(Payment.client),
        joinedload(PosSale.payments)
        .joinedload(Payment.branch),
        joinedload(PosSale.payments)
        .joinedload(Payment.registered_by),
    )


def _generate_sale_code(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"POS-{today}-"
    last = (
        db.query(PosSale)
        .filter(PosSale.sale_code.like(f"{prefix}%"))
        .order_by(PosSale.id.desc())
        .first()
    )
    if last and last.sale_code:
        try:
            num = int(last.sale_code.split("-")[-1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1
    return f"{prefix}{num:04d}"


def _normalize_payment_method(method: str) -> str:
    return method.strip().lower()


def _validate_pos_relations(
    db: Session,
    client_id: int,
    branch_id: Optional[int],
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")

    if branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La sucursal indicada no existe")


def get_sale_by_id(db: Session, sale_id: int) -> PosSale:
    sale = _sale_query(db).filter(PosSale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta POS no encontrada")
    return sale


def list_sales(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    return (
        _sale_query(db)
        .order_by(PosSale.created_at.desc(), PosSale.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_sale(
    db: Session,
    payload: PosSaleCreate,
    current_user: User,
) -> PosSale:
    _validate_pos_relations(db=db, client_id=payload.client_id, branch_id=payload.branch_id)

    payment_method = _normalize_payment_method(payload.payment_method)
    if payment_method not in ALLOWED_POS_PAYMENT_METHODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Método de pago no válido. Usa uno de: {', '.join(sorted(ALLOWED_POS_PAYMENT_METHODS))}",
        )

    if payload.discount_type not in ALLOWED_DISCOUNT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de descuento no válido",
        )

    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes agregar al menos un servicio a la venta",
        )

    services = db.query(Service).filter(Service.id.in_([item.service_id for item in payload.items])).all()
    service_map = {service.id: service for service in services}
    if len(service_map) != len({item.service_id for item in payload.items}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uno o más servicios no existen",
        )

    subtotal = float(sum(service_map[item.service_id].price for item in payload.items))
    discount_value = float(payload.discount_value)

    if payload.discount_type == "percent":
        discount_amount = subtotal * (discount_value / 100)
    else:
        discount_amount = discount_value

    if discount_amount < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El descuento no puede ser negativo")

    total = max(0.0, subtotal - discount_amount)
    sale = PosSale(
        sale_code=_generate_sale_code(db),
        client_id=payload.client_id,
        branch_id=payload.branch_id,
        created_by_id=current_user.id,
        subtotal=subtotal,
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        total=total,
        payment_method=payment_method,
        status="paid",
        notes=payload.notes,
    )
    db.add(sale)
    db.flush()

    for item in payload.items:
        create_appointment(
            db=db,
            client_id=payload.client_id,
            created_by_id=current_user.id,
            professional_id=item.professional_id,
            service_id=item.service_id,
            branch_id=item.branch_id or payload.branch_id,
            sale_id=sale.id,
            is_ia=item.is_ia,
            start_time=item.start_time,
            end_time=item.end_time,
            status_value="pending",
        )

    payment = Payment(
        client_id=payload.client_id,
        branch_id=payload.branch_id,
        sale_id=sale.id,
        registered_by_id=current_user.id,
        amount=total,
        method=payment_method,
        status="paid",
        notes=payload.notes,
        paid_at=datetime.utcnow(),
    )
    db.add(payment)
    db.commit()

    update_client_status(db, payload.client_id, CLIENT_STATUS_PAGADO)

    return get_sale_by_id(db, sale.id)
