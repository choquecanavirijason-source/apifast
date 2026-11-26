"""Casos de uso para Appointment (citas / tickets)."""
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.application.services.client_service import confirm_client_allergies, update_client_status
from app.application.services.tracking_service import resolve_service, sync_appointment_followup
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

# Sentinel para distinguir "no vino este campo en el PUT" (no tocar) de
# "vino explícitamente en null" (ej. quitar la operaria asignada). Con
# professional_id: Optional[int] = None como único valor por defecto, ambos
# casos se veían idénticos y quitar la operaria nunca se guardaba.
_UNSET = object()


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

    for r in valid_ranges:
        try:
            open_t = time.fromisoformat(r["open_time"])
            close_t = time.fromisoformat(r["close_time"])
        except (ValueError, KeyError):
            continue
        if open_t <= appt_start < close_t:
            return  # la cita arranca dentro del horario → válido

    hours_str = ", ".join(
        f"{r['open_time']}–{r['close_time']}"
        for r in valid_ranges
        if r.get("open_time") and r.get("close_time")
    )
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"La cita debe comenzar dentro del horario del salon ({hours_str})",
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

    # Solo bloquean el horario los tickets activos/reservados.
    # "completed", "cancelled", "finalizado", "atendido" ya liberaron el slot.
    query = db.query(Appointment).filter(
        Appointment.professional_id == professional_id,
        Appointment.status.in_(["pending", "confirmed", "in_service"]),
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

        if target_professional_id:
            existing_in_service = (
                db.query(Appointment)
                .filter(
                    Appointment.professional_id == target_professional_id,
                    Appointment.status == "in_service",
                    Appointment.id != appointment.id,
                )
                .first()
            )
            if existing_in_service:
                continue

        appointment.status = "in_service"
        if target_professional_id:
            appointment.professional_id = target_professional_id
        db.commit()
        update_client_status(db, appointment.client_id, CLIENT_STATUS_EN_SERVICIO)
        db.refresh(appointment)
        return get_appointment_by_id(db, appointment.id)

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="No hay tickets disponibles: la operaria ya tiene un servicio en curso o no hay turnos pendientes.",
    )


def confirm_appointment_allergies(db: Session, appointment_id: int, allergies: Optional[str]) -> Appointment:
    """Confirma las alergias antes de atender (None = "Sin alergias").

    Clienta registrada: se guardan en su ficha y valen para todas sus atenciones.
    Clienta de mostrador (compartida): solo en ESTE ticket; nada pasa a la ficha, que
    la usan muchas personas."""
    appointment = get_appointment_by_id(db=db, appointment_id=appointment_id)
    if appointment.client is not None and appointment.client.is_generic:
        appointment.allergies = allergies
        appointment.allergies_checked_at = datetime.now(timezone.utc)
        db.commit()
    else:
        confirm_client_allergies(db=db, client_id=appointment.client_id, allergies=allergies)
    return get_appointment_by_id(db=db, appointment_id=appointment_id)


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
    advance_payment_amount: float = 0.0,
    *,
    skip_availability_check: bool = False,
    source: str = "reserva",
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
        advance_payment_amount=max(0.0, float(advance_payment_amount)),
        source=source,
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


def split_appointment(db: Session, appointment_id: int, created_by_id: Optional[int] = None) -> List[Appointment]:
    """Separa un ticket con varios servicios en un ticket por servicio (misma venta, misma clienta).

    El primer servicio se queda en el ticket original; los demás pasan a tickets nuevos, uno detrás de otro
    desde la hora de inicio. La venta no cambia de monto: los servicios son los mismos."""
    appointment = get_appointment_by_id(db=db, appointment_id=appointment_id)
    if appointment.status not in ("pending", "confirmed", "waiting"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se puede separar un ticket que todavía no empezó (pendiente o en espera).",
        )
    links = sorted(appointment.appointment_services, key=lambda item: item.sort_order)
    service_ids = [item.service_id for item in links]
    if len(service_ids) < 2:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El ticket tiene un solo servicio.")

    durations = {
        s.id: max(15, int(s.duration_minutes or 60))
        for s in db.query(Service).filter(Service.id.in_(service_ids)).all()
    }
    start = appointment.start_time
    cursor = start + timedelta(minutes=durations.get(service_ids[0], 60))

    # Los tickets nuevos primero (mismo estado, origen y operaria), después se acorta el original.
    created: List[Appointment] = []
    for sid in service_ids[1:]:
        end = cursor + timedelta(minutes=durations.get(sid, 60))
        new = create_appointment(
            db=db,
            client_id=appointment.client_id,
            start_time=cursor,
            end_time=end,
            created_by_id=created_by_id,
            professional_id=appointment.professional_id,
            service_id=sid,
            branch_id=appointment.branch_id,
            sale_id=appointment.sale_id,
            is_ia=appointment.is_ia,
            status_value=appointment.status,
            skip_availability_check=True,
            source=appointment.source,
        )
        row = db.query(Appointment).filter(Appointment.id == new.id).first()
        row.arrived_at = appointment.arrived_at
        row.allergies = appointment.allergies
        row.allergies_checked_at = appointment.allergies_checked_at
        db.commit()
        created.append(row)
        cursor = end

    appointment.end_time = start + timedelta(minutes=durations.get(service_ids[0], 60))
    appointment.service_id = service_ids[0]
    appointment.appointment_services = [AppointmentService(appointment_id=appointment.id, service_id=service_ids[0], sort_order=0)]
    db.commit()
    return [get_appointment_by_id(db, a.id) for a in [appointment, *created]]


