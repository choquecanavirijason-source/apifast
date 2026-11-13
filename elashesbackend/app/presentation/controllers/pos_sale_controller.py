from typing import List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.dependencies import get_db, require_any_permission, require_permission, enforce_own_branch, SUPER_ADMIN_ROLE
from app.domain.entities.user import User
from app.presentation.schemas.pos_sale import PosSaleCreate, PosSalePay, PosSaleResponse, PosSaleUpdate
from app.application.services.push_service import push_reservation_created
from app.application.services.pos_sale_service import (
    cancel_sale,
    create_sale,
    generate_sale_receipt_pdf,
    delete_sale,
    get_sale_by_id,
    list_sales,
    pay_reserved_sale,
    update_sale,
)


router = APIRouter(
    prefix="/pos-sales",
    tags=["POS"],
)


@router.get("/", response_model=List[PosSaleResponse])
def get_sales(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=300),
    branch_id: Optional[int] = Query(default=None, ge=1),
    client_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "payments:view")),
):
    if branch_id is None and (not current_user.role or current_user.role.name not in (SUPER_ADMIN_ROLE, "Admin", "Secretaria")):
        branch_id = current_user.effective_branch_id
    enforce_own_branch(branch_id, current_user, use_effective_branch=True)
    return list_sales(db=db, skip=skip, limit=limit, branch_id=branch_id, client_id=client_id)


@router.get("/{sale_id}", response_model=PosSaleResponse)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "payments:view")),
):
    sale = get_sale_by_id(db=db, sale_id=sale_id)
    enforce_own_branch(sale.branch_id, current_user, use_effective_branch=True)
    return sale


@router.post("/", response_model=PosSaleResponse, status_code=status.HTTP_201_CREATED)
def create_new_sale(
    payload: PosSaleCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    result = create_sale(db=db, payload=payload, current_user=current_user)
    # Solo las reservas de la agenda (reservation_only): una venta normal del
    # POS también crea tickets, pero la clienta está presente, no es una reserva.
    if payload.reservation_only:
        appointment_ids = [a.id for a in (result.appointments or [])]
        if appointment_ids:
            background_tasks.add_task(push_reservation_created, appointment_ids)
    return result


@router.patch("/{sale_id}", response_model=PosSaleResponse)
def patch_sale(
    sale_id: int,
    payload: PosSaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    sale = get_sale_by_id(db=db, sale_id=sale_id)
    enforce_own_branch(sale.branch_id, current_user, use_effective_branch=True)
    result = update_sale(db=db, sale_id=sale_id, payload=payload)
    record_audit(
        db, current_user, "update", "pos_sale", sale_id,
        f"Editó la venta #{sale_id}",
        branch_id=getattr(result, "branch_id", None),
    )
    return result


@router.post("/{sale_id}/pay", response_model=PosSaleResponse)
def pay_existing_sale(
    sale_id: int,
    payload: PosSalePay,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments:manage")),
):
    """Cobra una venta reservada (p. ej. al pasar su cita de la agenda a servicio)."""
    result = pay_reserved_sale(db=db, sale_id=sale_id, payload=payload, current_user=current_user)
    record_audit(
        db, current_user, "update", "pos_sale", sale_id,
        f"Cobró la venta #{sale_id} ({payload.payment_method})",
        branch_id=getattr(result, "branch_id", None),
    )
    return result


@router.post("/{sale_id}/cancel", response_model=PosSaleResponse)
def cancel_existing_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    sale = get_sale_by_id(db=db, sale_id=sale_id)
    enforce_own_branch(sale.branch_id, current_user, use_effective_branch=True)
    result = cancel_sale(db=db, sale_id=sale_id)
    record_audit(
        db, current_user, "cancel", "pos_sale", sale_id,
        f"Canceló la venta #{sale_id}",
        branch_id=getattr(result, "branch_id", None),
    )
    return result


@router.delete("/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    sale = get_sale_by_id(db=db, sale_id=sale_id)
    enforce_own_branch(sale.branch_id, current_user, use_effective_branch=True)
    delete_sale(db=db, sale_id=sale_id)
    record_audit(db, current_user, "delete", "pos_sale", sale_id, f"Eliminó la venta #{sale_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{sale_id}/receipt/pdf")
def get_sale_receipt_pdf(
    sale_id: int,
    format: Literal["a4", "thermal"] = Query(default="a4"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "payments:view")),
):
    sale = get_sale_by_id(db=db, sale_id=sale_id)
    enforce_own_branch(sale.branch_id, current_user, use_effective_branch=True)
    pdf_bytes = generate_sale_receipt_pdf(db=db, sale_id=sale_id, print_format=format)
    filename = f"comprobante-{sale_id}-{format}.pdf"
    return StreamingResponse(
        content=iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
