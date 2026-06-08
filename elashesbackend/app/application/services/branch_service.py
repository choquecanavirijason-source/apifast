from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.domain.entities.branch import Branch
from app.domain.entities.user import User

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
        opening_hours=opening_hours or [],
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
    qr_image_url: Optional[str] = None,
) -> Branch:
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

    if opening_hours is not None:
        branch.opening_hours = opening_hours

    if qr_image_url is not None:
        branch.qr_image_url = qr_image_url if qr_image_url.strip() else None

    if user_ids is not None:
        _sync_branch_users(db=db, branch_id=branch.id, user_ids=user_ids)

    db.commit()
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