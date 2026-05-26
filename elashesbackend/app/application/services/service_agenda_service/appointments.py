"""Casos de uso para Appointment (citas / tickets)."""
from datetime import date, datetime, time
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.application.services.client_service import update_client_status
from app.domain.entities.branch import Branch
from app.domain.entities.client import (
    CLIENT_STATUS_EN_ESPERA,
    CLIENT_STATUS_EN_SERVICIO,
    CLIENT_STATUS_FINALIZADO,
    CLIENT_STATUS_RESERVA,
    Client,
)
from app.domain.entities.payment import Payment
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.service_agenda import (
    Appointment,
    AppointmentService,
    Service,
)
from app.domain.entities.tracking import Tracking
from app.domain.entities.user import User


def _appointment_query(db: Session):
    return db.query(Appointment).options(
        joinedload(Appointment.client),
        joinedload(Appointment.created_by),
        joinedload(Appointment.professional),
        joinedload(Appointment.service).joinedload(Service.category),
        joinedload(Appointment.appointment_services).joinedload(AppointmentService.service).joinedload(Service.category),
        joinedload(Appointment.branch),
        joinedload(Appointment.sale),
    )


def _appointment_has_mobile_service(appointment: Appointment) -> bool:
    primary_mobile = bool(
        appointment.service and appointment.service.category and appointment.service.category.is_mobile
    )
    if primary_mobile:
        return True

    for link in appointment.appointment_services or []:
        service = link.service
        if service and service.category and service.category.is_mobile:
            return True

    return False


def _validate_appointment_relations(
    db: Session,
    client_id: int,
    professional_id: Optional[int],
    service_id: Optional[int],
    service_ids: Optional[List[int]],
    branch_id: Optional[int],
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La clienta indicada no existe",
        )

    if professional_id is not None:
        professional = db.query(User).filter(User.id == professional_id).first()
        if not professional:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La profesional indicada no existe",
            )

    service_ids_to_check: List[int] = []
    if service_id is not None:
        service_ids_to_check.append(service_id)
    if service_ids:
        service_ids_to_check.extend([int(value) for value in service_ids if value is not None])
    for candidate_id in list(dict.fromkeys(service_ids_to_check)):
        service = db.query(Service).filter(Service.id == candidate_id).first()
        if not service:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El servicio indicado no existe",
            )

    if branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sucursal indicada no existe",
            )


def _validate_appointment_times(start_time: datetime, end_time: datetime):
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La hora de fin debe ser mayor a la hora de inicio",
        )


_WEEKDAY_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


def _validate_branch_opening_hours(
    db: Session,
    branch_id: Optional[int],
    start_time: datetime,
    end_time: datetime,
):
    if branch_id is None:
        return

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch or not branch.opening_hours:
        return  # sin horario definido → sin restricción

    day_name = _WEEKDAY_ES[start_time.weekday()]
    day_schedule = next(
        (d for d in branch.opening_hours if isinstance(d, dict) and d.get("day") == day_name),
        None,
    )

    if day_schedule is None:
        return  # día no configurado → sin restricción

    valid_ranges = [
        r for r in day_schedule.get("ranges", [])
        if r.get("open_time") and r.get("close_time")
    ]

    if not valid_ranges:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El salon está cerrado los {day_name}",
        )

    appt_start = start_time.time()
    appt_end = end_time.time()

    for r in valid_ranges:
        try:
            open_t = time.fromisoformat(r["open_time"])
            close_t = time.fromisoformat(r["close_time"])
        except (ValueError, KeyError):
            continue
        if appt_start >= open_t and appt_end <= close_t:
            return  # dentro del rango → válido

    hours_str = ", ".join(
        f"{r['open_time']}–{r['close_time']}"
        for r in valid_ranges
        if r.get("open_time") and r.get("close_time")
    )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"La cita debe estar dentro del horario del salon ({hours_str})",
    )


def _validate_professional_availability(
    db: Session,
    professional_id: Optional[int],
    start_time: datetime,
    end_time: datetime,
    exclude_appointment_id: Optional[int] = None,
):
    if professional_id is None:
        return

    query = db.query(Appointment).filter(
        Appointment.professional_id == professional_id,
        Appointment.status.in_(["pending", "confirmed", "completed", "in_service"]),
        and_(
            Appointment.start_time < end_time,
            Appointment.end_time > start_time,
        ),
    )

    if exclude_appointment_id is not None:
        query = query.filter(Appointment.id != exclude_appointment_id)

    overlapping = query.first()
    if overlapping:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La profesional ya tiene una cita en ese horario",
        )


