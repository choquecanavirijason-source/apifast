from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.branch import Branch
from app.models.client import Client
from app.models.payment import Payment
from app.models.service_agenda import Appointment
from app.schemas.payment import PaymentCreate, PaymentUpdate


ALLOWED_PAYMENT_METHODS = {"cash", "card", "transfer", "qr"}
ALLOWED_PAYMENT_STATUSES = {"paid", "pending", "cancelled", "refunded"}


def _payment_query(db: Session):
    return db.query(Payment).options(
        joinedload(Payment.client),
        joinedload(Payment.branch),
        joinedload(Payment.registered_by),
    )


def _normalize_method(method: str) -> str:
    return method.strip().lower()


def _normalize_status(status_value: str) -> str:
    return status_value.strip().lower()


def _validate_payment_relations(
    db: Session,
    client_id: int,
    branch_id: Optional[int] = None,
    appointment_id: Optional[int] = None,
    sale_id: Optional[int] = None,
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La clienta indicada no existe",
        )

    if branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sucursal indicada no existe",
            )

    if appointment_id is not None:
        appointment = (
            db.query(Appointment)
            .filter(Appointment.id == appointment_id)
            .first()
        )
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cita indicada no existe",
            )

        if appointment.client_id != client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cita no pertenece a la clienta indicada",
            )

    if sale_id is not None:
        from app.models.pos_sale import PosSale

        sale = db.query(PosSale).filter(PosSale.id == sale_id).first()
        if not sale:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La venta POS indicada no existe",
            )

        if sale.client_id != client_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La venta POS no pertenece a la clienta indicada",
            )


def _validate_payment_fields(
    amount: float,
    method: str,
    status_value: str,
):
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El monto debe ser mayor a 0",
        )

    normalized_method = _normalize_method(method)
    if normalized_method not in ALLOWED_PAYMENT_METHODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Método no válido. Usa uno de: {', '.join(sorted(ALLOWED_PAYMENT_METHODS))}",
        )

    normalized_status = _normalize_status(status_value)
    if normalized_status not in ALLOWED_PAYMENT_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estado no válido. Usa uno de: {', '.join(sorted(ALLOWED_PAYMENT_STATUSES))}",
        )


def list_payments(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    client_id: Optional[int] = None,
    appointment_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    method: Optional[str] = None,
    status_filter: Optional[str] = None,
):
    query = _payment_query(db)

    if client_id is not None:
        query = query.filter(Payment.client_id == client_id)

    if appointment_id is not None:
        query = query.filter(Payment.appointment_id == appointment_id)

    if branch_id is not None:
        query = query.filter(Payment.branch_id == branch_id)

    if method:
        query = query.filter(Payment.method == _normalize_method(method))

    if status_filter:
        query = query.filter(Payment.status == _normalize_status(status_filter))

    return (
        query.order_by(Payment.paid_at.desc(), Payment.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_payment_by_id(db: Session, payment_id: int) -> Payment:
    payment = _payment_query(db).filter(Payment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado",
        )

    return payment


def create_payment(
    db: Session,
    payload: PaymentCreate,
    registered_by_id: Optional[int] = None,
) -> Payment:
    method = _normalize_method(payload.method)
    status_value = _normalize_status(payload.status)
    paid_at = payload.paid_at or datetime.utcnow()

    _validate_payment_relations(
        db=db,
        client_id=payload.client_id,
        branch_id=payload.branch_id,
        appointment_id=payload.appointment_id,
        sale_id=payload.sale_id,
    )
    _validate_payment_fields(
        amount=payload.amount,
        method=method,
        status_value=status_value,
    )

    payment = Payment(
        client_id=payload.client_id,
        branch_id=payload.branch_id,
        appointment_id=payload.appointment_id,
        sale_id=payload.sale_id,
        registered_by_id=registered_by_id,
        amount=payload.amount,
        method=method,
        status=status_value,
        reference=payload.reference,
        notes=payload.notes,
        paid_at=paid_at,
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)

    return get_payment_by_id(db, payment.id)


def update_payment(
    db: Session,
    payment_id: int,
    payload: PaymentUpdate,
) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado",
        )

    update_data = payload.model_dump(exclude_unset=True)

    final_client_id = update_data.get("client_id", payment.client_id)
    final_branch_id = update_data.get("branch_id", payment.branch_id)
    final_appointment_id = update_data.get("appointment_id", payment.appointment_id)
    final_sale_id = update_data.get("sale_id", payment.sale_id)
    final_amount = update_data.get("amount", payment.amount)
    final_method = _normalize_method(update_data.get("method", payment.method))
    final_status = _normalize_status(update_data.get("status", payment.status))

    _validate_payment_relations(
        db=db,
        client_id=final_client_id,
        branch_id=final_branch_id,
        appointment_id=final_appointment_id,
        sale_id=final_sale_id,
    )
    _validate_payment_fields(
        amount=final_amount,
        method=final_method,
        status_value=final_status,
    )

    payment.client_id = final_client_id
    payment.branch_id = final_branch_id
    payment.appointment_id = final_appointment_id
    payment.sale_id = final_sale_id
    payment.amount = final_amount
    payment.method = final_method
    payment.status = final_status

    if "reference" in update_data:
        payment.reference = update_data["reference"]

    if "notes" in update_data:
        payment.notes = update_data["notes"]

    if "paid_at" in update_data and update_data["paid_at"] is not None:
        payment.paid_at = update_data["paid_at"]

    db.commit()
    db.refresh(payment)

    return get_payment_by_id(db, payment.id)


def delete_payment(db: Session, payment_id: int) -> None:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pago no encontrado",
        )

    db.delete(payment)
    db.commit()