from typing import List, Optional

import base64
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.core.dependencies import get_db, require_permission
from app.models.user import User
from app.schemas.base_response import MessageResponse
from app.schemas.service_agenda import (
    ServiceCreate,
    ServiceUpdate,
    ServiceResponse,
    ServiceImageUploadResponse,
)
from app.services.service_agenda_service import (
    list_services,
    get_service_by_id,
    create_service,
    update_service,
    delete_service,
)


router = APIRouter(
    prefix="/agenda",
    tags=["Agenda"],
)


@router.get("/services", response_model=List[ServiceResponse])
def get_services(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    branch_id: Optional[int] = Query(default=None, ge=1),
    category_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:view")),
):
    return list_services(
        db=db,
        skip=skip,
        limit=limit,
        branch_id=branch_id,
        category_id=category_id,
    )


@router.get("/services/{service_id}", response_model=ServiceResponse)
def get_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:view")),
):
    return get_service_by_id(db=db, service_id=service_id)


@router.post(
    "/services",
    response_model=ServiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:manage")),
):
    return create_service(
        db=db,
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
        category_id=payload.category_id,
        duration_minutes=payload.duration_minutes,
        price=payload.price,
        branch_ids=payload.branch_ids,
    )


@router.put("/services/{service_id}", response_model=ServiceResponse)
def update_existing_service(
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:manage")),
):
    return update_service(
        db=db,
        service_id=service_id,
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
        category_id=payload.category_id,
        duration_minutes=payload.duration_minutes,
        price=payload.price,
        branch_ids=payload.branch_ids,
    )


@router.post(
    "/services/upload-image",
    response_model=ServiceImageUploadResponse,
)
async def upload_service_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("services:manage")),
):
    filename = (file.filename or "").lower()
    ext = "." + filename.split(".")[-1] if "." in filename else ""

    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen",
        )

    if ext and ext not in settings.allowed_image_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de imagen no permitido",
        )

    content = await file.read()
    if len(content) > settings.max_image_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen excede el tamaño maximo permitido",
        )

    mime = file.content_type or "application/octet-stream"
    encoded = base64.b64encode(content).decode("ascii")
    return ServiceImageUploadResponse(image_url=f"data:{mime};base64,{encoded}")


@router.delete("/services/{service_id}", response_model=MessageResponse)
def delete_existing_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:manage")),
):
    delete_service(db=db, service_id=service_id)
    return MessageResponse(message="Servicio eliminado correctamente")
