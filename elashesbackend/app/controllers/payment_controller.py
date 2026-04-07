from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.models.user import User
from app.schemas.base_response import MessageResponse
from app.schemas.payment import PaymentCreate, PaymentUpdate, PaymentResponse
from app.services.payment_service import (
    list_payments,
    get_payment_by_id,
    create_payment,
    update_payment,
    delete_payment,
)


router = APIRouter(
    prefix="/payments",
    tags=["Pagos"],
)


@router.get("/", response_model=List[PaymentResponse])
def get_payments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    client_id: Optional[int] = Query(default=None, ge=1),
    appointment_id: Optional[int] = Query(default=None, ge=1),
    branch_id: Optional[int] = Query(default=None, ge=1),
    method: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:view")),
):
    return list_payments(
        db=db,
        skip=skip,
        limit=limit,
        client_id=client_id,
        appointment_id=appointment_id,
        branch_id=branch_id,
        method=method,
        status_filter=status_filter,
    )


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:view")),
):
    return get_payment_by_id(db=db, payment_id=payment_id)


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_new_payment(
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:manage")),
):
    return create_payment(db=db, payload=payload, registered_by_id=current_user.id)


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_existing_payment(
    payment_id: int,
    payload: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:manage")),
):
    return update_payment(
        db=db,
        payment_id=payment_id,
        payload=payload,
    )


@router.delete("/{payment_id}", response_model=MessageResponse)
def delete_existing_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:manage")),
):
    delete_payment(db=db, payment_id=payment_id)
    return MessageResponse(message="Pago eliminado correctamente")