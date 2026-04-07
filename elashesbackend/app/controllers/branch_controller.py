from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.models.user import User
from app.schemas.base_response import MessageResponse
from app.schemas.branch import BranchCreate, BranchUpdate, BranchResponse
from app.services.branch_service import (
    list_branches,
    get_branch_by_id,
    create_branch,
    update_branch,
    delete_branch,
)


router = APIRouter(
    prefix="/branches",
    tags=["Sucursales"],
)


@router.get("/", response_model=List[BranchResponse])
def get_branches(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    city: str | None = Query(default=None),
    department: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:view")),
):
    return list_branches(
        db=db,
        skip=skip,
        limit=limit,
        city=city,
        department=department,
    )


@router.get("/{branch_id}", response_model=BranchResponse)
def get_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:view")),
):
    return get_branch_by_id(db=db, branch_id=branch_id)


@router.post("/", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
def create_new_branch(
    payload: BranchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:manage")),
):
    return create_branch(
        db=db,
        name=payload.name,
        address=payload.address,
        city=payload.city,
        department=payload.department,
    )


@router.put("/{branch_id}", response_model=BranchResponse)
def update_existing_branch(
    branch_id: int,
    payload: BranchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:manage")),
):
    return update_branch(
        db=db,
        branch_id=branch_id,
        name=payload.name,
        address=payload.address,
        city=payload.city,
        department=payload.department,
    )


@router.delete("/{branch_id}", response_model=MessageResponse)
def delete_existing_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:manage")),
):
    delete_branch(db=db, branch_id=branch_id)
    return MessageResponse(message="Sucursal eliminada correctamente")