def merge_appointments(db: Session, appointment_id: int) -> Appointment:
    """Une en este ticket los demás tickets pendientes de la MISMA venta y clienta (operación inversa a separar).

    El ticket conserva su código y su operaria (o la del primer hermano que tenga). Los servicios se suman en
    orden de hora, la duración es la suma y empieza a la hora más temprana. Los hermanos se eliminan sin
    pasar por cancelación: la venta no cambia de monto. Solo tickets que no empezaron."""
    appointment = get_appointment_by_id(db=db, appointment_id=appointment_id)
    open_statuses = ("pending", "confirmed", "waiting")
    if appointment.status not in open_statuses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se puede unir un ticket que todavía no empezó (pendiente o en espera).",
        )
    if appointment.sale_id is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El ticket no pertenece a una venta con otros tickets.")
    siblings = (
        db.query(Appointment)
        .filter(
            Appointment.sale_id == appointment.sale_id,
            Appointment.client_id == appointment.client_id,
            Appointment.id != appointment.id,
            Appointment.status.in_(open_statuses),
            Appointment.is_ia.is_(False),
        )
        .order_by(Appointment.start_time.asc(), Appointment.id.asc())
        .all()
    )
    if not siblings:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No hay otros tickets pendientes de esta venta para unir.")

    group = sorted([appointment, *siblings], key=lambda a: (a.start_time, a.id))
    service_ids: List[int] = []
    for item in group:
        for link in sorted(item.appointment_services, key=lambda x: x.sort_order):
            if link.service_id not in service_ids:
                service_ids.append(link.service_id)
    durations = {
        s.id: max(15, int(s.duration_minutes or 60))
        for s in db.query(Service).filter(Service.id.in_(service_ids)).all()
    }
    start = group[0].start_time
    total = sum(durations.get(sid, 60) for sid in service_ids)

    if appointment.professional_id is None:
        appointment.professional_id = next((a.professional_id for a in siblings if a.professional_id), None)
    arrivals = [a.arrived_at for a in group if a.arrived_at is not None]
    appointment.arrived_at = min(arrivals) if arrivals else None
    if any(a.source == "reserva" for a in group):
        appointment.source = "reserva"
    appointment.advance_payment_amount = sum(float(a.advance_payment_amount or 0) for a in group)

    for sibling in siblings:
        # Los registros que apuntaban al hermano pasan al ticket que se queda.
        db.query(Tracking).filter(Tracking.appointment_id == sibling.id).update({"appointment_id": appointment.id})
        db.query(Payment).filter(Payment.appointment_id == sibling.id).update({"appointment_id": appointment.id})
        db.delete(sibling)
    db.flush()

    appointment.start_time = start
    appointment.end_time = start + timedelta(minutes=total)
    appointment.service_id = service_ids[0]
    appointment.appointment_services = [
        AppointmentService(appointment_id=appointment.id, service_id=sid, sort_order=index)
        for index, sid in enumerate(service_ids)
    ]
    db.commit()
    return get_appointment_by_id(db, appointment.id)


def mark_rescheduled(appointment: Appointment, new_start_time: datetime) -> None:
    """Actualiza scheduled_at si start_time cambia de verdad. Llamar ANTES de
    asignar start_time. El panel reenvía la misma hora al cambiar solo el estado
    o la operaria; eso no es reprogramar y no debe tocar el aviso "hoy"."""
    if new_start_time is None or appointment.start_time is None:
        return
    if new_start_time.replace(tzinfo=None) != appointment.start_time.replace(tzinfo=None):
        appointment.scheduled_at = datetime.utcnow()


