from typing import List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.domain.entities.user import User
from app.presentation.schemas.base_response import MessageResponse
from app.presentation.schemas.branch import BranchCreate, BranchUpdate, BranchResponse
from app.presentation.schemas.branch_integration import (
    BranchIntegrationProfileCreate,
    BranchIntegrationProfileUpdate,
    BranchIntegrationProfileResponse,
    BranchIntegrationsResponse,
    BranchIntegrationsUpdate,
)
from app.application.services.branch_service import (
    list_branches,
    get_branch_by_id,
    create_branch,
    update_branch,
    delete_branch,
)
from app.application.services.branch_integration_service import (
    list_integration_profiles,
    get_integration_profile,
    create_integration_profile,
    update_integration_profile,
    delete_integration_profile,
    get_branch_integrations,
    update_branch_integrations,
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
        opening_hours=[item.model_dump() for item in payload.opening_hours],
        user_ids=payload.user_ids,
        maps_url=payload.maps_url,
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
        opening_hours=[item.model_dump() for item in payload.opening_hours] if payload.opening_hours is not None else None,
        user_ids=payload.user_ids,
        qr_image_url=payload.qr_image_url,
        maps_url=payload.maps_url,
    )


@router.delete("/{branch_id}", response_model=MessageResponse)
def delete_existing_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:manage")),
):
    delete_branch(db=db, branch_id=branch_id)
    return MessageResponse(message="Sucursal eliminada correctamente")


# ── Perfiles de integración compartidos ──────────────────────────────────────

@router.get("/integration-profiles", response_model=List[BranchIntegrationProfileResponse])
def get_integration_profiles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:view")),
):
    return list_integration_profiles(db=db)


@router.post("/integration-profiles", response_model=BranchIntegrationProfileResponse, status_code=status.HTTP_201_CREATED)
def create_new_integration_profile(
    payload: BranchIntegrationProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:manage")),
):
    return create_integration_profile(db=db, payload=payload.model_dump())


@router.put("/integration-profiles/{profile_id}", response_model=BranchIntegrationProfileResponse)
def update_existing_integration_profile(
    profile_id: int,
    payload: BranchIntegrationProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:manage")),
):
    return update_integration_profile(db=db, profile_id=profile_id, payload=payload.model_dump(exclude_unset=True))


@router.delete("/integration-profiles/{profile_id}", response_model=MessageResponse)
def delete_existing_integration_profile(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:manage")),
):
    delete_integration_profile(db=db, profile_id=profile_id)
    return MessageResponse(message="Perfil de integración eliminado correctamente")


# ── Integraciones por sucursal ────────────────────────────────────────────────

@router.get("/{branch_id}/integrations", response_model=BranchIntegrationsResponse)
def get_branch_integrations_endpoint(
    branch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:view")),
):
    return get_branch_integrations(db=db, branch_id=branch_id)


@router.put("/{branch_id}/integrations", response_model=BranchIntegrationsResponse)
def update_branch_integrations_endpoint(
    branch_id: int,
    payload: BranchIntegrationsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("branches:manage")),
):
    return update_branch_integrations(db=db, branch_id=branch_id, payload=payload.model_dump(exclude_unset=True))