from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.models.user import User
from app.schemas.base_response import MessageResponse
from app.schemas.service_agenda import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    CallNextAppointment,
)
from app.services.service_agenda_service import (
    list_appointments,
    list_mobile_available_appointments,
    get_appointment_by_id,
    create_appointment,
    update_appointment,
    delete_appointment,
    call_next_appointment,
)


router = APIRouter(
    prefix="/agenda",
    tags=["Agenda"],
)


@router.get("/appointments", response_model=List[AppointmentResponse])
def get_appointments(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    client_id: Optional[int] = Query(default=None, ge=1),
    professional_id: Optional[int] = Query(default=None, ge=1),
    service_id: Optional[int] = Query(default=None, ge=1),
    branch_id: Optional[int] = Query(default=None, ge=1),
    status_filter: Optional[str] = Query(default=None),
    ticket_code: Optional[str] = Query(default=None, description="Buscar por codigo de ticket"),
    client_name: Optional[str] = Query(default=None, description="Buscar por nombre o apellido del cliente"),
    search: Optional[str] = Query(default=None, description="Buscar por codigo O nombre de cliente"),
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
    )


@router.delete("/appointments/{appointment_id}", response_model=MessageResponse)
def delete_existing_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("appointments:manage")),
):
    delete_appointment(db=db, appointment_id=appointment_id)
    return MessageResponse(message="Cita eliminada correctamente")
