"""Casos de uso para ServiceCategory."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.domain.entities.service_agenda import Service, ServiceCategory


def list_service_categories(db: Session):
    return db.query(ServiceCategory).order_by(ServiceCategory.name.asc()).all()


def get_service_category_by_id(db: Session, category_id: int) -> ServiceCategory:
    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria de servicio no encontrada",
        )
    return category


def _get_or_create_default_service_category(db: Session) -> ServiceCategory:
    category = (
        db.query(ServiceCategory)
        .filter(ServiceCategory.name == "General")
        .first()
    )
    if category:
        return category

    category = ServiceCategory(
        name="General",
        description="Categoria por defecto para servicios",
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def create_service_category(
    db: Session,
    name: str,
    description: Optional[str] = None,
    image_url: Optional[str] = None,
    is_mobile: bool = False,
) -> ServiceCategory:
    normalized_name = name.strip()
    existing = (
        db.query(ServiceCategory)
        .filter(ServiceCategory.name == normalized_name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una categoria con ese nombre",
        )

    category = ServiceCategory(
        name=normalized_name,
        description=description,
        image_url=image_url,
        is_mobile=is_mobile,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_service_category(
    db: Session,
    category_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    image_url: Optional[str] = None,
    is_mobile: Optional[bool] = None,
) -> ServiceCategory:
    category = get_service_category_by_id(db, category_id)

    if name is not None:
        normalized_name = name.strip()
        existing = (
            db.query(ServiceCategory)
            .filter(ServiceCategory.name == normalized_name, ServiceCategory.id != category_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una categoria con ese nombre",
            )
        category.name = normalized_name

    if description is not None:
        category.description = description

    if image_url is not None:
        category.image_url = image_url

    if is_mobile is not None:
        category.is_mobile = is_mobile

    db.commit()
    db.refresh(category)
    return category


def delete_service_category(db: Session, category_id: int) -> None:
    category = get_service_category_by_id(db, category_id)

    service_using_category = db.query(Service).filter(Service.category_id == category_id).first()
    if service_using_category:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar la categoria porque esta asignada a uno o mas servicios",
        )

    db.delete(category)
    db.commit()


def _resolve_service_category_id(db: Session, category_id: Optional[int]) -> int:
    if category_id is None:
        return _get_or_create_default_service_category(db).id

    category = db.query(ServiceCategory).filter(ServiceCategory.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La categoria indicada no existe",
        )
    return category.id
