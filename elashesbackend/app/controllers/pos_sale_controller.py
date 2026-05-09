from typing import List, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_any_permission, require_permission
from app.models.user import User
from app.schemas.pos_sale import PosSaleCreate, PosSaleResponse, PosSaleUpdate
from app.services.pos_sale_service import (
    cancel_sale,
    create_sale,
    generate_sale_receipt_pdf,
    delete_sale,
    get_sale_by_id,
    list_sales,
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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "payments:view")),
):
    return list_sales(db=db, skip=skip, limit=limit)


@router.get("/{sale_id}", response_model=PosSaleResponse)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "payments:view")),
):
    return get_sale_by_id(db=db, sale_id=sale_id)


@router.post("/", response_model=PosSaleResponse, status_code=status.HTTP_201_CREATED)
def create_new_sale(
    payload: PosSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    return create_sale(db=db, payload=payload, current_user=current_user)


@router.patch("/{sale_id}", response_model=PosSaleResponse)
def patch_sale(
    sale_id: int,
    payload: PosSaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    return update_sale(db=db, sale_id=sale_id, payload=payload)


@router.post("/{sale_id}/cancel", response_model=PosSaleResponse)
def cancel_existing_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    return cancel_sale(db=db, sale_id=sale_id)


@router.delete("/{sale_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    delete_sale(db=db, sale_id=sale_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{sale_id}/receipt/pdf")
def get_sale_receipt_pdf(
    sale_id: int,
    format: Literal["a4", "thermal"] = Query(default="a4"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "payments:view")),
):
    pdf_bytes = generate_sale_receipt_pdf(db=db, sale_id=sale_id, print_format=format)
    filename = f"comprobante-{sale_id}-{format}.pdf"
    return StreamingResponse(
        content=iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
