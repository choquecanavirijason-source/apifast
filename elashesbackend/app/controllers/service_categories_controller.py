from typing import List
import base64

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.core.dependencies import get_db, require_any_permission
from app.models.user import User
from app.schemas.base_response import MessageResponse
from app.schemas.service_agenda import (
    ServiceCategoryCreate,
    ServiceCategoryUpdate,
    ServiceCategoryResponse,
    ServiceImageUploadResponse,
)
from app.services.service_agenda_service import (
    list_service_categories,
    get_service_category_by_id,
    create_service_category,
    update_service_category,
    delete_service_category,
)


# API de dominio «servicios»: categorías no viven bajo /agenda (evita 404 por rutas mal alineadas).
router = APIRouter(
    prefix="/services",
    tags=["Servicios — categorías"],
)


@router.get("/categories", response_model=List[ServiceCategoryResponse])
def get_service_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission("services:view", "appointments:view")
    ),
):
    return list_service_categories(db=db)


@router.post(
    "/categories",
    response_model=ServiceCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_service_category(
    payload: ServiceCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission("services:manage", "appointments:manage")
    ),
):
    return create_service_category(
        db=db,
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
        is_mobile=payload.is_mobile,
    )


@router.post(
    "/categories/upload-image",
    response_model=ServiceImageUploadResponse,
)
async def upload_service_category_image(
    file: UploadFile = File(...),
    current_user: User = Depends(
        require_any_permission("services:manage", "appointments:manage")
    ),
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


@router.get("/categories/{category_id}", response_model=ServiceCategoryResponse)
def get_service_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission("services:view", "appointments:view")
    ),
):
    return get_service_category_by_id(db=db, category_id=category_id)


@router.put("/categories/{category_id}", response_model=ServiceCategoryResponse)
def update_existing_service_category(
    category_id: int,
    payload: ServiceCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission("services:manage", "appointments:manage")
    ),
):
    return update_service_category(
        db=db,
        category_id=category_id,
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
        is_mobile=payload.is_mobile,
    )


@router.delete("/categories/{category_id}", response_model=MessageResponse)
def delete_existing_service_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission("services:manage", "appointments:manage")
    ),
):
    delete_service_category(db=db, category_id=category_id)
    return MessageResponse(message="Categoria de servicio eliminada correctamente")
