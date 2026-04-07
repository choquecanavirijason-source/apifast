from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_any_permission, require_permission
from app.models.user import User
from app.schemas.pos_sale import PosSaleCreate, PosSaleResponse
from app.services.pos_sale_service import create_sale, get_sale_by_id, list_sales


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