def update_appointment(
    db: Session,
    appointment_id: int,
    client_id: Optional[int] = None,
    professional_id=_UNSET,
    service_id: Optional[int] = None,
    service_ids: Optional[List[int]] = None,
    branch_id: Optional[int] = None,
    sale_id: Optional[int] = None,
    is_ia: Optional[bool] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status_value: Optional[str] = None,
    *,
    skip_availability_check: bool = False,
    cancellation: Optional[dict] = None,
    arrived: Optional[bool] = None,
) -> Appointment:
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada",
        )

    # Un ticket en servicio o finalizado ya no se puede cancelar (regla del cliente).
    if status_value == "cancelled" and appointment.status != "cancelled":
        from app.application.services.pos_sale_service import assert_ticket_cancellable

        assert_ticket_cancellable(appointment)

    # Un ticket finalizado se queda finalizado (no vuelve a «En servicio» ni a «En espera»).
    if status_value is not None:
        from app.application.services.pos_sale_service import assert_ticket_status_change_allowed

        assert_ticket_status_change_allowed(appointment, status_value)

    # Para registrar bien una cancelación: el total de la venta ANTES de recalcularla.
    sale_total_before = float(appointment.sale.total or 0.0) if appointment.sale is not None else 0.0

    previous_status = appointment.status
    previous_service = resolve_service(db, appointment.id)
    previous_service_id = previous_service.id if previous_service else None

    final_client_id = client_id if client_id is not None else appointment.client_id
    final_professional_id = (
        appointment.professional_id if professional_id is _UNSET else professional_id
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
    # Estados terminales liberan el horario: completar/cancelar NO debe
    # re-validar horario de sucursal ni disponibilidad de la operaria. Si no,
    # una cita a hora atípica (p. ej. creada desde POS) o con choque de agenda
    # quedaría imposible de finalizar.
    _TERMINAL_STATUSES = {"completed", "cancelled", "finalizado", "atendido", "no_show", "done"}
    _skip_checks = skip_availability_check or (status_value in _TERMINAL_STATUSES)
    if not _skip_checks:
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
    # Un ticket que se programa para más adelante (ej. arrastrarlo a un hueco de la Agenda) pasa a ser reserva.
    from app.core.appointment_source import (
        IMMEDIATE_WINDOW_MINUTES, SOURCE_RESERVA, local_now, naive_clock,
    )

    if start_time is not None and naive_clock(final_start_time) > local_now() + timedelta(minutes=IMMEDIATE_WINDOW_MINUTES):
        appointment.source = SOURCE_RESERVA
        appointment.arrived_at = None
    mark_rescheduled(appointment, final_start_time)
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
        # Un servicio no arranca sin cobrar: la venta reservada se cobra antes (agenda, POS o Control de servicios).
        if status_value == "in_service" and previous_status != "in_service" and appointment.sale_id:
            unpaid_sale = (
                db.query(PosSale)
                .filter(PosSale.id == appointment.sale_id, PosSale.status == "reserved")
                .first()
            )
            if unpaid_sale:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="La venta de este ticket aún no está cobrada. Cóbrala antes de iniciar el servicio.",
                )
        if status_value == "in_service" and final_professional_id:
            today_start = datetime.combine(date.today(), time.min)
            conflict = (
                db.query(Appointment)
                .filter(
                    Appointment.professional_id == final_professional_id,
                    Appointment.status == "in_service",
                    Appointment.id != appointment_id,
                    Appointment.start_time >= today_start,
                )
                .first()
            )
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"La operaria ya tiene un servicio en curso "
                        f"(ticket #{conflict.id} · {conflict.ticket_code or ''}). "
                        f"Finaliza ese servicio antes de iniciar uno nuevo."
                    ),
                )
        appointment.status = status_value
        if status_value == "in_service":
            update_client_status(db, appointment.client_id, CLIENT_STATUS_EN_SERVICIO)
        elif status_value == "completed":
            update_client_status(db, appointment.client_id, CLIENT_STATUS_FINALIZADO)
        elif status_value == "cancelled":
            # Si el pago quedó vinculado directamente al ticket (poco común
            # hoy, pero posible en flujos antiguos), se cancela junto con él.
            (
                db.query(Payment)
                .filter(Payment.appointment_id == appointment.id, Payment.status == "paid")
                .update({"status": "cancelled"})
            )

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

    # Finalizar / cambiar servicio actualiza el seguimiento en la misma transacción.
    sync_appointment_followup(db, appointment, previous_status, previous_service_id)

    if arrived is not None:
        from datetime import datetime as _dt, timezone as _tz

        appointment.arrived_at = _dt.now(_tz.utc).replace(tzinfo=None) if arrived else None

    db.commit()
    db.refresh(appointment)

    if status_value == "cancelled" and appointment.sale_id is not None:
        # El pago de este ticket vive en la venta (PosSale.payments), no en
        # el ticket mismo — cancelar un ticket dentro de una venta con varios
        # servicios debe recalcular el total/pago excluyendo lo cancelado,
        # igual que ya hace update_sale() al editar una venta desde el POS.
        from app.application.services.pos_sale_service import update_sale as _recompute_sale_totals
        from app.presentation.schemas.pos_sale import PosSaleUpdate as _PosSaleUpdate

        _recompute_sale_totals(db=db, sale_id=appointment.sale_id, payload=_PosSaleUpdate())

    if status_value == "cancelled" and previous_status != "cancelled" and cancellation is not None:
        from app.application.services.pos_sale_service import finalize_ticket_cancellation

        finalize_ticket_cancellation(
            db=db,
            appointment_id=appointment.id,
            sale_total_before=sale_total_before,
            user=cancellation.get("user"),
            reason=cancellation["reason"],
            refund=cancellation.get("refund"),
        )

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
