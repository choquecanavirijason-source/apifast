from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission, get_current_active_user
from app.models.user import User
from app.schemas.base_response import MessageResponse
from app.schemas.tracking import TrackingCreate, TrackingUpdate, TrackingResponse
from app.services.tracking_service import (
    list_trackings,
    get_tracking_by_id,
    get_latest_tracking_by_client,
    create_tracking,
    update_tracking,
    delete_tracking,
)


router = APIRouter(
    prefix="/tracking",
    tags=["Seguimiento"],
)


@router.get(
    "/",
    response_model=List[TrackingResponse],
)
def get_trackings(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    client_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tracking:view")),
):
    return list_trackings(
        db=db,
        skip=skip,
        limit=limit,
        client_id=client_id,
    )


@router.get(
    "/{tracking_id}",
    response_model=TrackingResponse,
)
def get_tracking(
    tracking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tracking:view")),
):
    return get_tracking_by_id(db=db, tracking_id=tracking_id)


@router.get(
    "/client/{client_id}/latest",
    response_model=TrackingResponse,
)
def get_client_latest_tracking(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tracking:view")),
):
    return get_latest_tracking_by_client(db=db, client_id=client_id)


@router.post(
    "/",
    response_model=TrackingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_tracking(
    payload: TrackingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tracking:manage")),
):
    return create_tracking(
        db=db,
        payload=payload,
        current_user_id=current_user.id,
    )


@router.put(
    "/{tracking_id}",
    response_model=TrackingResponse,
)
def update_existing_tracking(
    tracking_id: int,
    payload: TrackingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tracking:manage")),
):
    return update_tracking(
        db=db,
        tracking_id=tracking_id,
        payload=payload,
    )


@router.delete(
    "/{tracking_id}",
    response_model=MessageResponse,
)
def delete_existing_tracking(
    tracking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tracking:manage")),
):
    delete_tracking(db=db, tracking_id=tracking_id)
    return MessageResponse(message="Seguimiento eliminado correctamente")