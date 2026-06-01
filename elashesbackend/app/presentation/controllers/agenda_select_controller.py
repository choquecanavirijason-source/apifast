from collections import defaultdict
from datetime import date, datetime
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

    today_str = date.today().isoformat()
    now = datetime.now()

    # Tickets activos hoy (in_service o pending) por profesional
    active_appts = (
        db.query(Appointment)
        .filter(
            Appointment.professional_id.isnot(None),
            Appointment.status.in_(["in_service", "pending", "confirmed"]),
            Appointment.start_time >= f"{today_str}T00:00:00",
            Appointment.start_time <= f"{today_str}T23:59:59",
        )
        .order_by(Appointment.start_time)
        .all()
    )

    # Agrupar por professional_id
    in_service_ids: set[int] = set()
    pending_count: dict[int, int] = defaultdict(int)
    # Cuándo termina el bloque actual (último end_time de appointments activos)
    busy_until: dict[int, datetime] = {}

    for appt in active_appts:
        pid = appt.professional_id
        if appt.status == "in_service":
            in_service_ids.add(pid)
        if appt.status in ("in_service", "pending", "confirmed"):
            pending_count[pid] += 1
            end = appt.end_time
            if end and (pid not in busy_until or end > busy_until[pid]):
                busy_until[pid] = end

    def fmt_time(dt: datetime) -> str:
        return dt.strftime("%H:%M") if dt else ""

    return [
        {
            "id": p.id,
            "username": p.username,
            "email": p.email,
            "branch_id": p.branch_id,
            "branch_name": p.branch.name if p.branch else None,
            "skill_level": p.skill_level,
            # True solo si está ACTUALMENTE en servicio
            "is_busy": p.id in in_service_ids,
            # Cantidad de turnos activos hoy (in_service + pending)
            "active_count_today": pending_count.get(p.id, 0),
            # Hora estimada en que termina el último turno activo
            "busy_until_time": fmt_time(busy_until[p.id]) if p.id in busy_until else None,
            # Sucursal efectiva (temporal o de origen)
            "effective_branch_id": p.effective_branch_id,
            "is_temp_assigned": p.is_temp_assigned,
            "temp_branch_id": p.temp_branch_id,
            "temp_branch_until": p.temp_branch_until.isoformat() if p.temp_branch_until else None,
            "temp_branch_name": p.temp_branch.name if p.temp_branch else None,
        }
        for p in professionals
    ]
