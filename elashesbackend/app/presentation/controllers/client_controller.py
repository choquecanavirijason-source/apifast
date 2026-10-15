from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import (
    get_db,
    get_current_active_user,
    require_permission,
    resolve_branch_id,
)
from app.core.internal_auth import has_valid_internal_key
from app.core.rate_limit import rate_limit, rate_limit_check, rate_limit_record
from app.domain.entities.client import Client
from app.domain.entities.user import User
from app.presentation.schemas.base_response import MessageResponse
from app.core.audit import record_audit
from app.presentation.schemas.client import (
    CitaProximaResponse,
    ClientCreate,
    ClientNotificacionesResponse,
    ClientNotificacionesUpdate,
    ClientResponse,
    ClientUpdate,
    RetoqueResponse,
)
from app.application.services.client_service import (
    list_clients,
    get_client_by_id,
    create_client,
    update_client,
    delete_client,
    set_client_notifications,
)
from app.application.services.retoque_service import list_citas_proximas, list_retoques


router = APIRouter(
    prefix="/clients",
    tags=["Clientes"],
)


class _SalonLoginPayload(BaseModel):
    email: str
    ci: str


@router.post("/verify-salon-login")
def verify_salon_login(
    payload: _SalonLoginPayload,
    request: Request,
    x_internal_key: Optional[str] = Header(default=None, alias="X-Internal-Key"),
    db: Session = Depends(get_db),
):
    """
    Endpoint INTERNO: verifica que un cliente del salón pueda acceder al marketplace
    usando su email (o nombre) + CI como contraseña. Solo si marketplace_enabled = True.
    Llamado exclusivamente por backend_marketplace en el flujo de login.

    El CI es un número corto y adivinable (no un secreto real) — sin límite
    de intentos, este endpoint era brute-forceable directamente.

    Límite de intentos:
    - Sin X-Internal-Key válida: 5 por minuto por IP (cuenta todas las llamadas).
    - Con X-Internal-Key válida (llamada del marketplace, todas desde la misma IP):
      5 intentos FALLIDOS por minuto por cuenta; los logins válidos no consumen cupo.
    """
    from sqlalchemy import func, or_

    identifier = payload.email.strip().lower()
    internal = has_valid_internal_key(x_internal_key)
    if internal:
        rate_limit_check(
            request, "verify-salon-login-account", max_attempts=5, window_seconds=60,
            subject=identifier,
        )
    else:
        rate_limit(request, "verify-salon-login", max_attempts=5, window_seconds=60)

    def _fail(body: dict) -> dict:
        if internal:
            rate_limit_record(request, "verify-salon-login-account", subject=identifier)
        return body

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
        return _fail({"valid": False})
    if client.ci.strip() != payload.ci.strip():
        return _fail({"valid": False})
    if not client.marketplace_enabled:
        return _fail({"valid": False, "reason": "marketplace_not_enabled"})
    return {
        "valid": True,
        "id": client.id,
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


# Antes de "/{client_id}": si no, "retoques" se tomaría como un id (422).
@router.get(
    "/retoques",
    response_model=List[RetoqueResponse],
)
def get_retoques(
    dias: int = Query(default=30, ge=1, le=365),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients:view")),
):
    """Estado de retoques: mantenimiento/retiro en los próximos `dias` días,
    más los vencidos de la última semana (ver retoque_service)."""
    effective_branch = resolve_branch_id(branch_id, current_user)
    return list_retoques(db=db, dias=dias, branch_id=effective_branch)


@router.get(
    "/citas-proximas",
    response_model=List[CitaProximaResponse],
)
def get_citas_proximas(
    dias: int = Query(default=30, ge=1, le=365),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients:view")),
):
    """Próximas citas no canceladas en los próximos `dias` días (ver retoque_service)."""
    effective_branch = resolve_branch_id(branch_id, current_user)
    return list_citas_proximas(db=db, dias=dias, branch_id=effective_branch)


@router.patch(
    "/{client_id}/notificaciones",
    response_model=ClientNotificacionesResponse,
)
def update_client_notifications(
    client_id: int,
    payload: ClientNotificacionesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("clients:manage")),
):
    """Activa/desactiva los avisos de mantenimiento/retiro de la clienta."""
    client = get_client_by_id(db=db, client_id=client_id)
    # Roles acotados a su sucursal (Operaria, Cajera) solo tocan clientas de
    # esa sucursal; una clienta sin sucursal tampoco cuenta como suya.
    if resolve_branch_id(client.branch_id, current_user) != client.branch_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes cambiar las notificaciones de clientas de tu sucursal.",
        )

    result = set_client_notifications(db=db, client=client, activas=payload.notificaciones_activas)
    estado = "activó" if result.notificaciones_activas else "desactivó"
    record_audit(
        db, current_user, "update", "client", client_id,
        f"{estado.capitalize()} las notificaciones de retoque de '{result.name} {result.last_name}'",
        branch_id=result.branch_id,
    )
    return result


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