from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_db,
    get_current_active_user,
    require_permission,
    resolve_branch_id,
)
from app.domain.entities.client import Client
from app.domain.entities.user import User
from app.presentation.schemas.base_response import MessageResponse
from app.presentation.schemas.client import ClientCreate, ClientUpdate, ClientResponse
from app.application.services.client_service import (
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


class _SalonLoginPayload(BaseModel):
    email: str
    ci: str


@router.post("/verify-salon-login")
def verify_salon_login(payload: _SalonLoginPayload, db: Session = Depends(get_db)):
    """
    Endpoint INTERNO: verifica que un cliente del salón pueda acceder al marketplace
    usando su email (o nombre) + CI como contraseña. Solo si marketplace_enabled = True.
    Llamado exclusivamente por backend_marketplace en el flujo de login.
    """
    from sqlalchemy import func, or_

    identifier = payload.email.strip().lower()
    full_name = func.lower(
        func.trim(Client.name + " " + func.coalesce(Client.last_name, ""))
    )
    client = (
        db.query(Client)
        .filter(
            or_(
                func.lower(Client.email) == identifier,
                func.lower(Client.name) == identifier,
                full_name == identifier,
            )
        )
        .first()
    )
    if not client or not client.ci:
        return {"valid": False}
    if client.ci.strip() != payload.ci.strip():
        return {"valid": False}
    if not client.marketplace_enabled:
        return {"valid": False, "reason": "marketplace_not_enabled"}
    return {
        "valid": True,
        "name": f"{client.name} {client.last_name}".strip(),
        "email": client.email,
        "phone": client.phone,
    }


@router.get("/lookup")
def lookup_client_by_phone(
    phone: str = Query(..., min_length=6),
    db: Session = Depends(get_db),
):
    """
    Endpoint PÚBLICO: busca un cliente del salón por teléfono.
    Solo devuelve nombre y email para pre-rellenar el checkout del marketplace.
    No expone datos sensibles ni requiere autenticación.
    """
    phone = phone.strip()
    # Intentar con el número tal cual y con prefijo +51 (Perú)
    candidates = [phone]
    if not phone.startswith("+"):
        candidates.append(f"+51{phone}")
    elif phone.startswith("+51"):
        candidates.append(phone[3:])

    client = (
        db.query(Client)
        .filter(Client.phone.in_(candidates))
        .first()
    )
    if not client:
        return {"found": False}

    return {
        "found": True,
        "name": f"{client.name} {client.last_name}".strip(),
        "email": client.email,
    }


@router.get(
    "/",
    response_model=List[ClientResponse],
)
def get_clients(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=1000),
    search: Optional[str] = Query(default=None),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients:view")),
):
    effective_branch = resolve_branch_id(branch_id, current_user)
    return list_clients(db=db, skip=skip, limit=limit, search=search, branch_id=effective_branch)


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