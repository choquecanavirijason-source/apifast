from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.branch import Branch


def list_branches(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    city: Optional[str] = None,
    department: Optional[str] = None,
):
    query = db.query(Branch)

    if city and city.strip():
        query = query.filter(Branch.city.ilike(f"%{city.strip()}%"))

    if department and department.strip():
        query = query.filter(Branch.department.ilike(f"%{department.strip()}%"))

    return query.order_by(Branch.name.asc()).offset(skip).limit(limit).all()


def get_branch_by_id(db: Session, branch_id: int) -> Branch:
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sucursal no encontrada",
        )

    return branch


def create_branch(
    db: Session,
    name: str,
    address: Optional[str] = None,
    city: Optional[str] = None,
    department: Optional[str] = None,
) -> Branch:
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
    )

    db.add(branch)
    db.commit()
    db.refresh(branch)

    return branch


def update_branch(
    db: Session,
    branch_id: int,
    name: Optional[str] = None,
    address: Optional[str] = None,
    city: Optional[str] = None,
    department: Optional[str] = None,
) -> Branch:
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

    db.commit()
    db.refresh(branch)

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