"""
Rutas de Agenda bajo /agenda (servicios, selectores, citas).

Las categorías se registran en main.py con el mismo prefijo /agenda (ver service_categories_controller).
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_any_permission, require_permission
from app.domain.entities.user import User
from app.domain.entities.service_agenda import Appointment
from app.presentation.schemas.base_response import MessageResponse
from app.presentation.schemas.service_agenda import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentUpdate,
    CallNextAppointment,
    ServiceCreate,
    ServiceImageUploadResponse,
    ServiceResponse,
    ServiceUpdate,
)
from app.application.services.client_service import list_clients as list_clients_service
from app.application.services.service_agenda_service import (
    call_next_appointment,
    create_appointment,
    create_service,
    delete_appointment,
    delete_service,
    get_appointment_by_id,
    get_service_by_id,
    list_appointments,
    list_mobile_available_appointments,
    list_professionals_for_select,
    list_services,
    update_appointment,
    update_service,
)

router = APIRouter(
    prefix="/agenda",
    tags=["Agenda"],
)

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "services"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024


# ==========================================
# Servicios
# ==========================================
@router.post("/services/upload-image", response_model=ServiceImageUploadResponse)
async def upload_service_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("services:manage")),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="Formato no valido. Usa jpg, jpeg, png, webp o gif.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo esta vacio.")
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="La imagen supera 5MB.")

    filename = f"{uuid4().hex}{ext}"
    output = UPLOAD_DIR / filename
    output.write_bytes(content)

    relative = f"/agenda/services/image/{filename}"
    image_url = f"{str(request.base_url).rstrip('/')}{relative}"
    return ServiceImageUploadResponse(image_url=image_url)


@router.get("/services/image/{filename}")
def get_service_image(filename: str):
    safe_name = Path(filename).name
    target = UPLOAD_DIR / safe_name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return FileResponse(target)


@router.get("/services", response_model=List[ServiceResponse])
def get_services(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    branch_id: Optional[int] = Query(default=None, ge=1),
    category_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:view")),
):
    return list_services(
        db=db,
        skip=skip,
        limit=limit,
        branch_id=branch_id,
        category_id=category_id,
    )


@router.get("/services/{service_id}", response_model=ServiceResponse)
def get_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:view")),
):
    return get_service_by_id(db=db, service_id=service_id)


@router.post(
    "/services",
    response_model=ServiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_service(
    payload: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:manage")),
):
    return create_service(
        db=db,
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
        category_id=payload.category_id,
        duration_minutes=payload.duration_minutes,
        price=payload.price,
        branch_ids=payload.branch_ids,
    )


@router.put("/services/{service_id}", response_model=ServiceResponse)
def update_existing_service(
    service_id: int,
    payload: ServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:manage")),
):
    return update_service(
        db=db,
        service_id=service_id,
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
        category_id=payload.category_id,
        duration_minutes=payload.duration_minutes,
        price=payload.price,
        branch_ids=payload.branch_ids,
    )


@router.delete("/services/{service_id}", response_model=MessageResponse)
def delete_existing_service(
    service_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("services:manage")),
):
    delete_service(db=db, service_id=service_id)
    return MessageResponse(message="Servicio eliminado correctamente")


# ==========================================
# Selectores (clientes / profesionales)
# ==========================================
@router.get("/clients-for-select")
def get_clients_for_select(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission("appointments:view", "payments:view", "clients:view")
    ),
):
    clients = list_clients_service(db=db, skip=skip, limit=limit, search=search, branch_id=branch_id)
    return [
        {"id": c.id, "nombre": c.name, "apellido": c.last_name, "phone": c.phone, "status": c.status, "age": c.age}
        for c in clients
    ]


@router.get("/professionals-for-select")
def get_professionals_for_select(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    search: Optional[str] = Query(default=None),
    role_name: Optional[str] = Query(default=None),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission("appointments:view", "appointments:manage", "branches:view", "branches:manage")
    ),
):
    professionals = list_professionals_for_select(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        role_name=role_name,
        branch_id=branch_id,
    )
    from collections import defaultdict
    today_str = datetime.today().date().isoformat()

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

    in_service_ids: set[int] = set()
    pending_count: dict[int, int] = defaultdict(int)
    busy_until: dict[int, datetime] = {}

    for appt in active_appts:
        pid = appt.professional_id
        if appt.status == "in_service":
            in_service_ids.add(pid)
        pending_count[pid] += 1
        if appt.end_time and (pid not in busy_until or appt.end_time > busy_until[pid]):
            busy_until[pid] = appt.end_time

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
            "is_busy": p.id in in_service_ids,
            "active_count_today": pending_count.get(p.id, 0),
            "busy_until_time": fmt_time(busy_until[p.id]) if p.id in busy_until else None,
            "effective_branch_id": p.effective_branch_id,
            "is_temp_assigned": p.is_temp_assigned,
            "temp_branch_id": p.temp_branch_id,
            "temp_branch_until": p.temp_branch_until.isoformat() if p.temp_branch_until else None,
            "temp_branch_name": p.temp_branch.name if p.temp_branch else None,
        }
        for p in professionals
    ]


# ==========================================
# Citas
# ==========================================
@router.get("/appointments", response_model=List[AppointmentResponse])
def get_appointments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    client_id: Optional[int] = Query(default=None, ge=1),
    professional_id: Optional[int] = Query(default=None, ge=1),
    service_id: Optional[int] = Query(default=None, ge=1),
    branch_id: Optional[int] = Query(default=None, ge=1),
    status_filter: Optional[str] = Query(default=None),
    ticket_code: Optional[str] = Query(default=None, description="Buscar por código de ticket"),
    client_name: Optional[str] = Query(default=None, description="Buscar por nombre o apellido del cliente"),
    search: Optional[str] = Query(default=None, description="Buscar por código O nombre de cliente"),
    start_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    is_ia: Optional[bool] = Query(default=None, description="Filtrar por tickets IA"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:view")),
):
    parsed_start = None
    parsed_end = None
    if start_date:
        parsed_start = datetime.fromisoformat(start_date).date()
    if end_date:
        parsed_end = datetime.fromisoformat(end_date).date()

    return list_appointments(
        db=db,
        skip=skip,
        limit=limit,
        client_id=client_id,
        professional_id=professional_id,
        service_id=service_id,
        branch_id=branch_id,
        status_filter=status_filter,
        ticket_code_search=ticket_code,
        client_name_search=client_name,
        search=search,
        start_date=parsed_start,
        end_date=parsed_end,
        is_ia=is_ia,
    )


@router.get("/appointments/mobile/available", response_model=List[AppointmentResponse])
def get_available_mobile_service_tickets(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    branch_id: Optional[int] = Query(default=None, ge=1),
    start_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    search: Optional[str] = Query(default=None, description="Buscar por codigo o cliente"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:view")),
):
    parsed_start = None
    parsed_end = None
    if start_date:
        parsed_start = datetime.fromisoformat(start_date).date()
    if end_date:
        parsed_end = datetime.fromisoformat(end_date).date()

    return list_mobile_available_appointments(
        db=db,
        skip=skip,
        limit=limit,
        branch_id=branch_id,
        start_date=parsed_start,
        end_date=parsed_end,
        search=search,
    )


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:view")),
):
    return get_appointment_by_id(db=db, appointment_id=appointment_id)


@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_new_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    return create_appointment(
        db=db,
        client_id=payload.client_id,
        created_by_id=current_user.id,
        professional_id=payload.professional_id,
        service_id=payload.service_id,
        service_ids=payload.service_ids,
        branch_id=payload.branch_id,
        sale_id=payload.sale_id,
        is_ia=payload.is_ia,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status_value=payload.status,
        advance_payment_amount=payload.advance_payment_amount,
    )


@router.post(
    "/appointments/call-next",
    response_model=AppointmentResponse,
)
def call_next_ticket(
    payload: CallNextAppointment,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    return call_next_appointment(
        db=db,
        branch_id=payload.branch_id,
        professional_id=payload.professional_id,
    )


@router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
def update_existing_appointment(
    appointment_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    return update_appointment(
        db=db,
        appointment_id=appointment_id,
        client_id=payload.client_id,
        professional_id=payload.professional_id,
        service_id=payload.service_id,
        service_ids=payload.service_ids,
        branch_id=payload.branch_id,
        is_ia=payload.is_ia,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status_value=payload.status,
        skip_availability_check=payload.skip_availability_check,
    )


@router.delete("/appointments/{appointment_id}", response_model=MessageResponse)
def delete_existing_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    delete_appointment(db=db, appointment_id=appointment_id)
    return MessageResponse(message="Cita eliminada correctamente")
