from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_db,
    get_current_active_user,
    require_permission,
)
from app.models.user import User
from app.schemas.base_response import MessageResponse
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.services.client_service import (
    list_clients,
    get_client_by_id,
    create_client,
    update_client,
    delete_client,
)


router = APIRouter(
    prefix="/clients",
    tags=["Clientes"],
)


@router.get(
    "/",
    response_model=List[ClientResponse],
)
def get_clients(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients:view")),
):
    return list_clients(db=db, skip=skip, limit=limit, search=search, branch_id=branch_id)


@router.get(
    "/{client_id}",
    response_model=ClientResponse,
)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients:view")),
):
    return get_client_by_id(db=db, client_id=client_id)


@router.post(
    "/",
    response_model=ClientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients:manage")),
):
    return create_client(db=db, payload=payload)


@router.put(
    "/{client_id}",
    response_model=ClientResponse,
)
def update_existing_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients:manage")),
):
    return update_client(db=db, client_id=client_id, payload=payload)


@router.delete(
    "/{client_id}",
    response_model=MessageResponse,
)
def delete_existing_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients:manage")),
):
    delete_client(db=db, client_id=client_id)
    return MessageResponse(message="Cliente eliminado correctamente")