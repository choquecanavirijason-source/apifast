"""Casos de uso para Service (servicios del catálogo) y selección de profesionales."""
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.branch import Branch
from app.domain.entities.service_agenda import AppointmentService, BranchService, Service, ServiceComboItem
from app.domain.entities.user import Role, User

from .appointments import _UNSET
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

    services = query.order_by(Service.name.asc()).offset(skip).limit(limit).all()

    # Conteo de tickets por servicio (una sola query en bulk)
    if services:
        ids = [s.id for s in services]
        counts = dict(
            db.query(AppointmentService.service_id, func.count(AppointmentService.id))
            .filter(AppointmentService.service_id.in_(ids))
            .group_by(AppointmentService.service_id)
            .all()
        )
        for svc in services:
            svc.ticket_count = counts.get(svc.id, 0)
    return services


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
    branch_id: Optional[int] = None,
):
    from datetime import date as date_type

    query = db.query(User).filter(User.is_active.is_(True))

    if branch_id is not None:
        today = date_type.today()
        # Sucursal efectiva = temporal (si está activa hoy) o la de origen
        query = query.filter(
            or_(
                # Tiene asignación temporal activa apuntando a esta sucursal
                and_(
                    User.temp_branch_id == branch_id,
                    User.temp_branch_until >= today,
                ),
                # O su sucursal de origen es esta (sin asignación temporal activa)
                and_(
                    User.branch_id == branch_id,
                    or_(
                        User.temp_branch_id.is_(None),
                        User.temp_branch_until < today,
                    ),
                ),
            )
        )

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


def _validated_components(db: Session, component_ids: Optional[List[int]], combo_id: Optional[int] = None) -> List[Service]:
    """Valida y devuelve los servicios componentes en el orden pedido (un id puede repetirse)."""
    ids = [int(value) for value in (component_ids or [])]
    if len(ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Una promoción necesita al menos 2 servicios",
        )
    if combo_id is not None and combo_id in ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Una promoción no puede incluirse a sí misma",
        )
    found = {s.id: s for s in db.query(Service).filter(Service.id.in_(set(ids))).all()}
    missing = [i for i in set(ids) if i not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uno o más servicios de la promoción no existen",
        )
    nested = [found[i].name for i in dict.fromkeys(ids) if found[i].is_combo]
    if nested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Una promoción no puede incluir otra promoción ({', '.join(nested)})",
        )
    return [found[i] for i in ids]


def _set_combo_components(
    db: Session, combo: Service, components: List[Service], duration_minutes: Optional[int] = None
) -> None:
    """Reemplaza los componentes de la promoción. La duración es la que se indique (editable en el
    formulario, que la sugiere como suma de componentes); si no se indica, se usa esa suma."""
    combo.combo_items = [
        ServiceComboItem(service_id=component.id, position=index)
        for index, component in enumerate(components)
    ]
    if duration_minutes is not None and duration_minutes > 0:
        combo.duration_minutes = duration_minutes
    else:
        combo.duration_minutes = max(1, sum(int(component.duration_minutes or 0) for component in components))


def create_service(
    db: Session,
    name: str,
    description: Optional[str],
    image_url: Optional[str],
    category_id: Optional[int],
    duration_minutes: int,
    price: float,
    branch_ids: Optional[List[int]] = None,
    maintenance_days: Optional[int] = None,
    removal_days: Optional[int] = None,
    is_active: bool = True,
    discount_percent: Optional[float] = None,
    is_combo: bool = False,
    component_service_ids: Optional[List[int]] = None,
    commission_rate: Optional[float] = None,
) -> Service:
    existing = db.query(Service).filter(Service.name == name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un servicio con ese nombre",
        )

    # La comisión es obligatoria en un servicio normal. Una promoción no la necesita: al
    # venderla en el POS cada servicio incluido usa la suya.
    if not is_combo and commission_rate is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La comisión del servicio es obligatoria (un porcentaje entre 0 y 100)",
        )

    components: List[Service] = []
    if is_combo:
        components = _validated_components(db, component_service_ids)
    elif duration_minutes <= 0:
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
        maintenance_days=maintenance_days,
        removal_days=removal_days,
        is_active=is_active,
        discount_percent=discount_percent,
        is_combo=is_combo,
        commission_rate=commission_rate,
    )
    db.add(service)
    db.flush()
    if is_combo:
        _set_combo_components(db, service, components, duration_minutes)
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
    # _UNSET = no vino en el PUT (no tocar); None = vaciar ("no requiere").
    maintenance_days=_UNSET,
    removal_days=_UNSET,
    is_active: Optional[bool] = None,
    discount_percent: Optional[float] = None,
    component_service_ids: Optional[List[int]] = None,
    # _UNSET = no vino en el PUT (no tocar); None = intentó vaciarla.
    commission_rate=_UNSET,
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

    if service.is_combo:
        if component_service_ids is not None:
            _set_combo_components(
                db, service, _validated_components(db, component_service_ids, combo_id=service.id), duration_minutes
            )
        elif duration_minutes is not None and duration_minutes > 0:
            service.duration_minutes = duration_minutes
    elif duration_minutes is not None:
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

    if commission_rate is not _UNSET:
        if commission_rate is None and not service.is_combo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La comisión del servicio es obligatoria (un porcentaje entre 0 y 100)",
            )
        service.commission_rate = commission_rate

    if maintenance_days is not _UNSET:
        service.maintenance_days = maintenance_days

    if removal_days is not _UNSET:
        service.removal_days = removal_days

    if is_active is not None:
        service.is_active = is_active

    if discount_percent is not None:
        # 0 = sin descuento (así el form puede "limpiar" la promo sin dejar
        # el campo ambiguo entre "no tocar" y "borrar").
        service.discount_percent = discount_percent if discount_percent > 0 else None

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
