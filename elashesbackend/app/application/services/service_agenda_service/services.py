"""Casos de uso para Service (servicios del catálogo) y selección de profesionales."""
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.branch import Branch
from app.domain.entities.service_agenda import BranchService, Service
from app.domain.entities.user import Role, User

from .categories import _resolve_service_category_id


def list_services(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    branch_id: Optional[int] = None,
    category_id: Optional[int] = None,
):
    query = db.query(Service).options(
        joinedload(Service.category),
        joinedload(Service.branch_services),
    )

    if category_id is not None:
        query = query.filter(Service.category_id == category_id)

    if branch_id is not None:
        has_mappings = (
            db.query(BranchService)
            .filter(BranchService.branch_id == branch_id)
            .count()
            > 0
        )
        if has_mappings:
            query = query.join(BranchService).filter(
                BranchService.branch_id == branch_id,
                BranchService.is_active.is_(True),
            )

    return query.order_by(Service.name.asc()).offset(skip).limit(limit).all()


def get_service_by_id(db: Session, service_id: int) -> Service:
    service = (
        db.query(Service)
        .options(joinedload(Service.category), joinedload(Service.branch_services))
        .filter(Service.id == service_id)
        .first()
    )
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado",
        )
    return service


def list_professionals_for_select(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    role_name: Optional[str] = None,
):
    query = db.query(User).filter(User.is_active.is_(True))

    if role_name and role_name.strip():
        query = query.join(User.role).filter(Role.name.ilike(f"%{role_name.strip()}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.username.ilike(term),
                User.email.ilike(term),
            )
        )

    return (
        query.order_by(User.username.asc(), User.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def _sync_service_branches(db: Session, service: Service, branch_ids: Optional[List[int]]):
    if branch_ids is None:
        return

    normalized = [int(value) for value in branch_ids if value is not None]
    unique_ids = list(dict.fromkeys(normalized))
    if not unique_ids:
        service.branch_services = []
        return

    existing_branches = {
        branch.id
        for branch in db.query(Branch).filter(Branch.id.in_(unique_ids)).all()
    }
    missing = [branch_id for branch_id in unique_ids if branch_id not in existing_branches]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La sucursal indicada no existe",
        )

    existing = {link.branch_id: link for link in service.branch_services}
    for branch_id in unique_ids:
        if branch_id in existing:
            existing[branch_id].is_active = True
        else:
            service.branch_services.append(
                BranchService(branch_id=branch_id, service_id=service.id, is_active=True)
            )

    for branch_id, link in existing.items():
        if branch_id not in unique_ids:
            link.is_active = False


def create_service(
    db: Session,
    name: str,
    description: Optional[str],
    image_url: Optional[str],
    category_id: Optional[int],
    duration_minutes: int,
    price: float,
    branch_ids: Optional[List[int]] = None,
) -> Service:
    existing = db.query(Service).filter(Service.name == name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un servicio con ese nombre",
        )

    if duration_minutes <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La duración debe ser mayor a 0",
        )

    if price < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El precio no puede ser negativo",
        )

    resolved_category_id = _resolve_service_category_id(db, category_id)

    service = Service(
        name=name.strip(),
        description=description,
        image_url=image_url,
        category_id=resolved_category_id,
        duration_minutes=duration_minutes,
        price=price,
    )
    db.add(service)
    db.commit()
    db.refresh(service)

    resolved_branch_ids = branch_ids
    if resolved_branch_ids is None:
        resolved_branch_ids = [branch.id for branch in db.query(Branch).all()]

    _sync_service_branches(db=db, service=service, branch_ids=resolved_branch_ids)
    db.commit()
    db.refresh(service)
    return service


def update_service(
    db: Session,
    service_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    image_url: Optional[str] = None,
    category_id: Optional[int] = None,
    duration_minutes: Optional[int] = None,
    price: Optional[float] = None,
    branch_ids: Optional[List[int]] = None,
) -> Service:
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado",
        )

    if name is not None:
        existing = (
            db.query(Service)
            .filter(Service.name == name.strip(), Service.id != service_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un servicio con ese nombre",
            )
        service.name = name.strip()

    if description is not None:
        service.description = description

    if image_url is not None:
        service.image_url = image_url

    if category_id is not None:
        service.category_id = _resolve_service_category_id(db, category_id)

    if duration_minutes is not None:
        if duration_minutes <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La duración debe ser mayor a 0",
            )
        service.duration_minutes = duration_minutes

    if price is not None:
        if price < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El precio no puede ser negativo",
            )
        service.price = price

    _sync_service_branches(db=db, service=service, branch_ids=branch_ids)

    db.commit()
    db.refresh(service)
    return service


def delete_service(db: Session, service_id: int) -> None:
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servicio no encontrado",
        )

    try:
        db.delete(service)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar el servicio porque está en uso",
        )
