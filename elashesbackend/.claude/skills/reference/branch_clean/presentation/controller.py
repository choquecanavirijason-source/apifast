"""
Capa de presentación.

Responsabilidades:
- Definir el APIRouter.
- Validar input vía Pydantic.
- Resolver dependencias (db, permiso).
- Crear el repo + service y delegar.
- Traducir excepciones de DOMINIO a HTTPException (HTTP status correctos).
- Serializar la respuesta vía response_model.

NUNCA contiene lógica de negocio.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.domain.entities.user import User
from app.presentation.schemas.base_response import MessageResponse

from ..application.service import BranchService
from ..domain.exceptions import (
    BranchNotFound,
    BranchNameConflict,
    BranchInUse,
    UsersNotFound,
)
from ..infrastructure.repository import BranchRepository
from .schemas import BranchCreate, BranchUpdate, BranchResponse


router = APIRouter(prefix="/branches", tags=["Sucursales (clean)"])


def get_branch_service(db: Session = Depends(get_db)) -> BranchService:
    """Composition root del módulo: arma el grafo de dependencias."""
    return BranchService(repo=BranchRepository(db=db))


def _handle(action):
    """Ejecuta `action()` y mapea las excepciones de dominio a HTTP."""
    try:
        return action()
    except BranchNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BranchNameConflict as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except BranchInUse as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except UsersNotFound as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/", response_model=List[BranchResponse])
def list_branches(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    city: str | None = Query(default=None),
    department: str | None = Query(default=None),
    service: BranchService = Depends(get_branch_service),
    current_user: User = Depends(require_permission("branches:view")),
):
    return _handle(lambda: service.list_branches(
        skip=skip, limit=limit, city=city, department=department,
    ))


@router.get("/{branch_id}", response_model=BranchResponse)
def get_branch(
    branch_id: int,
    service: BranchService = Depends(get_branch_service),
    current_user: User = Depends(require_permission("branches:view")),
):
    return _handle(lambda: service.get_branch(branch_id))


@router.post("/", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchCreate,
    service: BranchService = Depends(get_branch_service),
    current_user: User = Depends(require_permission("branches:manage")),
):
    return _handle(lambda: service.create_branch(
        name=payload.name,
        address=payload.address,
        city=payload.city,
        department=payload.department,
        opening_hours=[r.model_dump() for r in payload.opening_hours],
        user_ids=payload.user_ids,
    ))


@router.put("/{branch_id}", response_model=BranchResponse)
def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    service: BranchService = Depends(get_branch_service),
    current_user: User = Depends(require_permission("branches:manage")),
):
    return _handle(lambda: service.update_branch(
        branch_id,
        name=payload.name,
        address=payload.address,
        city=payload.city,
        department=payload.department,
        opening_hours=(
            [r.model_dump() for r in payload.opening_hours]
            if payload.opening_hours is not None else None
        ),
        user_ids=payload.user_ids,
    ))


@router.delete("/{branch_id}", response_model=MessageResponse)
def delete_branch(
    branch_id: int,
    service: BranchService = Depends(get_branch_service),
    current_user: User = Depends(require_permission("branches:manage")),
):
    _handle(lambda: service.delete_branch(branch_id))
    return MessageResponse(message="Sucursal eliminada correctamente")
