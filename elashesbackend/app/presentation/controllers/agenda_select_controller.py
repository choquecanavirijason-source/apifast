from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_any_permission
from app.domain.entities.user import User
from app.domain.entities.service_agenda import Appointment
from app.application.services.client_service import list_clients as list_clients_service
from app.application.services.service_agenda_service import list_professionals_for_select


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
    return [{"id": c.id, "nombre": c.name, "apellido": c.last_name, "phone": c.phone, "status": c.status} for c in clients]


@router.get("/professionals-for-select")
def get_professionals_for_select(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    role_name: Optional[str] = Query(default=None),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("appointments:view", "appointments:manage", "payments:view", "payments:manage")),
):
    professionals = list_professionals_for_select(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        role_name=role_name,
        branch_id=branch_id,
    )

    # is_busy: operaria tiene un ticket en_servicio HOY (evita datos obsoletos de días anteriores)
    today_str = date.today().isoformat()
    busy_ids = {
        row[0]
        for row in db.query(Appointment.professional_id)
        .filter(
            Appointment.status == "in_service",
            Appointment.professional_id.isnot(None),
            Appointment.start_time >= f"{today_str}T00:00:00",
            Appointment.start_time <= f"{today_str}T23:59:59",
        )
        .all()
    }

    return [
        {
            "id": p.id,
            "username": p.username,
            "email": p.email,
            "branch_id": p.branch_id,
            "branch_name": p.branch.name if p.branch else None,
            "skill_level": p.skill_level,
            "is_busy": p.id in busy_ids,
        }
        for p in professionals
    ]
