from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_any_permission
from app.models.user import User
from app.services.client_service import list_clients as list_clients_service
from app.services.service_agenda_service import list_professionals_for_select


router = APIRouter(
    prefix="/agenda",
    tags=["Agenda"],
)


@router.get("/clients-for-select")
def get_clients_for_select(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "payments:view", "clients:view")),
):
    clients = list_clients_service(db=db, skip=skip, limit=limit, search=search, branch_id=branch_id)
    return [{"id": c.id, "nombre": c.name, "apellido": c.last_name, "phone": c.phone} for c in clients]


@router.get("/professionals-for-select")
def get_professionals_for_select(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "appointments:manage")),
):
    professionals = list_professionals_for_select(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
    )
    return [{"id": p.id, "username": p.username, "email": p.email} for p in professionals]
