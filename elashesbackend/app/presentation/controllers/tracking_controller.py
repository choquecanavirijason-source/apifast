from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission, require_any_permission, get_current_active_user
from app.core.media import ALLOWED_EXTENSIONS, MAX_IMAGE_BYTES
from app.domain.entities.user import User
from app.presentation.schemas.base_response import MessageResponse
from app.presentation.schemas.tracking import (
    LashAiReviewResponse,
    TrackingCreate,
    TrackingUpdate,
    TrackingResponse,
)
from app.application.services.admin_ai_service import ask_lash_ai_vision
from app.application.services.tracking_service import (
    list_trackings,
    get_tracking_by_id,
    get_latest_tracking_by_client,
    create_tracking,
    update_tracking,
    delete_tracking,
)
import os


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
    limit: int = Query(default=20, ge=1, le=500),
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
    current_user: User = Depends(require_any_permission("tracking:manage", "appointments:manage")),
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


@router.post(
    "/ai-review",
    response_model=LashAiReviewResponse,
)
async def ai_review_lash_application(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("tracking:manage", "tracking:view")),
):
    """Guiado de IA en vivo (Beauty Tech): recibe una foto tomada durante la
    aplicación de pestañas y devuelve un consejo breve. No persiste la imagen.
    """
    _, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida. Usa: {sorted(ALLOWED_EXTENSIONS)}",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo está vacío.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen supera el tamaño máximo (5 MB).",
        )

    return await ask_lash_ai_vision(db=db, image_bytes=data)