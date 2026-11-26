import base64
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.countries import COUNTRY_NAME_TO_CODE
from app.domain.entities.branch import Branch
from app.domain.entities.user import User


def _derive_country_code(department: Optional[str]) -> Optional[str]:
    if not department:
        return None
    return COUNTRY_NAME_TO_CODE.get(department.strip().lower())


_opening_hours_column_checked = False


def _ensure_opening_hours_column(db: Session) -> None:
    global _opening_hours_column_checked
    if _opening_hours_column_checked:
        return

    dialect_name = db.bind.dialect.name if db.bind else ""
    try:
        db.execute(text("SELECT opening_hours FROM branches LIMIT 1"))
        _opening_hours_column_checked = True
        return
    except OperationalError:
        db.rollback()

    if dialect_name == "sqlite":
        db.execute(text("ALTER TABLE branches ADD COLUMN opening_hours TEXT NULL"))
    else:
        db.execute(text("ALTER TABLE branches ADD COLUMN opening_hours JSON NULL"))
    db.commit()
    _opening_hours_column_checked = True


def _attach_branch_user_ids(branch: Branch) -> None:
    branch.user_ids = [user.id for user in branch.users] if getattr(branch, "users", None) else []


def _sync_branch_users(db: Session, branch_id: int, user_ids: list[int]) -> None:
    normalized_ids = sorted(set(user_ids))

    users_to_assign = []
    if normalized_ids:
        users_to_assign = db.query(User).filter(User.id.in_(normalized_ids)).all()
        found_ids = {user.id for user in users_to_assign}
        missing_ids = [user_id for user_id in normalized_ids if user_id not in found_ids]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Usuarios no encontrados: {', '.join(str(item) for item in missing_ids)}",
            )

    db.query(User).filter(User.branch_id == branch_id).update({User.branch_id: None})
    for user in users_to_assign:
        user.branch_id = branch_id


def list_branches(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    city: Optional[str] = None,
    department: Optional[str] = None,
):
    _ensure_opening_hours_column(db)
    query = db.query(Branch)

    if city and city.strip():
        query = query.filter(Branch.city.ilike(f"%{city.strip()}%"))

    if department and department.strip():
        query = query.filter(Branch.department.ilike(f"%{department.strip()}%"))

    branches = query.order_by(Branch.name.asc()).offset(skip).limit(limit).all()
    for branch in branches:
        if branch.opening_hours is None:
            branch.opening_hours = []
        _attach_branch_user_ids(branch)
    return branches


def get_branch_by_id(db: Session, branch_id: int) -> Branch:
    _ensure_opening_hours_column(db)
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sucursal no encontrada",
        )

    if branch.opening_hours is None:
        branch.opening_hours = []
    _attach_branch_user_ids(branch)
    return branch


def create_branch(
    db: Session,
    name: str,
    address: Optional[str] = None,
    city: Optional[str] = None,
    department: Optional[str] = None,
    opening_hours: Optional[list[dict]] = None,
    user_ids: Optional[list[int]] = None,
    maps_url: Optional[str] = None,
) -> Branch:
    _ensure_opening_hours_column(db)
    existing = db.query(Branch).filter(Branch.name == name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una sucursal con ese nombre",
        )

    branch = Branch(
        name=name.strip(),
        address=address,
        city=city,
        department=department,
        country_code=_derive_country_code(department),
        opening_hours=opening_hours or [],
        maps_url=maps_url,
    )

    db.add(branch)
    db.commit()

    if user_ids is not None:
        _sync_branch_users(db=db, branch_id=branch.id, user_ids=user_ids)
        db.commit()

    db.refresh(branch)

    _attach_branch_user_ids(branch)
    return branch


def update_branch(
    db: Session,
    branch_id: int,
    name: Optional[str] = None,
    address: Optional[str] = None,
    city: Optional[str] = None,
    department: Optional[str] = None,
    opening_hours: Optional[list[dict]] = None,
    user_ids: Optional[list[int]] = None,
    maps_url: Optional[str] = None,
) -> Branch:
    # El QR de pago ya no se edita por aquí: se sube con set_branch_qr / clear_branch_qr
    # para que cada cambio quede auditado (quién, cuándo, qué).
    _ensure_opening_hours_column(db)
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sucursal no encontrada",
        )

    if name is not None:
        existing = (
            db.query(Branch)
            .filter(Branch.name == name.strip(), Branch.id != branch_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una sucursal con ese nombre",
            )
        branch.name = name.strip()

    if address is not None:
        branch.address = address

    if city is not None:
        branch.city = city

    if department is not None:
        branch.department = department
        branch.country_code = _derive_country_code(department)

    if opening_hours is not None:
        branch.opening_hours = opening_hours

    if maps_url is not None:
        branch.maps_url = maps_url if maps_url.strip() else None

    if user_ids is not None:
        _sync_branch_users(db=db, branch_id=branch.id, user_ids=user_ids)

    db.commit()
    db.refresh(branch)

    _attach_branch_user_ids(branch)
    return branch


QR_MAX_BYTES = 2 * 1024 * 1024  # un QR bancario pesa pocos KB; 2 MB sobra


def _detect_image_mime(content: bytes) -> Optional[str]:
    """Tipo real según los primeros bytes (no se confía en la extensión ni en el
    content-type que manda el navegador). SVG se rechaza a propósito: puede traer scripts."""
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def set_branch_qr(db: Session, branch_id: int, content: bytes, user: Optional[User]) -> Branch:
    """Sube/reemplaza el QR de pago de la sucursal y deja constancia en auditoría."""
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada")

    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo está vacío")
    if len(content) > QR_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen del QR no puede superar 2 MB",
        )
    mime = _detect_image_mime(content)
    if not mime:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no permitido. Sube una imagen PNG, JPG o WEBP",
        )

    had_qr = bool(branch.qr_image_url)
    branch.qr_image_url = f"data:{mime};base64,{base64.b64encode(content).decode('ascii')}"
    branch.qr_updated_at = datetime.now(timezone.utc)
    branch.qr_updated_by_id = user.id if user else None

    kb = max(1, round(len(content) / 1024))
    record_audit(
        db=db,
        user=user,
        action="update" if had_qr else "create",
        entity_type="branch_qr",
        entity_id=branch.id,
        description=(
            f"QR de pago de la sucursal «{branch.name}»: "
            f"{'reemplazado por una imagen nueva' if had_qr else 'cargado por primera vez'} "
            f"({mime.split('/')[1].upper()}, {kb} KB)"
        ),
        branch_id=branch.id,
    )
    db.refresh(branch)
    _attach_branch_user_ids(branch)
    return branch


def clear_branch_qr(db: Session, branch_id: int, user: Optional[User]) -> Branch:
    """Quita el QR de pago de la sucursal y deja constancia en auditoría."""
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal no encontrada")

    if branch.qr_image_url:
        branch.qr_image_url = None
        branch.qr_updated_at = datetime.now(timezone.utc)
        branch.qr_updated_by_id = user.id if user else None
        record_audit(
            db=db,
            user=user,
            action="delete",
            entity_type="branch_qr",
            entity_id=branch.id,
            description=f"QR de pago de la sucursal «{branch.name}»: eliminado",
            branch_id=branch.id,
        )
        db.refresh(branch)

    _attach_branch_user_ids(branch)
    return branch


def delete_branch(db: Session, branch_id: int) -> None:
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sucursal no encontrada",
        )

    try:
        db.delete(branch)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar la sucursal porque está en uso",
        )