def _generate_ticket_code(db: Session, branch_id: Optional[int] = None) -> str:
    # B{branch_id}-YYYYMMDD-XXXX  o  TKT-YYYYMMDD-XXXX
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"B{branch_id}-{today}-" if branch_id is not None else f"TKT-{today}-"
    last = (
        db.query(Appointment)
        .filter(Appointment.ticket_code.like(f"{prefix}%"))
        .order_by(Appointment.id.desc())
        .first()
    )
    if last and last.ticket_code:
        try:
            num = int(last.ticket_code.split("-")[-1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1
    return f"{prefix}{num:04d}"


def list_appointments(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    client_id: Optional[int] = None,
    professional_id: Optional[int] = None,
    service_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    ticket_code_search: Optional[str] = None,
    client_name_search: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    is_ia: Optional[bool] = None,
):
    query = _appointment_query(db)

    if client_id is not None:
        query = query.filter(Appointment.client_id == client_id)

    if professional_id is not None:
        query = query.filter(Appointment.professional_id == professional_id)

    if service_id is not None:
        query = query.outerjoin(AppointmentService).filter(
            or_(Appointment.service_id == service_id, AppointmentService.service_id == service_id)
        )
        query = query.distinct(Appointment.id)

    if branch_id is not None:
        query = query.filter(Appointment.branch_id == branch_id)

    if is_ia is not None:
        query = query.filter(Appointment.is_ia.is_(is_ia))

    if status_filter:
        query = query.filter(Appointment.status == status_filter)

    if start_date is not None:
        start_dt = datetime.combine(start_date, time.min)
        query = query.filter(Appointment.start_time >= start_dt)

    if end_date is not None:
        end_dt = datetime.combine(end_date, time.max)
        query = query.filter(Appointment.start_time <= end_dt)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.join(Appointment.client).filter(
            or_(
                Appointment.ticket_code.ilike(term),
                Client.name.ilike(term),
                Client.last_name.ilike(term),
            )
        )
    else:
        if ticket_code_search and ticket_code_search.strip():
            search_term = f"%{ticket_code_search.strip()}%"
            query = query.filter(Appointment.ticket_code.ilike(search_term))

        if client_name_search and client_name_search.strip():
            term = f"%{client_name_search.strip()}%"
            query = query.join(Appointment.client).filter(
                or_(
                    Client.name.ilike(term),
                    Client.last_name.ilike(term),
                )
            )

    return (
        query.order_by(Appointment.start_time.desc(), Appointment.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def list_mobile_available_appointments(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    branch_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
):
    available_statuses = {"pending", "confirmed", "waiting"}

    appointments = list_appointments(
        db=db,
        skip=skip,
        limit=limit,
        branch_id=branch_id,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )

    return [
        appointment
        for appointment in appointments
        if appointment.status in available_statuses and _appointment_has_mobile_service(appointment)
    ]


def call_next_appointment(
    db: Session,
    branch_id: int,
    professional_id: Optional[int] = None,
) -> Appointment:
    query = (
        _appointment_query(db)
        .filter(
            Appointment.branch_id == branch_id,
            Appointment.status.in_(["pending", "confirmed"]),
        )
        .order_by(Appointment.start_time.asc(), Appointment.id.asc())
    )

    candidates = query.all()
    for appointment in candidates:
        target_professional_id = professional_id or appointment.professional_id
        if target_professional_id is None:
            fallback = (
                db.query(User)
                .filter(User.is_active.is_(True), User.branch_id == branch_id)
                .order_by(User.username.asc(), User.id.asc())
                .first()
            )
            target_professional_id = fallback.id if fallback else None
        try:
            _validate_professional_availability(
                db=db,
                professional_id=target_professional_id,
                start_time=appointment.start_time,
                end_time=appointment.end_time,
                exclude_appointment_id=appointment.id,
            )
        except HTTPException:
            continue

        appointment.status = "in_service"
        if target_professional_id:
            appointment.professional_id = target_professional_id
        db.commit()
        update_client_status(db, appointment.client_id, CLIENT_STATUS_EN_SERVICIO)
        db.refresh(appointment)
        return get_appointment_by_id(db, appointment.id)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No hay tickets disponibles para llamar",
    )


def get_appointment_by_id(db: Session, appointment_id: int) -> Appointment:
    appointment = (
        _appointment_query(db)
        .filter(Appointment.id == appointment_id)
        .first()
    )

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada",
        )

    return appointment


def create_appointment(
    db: Session,
    client_id: int,
    start_time: datetime,
    end_time: datetime,
    created_by_id: Optional[int] = None,
    professional_id: Optional[int] = None,
    service_id: Optional[int] = None,
    service_ids: Optional[List[int]] = None,
    branch_id: Optional[int] = None,
    sale_id: Optional[int] = None,
    is_ia: bool = False,
    status_value: str = "pending",
    *,
    skip_availability_check: bool = False,
) -> Appointment:
    _validate_appointment_relations(
        db=db,
        client_id=client_id,
        professional_id=professional_id,
        service_id=service_id,
        service_ids=service_ids,
        branch_id=branch_id,
    )
    _validate_appointment_times(start_time, end_time)
    _validate_branch_opening_hours(db=db, branch_id=branch_id, start_time=start_time, end_time=end_time)
    if not skip_availability_check:
        _validate_professional_availability(
            db=db,
            professional_id=professional_id,
            start_time=start_time,
            end_time=end_time,
        )

    primary_service_id = service_id
    if primary_service_id is None and service_ids:
        primary_service_id = service_ids[0]
    ticket_code = _generate_ticket_code(db, branch_id=branch_id)

    appointment = Appointment(
        ticket_code=ticket_code,
        client_id=client_id,
        created_by_id=created_by_id,
        professional_id=professional_id,
        service_id=primary_service_id,
        branch_id=branch_id,
        sale_id=sale_id,
        is_ia=is_ia,
        start_time=start_time,
        end_time=end_time,
        status=status_value,
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    appt_date = start_time.date() if hasattr(start_time, "date") else start_time
    today = date.today()
    if appt_date > today:
        update_client_status(db, client_id, CLIENT_STATUS_RESERVA)
    else:
        update_client_status(db, client_id, CLIENT_STATUS_EN_ESPERA)

    assigned_ids: List[int] = []
    if service_ids:
        assigned_ids = [int(value) for value in service_ids if value is not None]
    elif primary_service_id is not None:
        assigned_ids = [primary_service_id]

    unique_ids = list(dict.fromkeys(assigned_ids))
    if unique_ids:
        appointment.appointment_services = [
            AppointmentService(appointment_id=appointment.id, service_id=service_id, sort_order=index)
            for index, service_id in enumerate(unique_ids)
        ]
        db.commit()
        db.refresh(appointment)

    return get_appointment_by_id(db, appointment.id)


def update_appointment(
    db: Session,
    appointment_id: int,
    client_id: Optional[int] = None,
    professional_id: Optional[int] = None,
    service_id: Optional[int] = None,
    service_ids: Optional[List[int]] = None,
    branch_id: Optional[int] = None,
    sale_id: Optional[int] = None,
    is_ia: Optional[bool] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status_value: Optional[str] = None,
) -> Appointment:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada",
        )

    final_client_id = client_id if client_id is not None else appointment.client_id
    final_professional_id = (
        professional_id if professional_id is not None else appointment.professional_id
    )
    final_service_id = service_id if service_id is not None else appointment.service_id
    final_branch_id = branch_id if branch_id is not None else appointment.branch_id
    final_start_time = start_time if start_time is not None else appointment.start_time
    final_end_time = end_time if end_time is not None else appointment.end_time

    _validate_appointment_relations(
        db=db,
        client_id=final_client_id,
        professional_id=final_professional_id,
        service_id=final_service_id,
        service_ids=service_ids,
        branch_id=final_branch_id,
    )
    _validate_appointment_times(final_start_time, final_end_time)
    _validate_branch_opening_hours(db=db, branch_id=final_branch_id, start_time=final_start_time, end_time=final_end_time)
    _validate_professional_availability(
        db=db,
        professional_id=final_professional_id,
        start_time=final_start_time,
        end_time=final_end_time,
        exclude_appointment_id=appointment_id,
    )

    appointment.client_id = final_client_id
    appointment.professional_id = final_professional_id
    appointment.service_id = final_service_id
    appointment.branch_id = final_branch_id
    if is_ia is not None:
        appointment.is_ia = is_ia
    appointment.start_time = final_start_time
    appointment.end_time = final_end_time

    if sale_id is not None:
        sale_row = db.query(PosSale).filter(PosSale.id == sale_id).first()
        if not sale_row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La venta indicada no existe",
            )
        appointment.sale_id = sale_id

    if status_value is not None:
        appointment.status = status_value
        if status_value == "in_service":
            update_client_status(db, appointment.client_id, CLIENT_STATUS_EN_SERVICIO)
        elif status_value == "completed":
            update_client_status(db, appointment.client_id, CLIENT_STATUS_FINALIZADO)

    if service_ids is not None:
        normalized = [int(value) for value in service_ids if value is not None]
        unique_ids = list(dict.fromkeys(normalized))
        appointment.appointment_services = [
            AppointmentService(appointment_id=appointment.id, service_id=service_id, sort_order=index)
            for index, service_id in enumerate(unique_ids)
        ]
    elif service_id is not None:
        appointment.appointment_services = [
            AppointmentService(appointment_id=appointment.id, service_id=service_id, sort_order=0)
        ]

    db.commit()
    db.refresh(appointment)

    return get_appointment_by_id(db, appointment.id)


def delete_appointment(db: Session, appointment_id: int) -> None:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada",
        )

    # Nullify FK references before deleting (FK enforcement is ON)
    db.query(Tracking).filter(Tracking.appointment_id == appointment_id).update({"appointment_id": None})
    db.query(Payment).filter(Payment.appointment_id == appointment_id).update({"appointment_id": None})

    db.delete(appointment)
    db.commit()
