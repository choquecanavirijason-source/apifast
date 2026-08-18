from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.client import Client
from app.domain.entities.user import User
from app.domain.entities.branch import Branch
from app.domain.entities.service_agenda import Appointment, AppointmentService, Service
from app.domain.entities.tracking import (
    Tracking,
    EyeType,
    Effect,
    Volume,
    LashDesign,
    Questionnaire,
)
from app.presentation.schemas.tracking import TrackingCreate, TrackingUpdate


def _tracking_query(db: Session):
    return (
        db.query(Tracking)
        .options(
            joinedload(Tracking.client),
            joinedload(Tracking.professional),
            joinedload(Tracking.eye_type),
            joinedload(Tracking.effect),
            joinedload(Tracking.volume),
            joinedload(Tracking.lash_design),
            joinedload(Tracking.questionnaire),
        )
    )


def _validate_tracking_relations(
    db: Session,
    client_id: int,
    appointment_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    professional_id: Optional[int] = None,
    eye_type_id: Optional[int] = None,
    effect_id: Optional[int] = None,
    volume_id: Optional[int] = None,
    lash_design_id: Optional[int] = None,
    questionnaire_id: Optional[int] = None,
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

    if appointment_id is not None:
        appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appointment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El ticket indicado no existe",
            )

    if branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sucursal indicada no existe",
            )

    if eye_type_id is not None:
        eye_type = db.query(EyeType).filter(EyeType.id == eye_type_id).first()
        if not eye_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El tipo de ojo indicado no existe",
            )

    if effect_id is not None:
        effect = db.query(Effect).filter(Effect.id == effect_id).first()
        if not effect:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El efecto indicado no existe",
            )

    if volume_id is not None:
        volume = db.query(Volume).filter(Volume.id == volume_id).first()
        if not volume:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El volumen indicado no existe",
            )

    if lash_design_id is not None:
        lash_design = db.query(LashDesign).filter(LashDesign.id == lash_design_id).first()
        if not lash_design:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El diseño de pestañas indicado no existe",
            )

    if questionnaire_id is not None:
        questionnaire = (
            db.query(Questionnaire)
            .filter(Questionnaire.id == questionnaire_id)
            .first()
        )
        if not questionnaire:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El cuestionario indicado no existe",
            )


def _resolve_service(db: Session, appointment_id: Optional[int]) -> Optional[Service]:
    """El servicio principal de la cita (single service_id, o el primero de la
    lista si la cita tiene varios servicios). None si la cita no existe o no
    tiene ningún servicio."""
    if not appointment_id:
        return None

    appointment = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.service).joinedload(Service.category),
            joinedload(Appointment.appointment_services)
            .joinedload(AppointmentService.service)
            .joinedload(Service.category),
        )
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appointment:
        return None

    service = appointment.service
    if not service:
        services = appointment.services
        service = services[0] if services else None

    return service


def _resolve_next_dates(
    db: Session,
    appointment_id: Optional[int],
    base_date: datetime,
) -> tuple[Optional[datetime], Optional[datetime]]:
    """Fechas de mantenimiento/retiro. Los días concretos viven en el
    Service (pueden variar entre servicios de la misma categoría, ej.
    "Extensiones Clásicas" vs "Volumen 5D"), pero solo cuentan si la
    categoría de ese servicio tiene has_maintenance/has_removal activado —
    solo algunas categorías lo necesitan (ej. Extensiones sí, Lifting no)."""
    service = _resolve_service(db, appointment_id)
    category = service.category if service else None
    if not service or not category:
        return None, None

    next_maintenance_date = (
        base_date + timedelta(days=service.maintenance_days)
        if category.has_maintenance and service.maintenance_days is not None
        else None
    )
    next_removal_date = (
        base_date + timedelta(days=service.removal_days)
        if category.has_removal and service.removal_days is not None
        else None
    )
    return next_maintenance_date, next_removal_date


def list_trackings(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    client_id: Optional[int] = None,
):
    query = _tracking_query(db)

    if client_id is not None:
        query = query.filter(Tracking.client_id == client_id)

    return (
        query.order_by(Tracking.last_application_date.desc(), Tracking.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_tracking_by_id(db: Session, tracking_id: int) -> Tracking:
    tracking = _tracking_query(db).filter(Tracking.id == tracking_id).first()

    if not tracking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seguimiento no encontrado",
        )

    return tracking


def get_latest_tracking_by_client(db: Session, client_id: int) -> Tracking:
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La clienta indicada no existe",
        )

    tracking = (
        _tracking_query(db)
        .filter(Tracking.client_id == client_id)
        .order_by(Tracking.last_application_date.desc(), Tracking.id.desc())
        .first()
    )

    if not tracking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La clienta no tiene seguimientos registrados",
        )

    return tracking


def create_tracking(
    db: Session,
    payload: TrackingCreate,
    current_user_id: Optional[int] = None,
) -> Tracking:
    professional_id = payload.professional_id or current_user_id

    _validate_tracking_relations(
        db=db,
        client_id=payload.client_id,
        appointment_id=payload.appointment_id,
        branch_id=payload.branch_id,
        professional_id=professional_id,
        eye_type_id=payload.eye_type_id,
        effect_id=payload.effect_id,
        volume_id=payload.volume_id,
        lash_design_id=payload.lash_design_id,
        questionnaire_id=payload.questionnaire_id,
    )

    base_date = payload.last_application_date or datetime.utcnow()
    next_maintenance_date, next_removal_date = _resolve_next_dates(
        db=db,
        appointment_id=payload.appointment_id,
        base_date=base_date,
    )

    tracking = Tracking(
        client_id=payload.client_id,
        appointment_id=payload.appointment_id,
        branch_id=payload.branch_id,
        professional_id=professional_id,
        eye_type_id=payload.eye_type_id,
        effect_id=payload.effect_id,
        volume_id=payload.volume_id,
        lash_design_id=payload.lash_design_id,
        questionnaire_id=payload.questionnaire_id,
        design_notes=payload.design_notes,
        last_application_date=base_date,
        questionnaire_responses=payload.questionnaire_responses,
        next_maintenance_date=next_maintenance_date,
        next_removal_date=next_removal_date,
    )

    db.add(tracking)
    db.commit()
    db.refresh(tracking)

    return get_tracking_by_id(db, tracking.id)


def update_tracking(
    db: Session,
    tracking_id: int,
    payload: TrackingUpdate,
) -> Tracking:
    tracking = db.query(Tracking).filter(Tracking.id == tracking_id).first()

    if not tracking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seguimiento no encontrado",
        )

    update_data = payload.model_dump(exclude_unset=True)

    client_id = tracking.client_id
    professional_id = update_data.get("professional_id", tracking.professional_id)
    appointment_id = update_data.get("appointment_id", tracking.appointment_id)
    branch_id = update_data.get("branch_id", tracking.branch_id)
    eye_type_id = update_data.get("eye_type_id", tracking.eye_type_id)
    effect_id = update_data.get("effect_id", tracking.effect_id)
    volume_id = update_data.get("volume_id", tracking.volume_id)
    lash_design_id = update_data.get("lash_design_id", tracking.lash_design_id)
    questionnaire_id = update_data.get("questionnaire_id", tracking.questionnaire_id)

    _validate_tracking_relations(
        db=db,
        client_id=client_id,
        appointment_id=appointment_id,
        branch_id=branch_id,
        professional_id=professional_id,
        eye_type_id=eye_type_id,
        effect_id=effect_id,
        volume_id=volume_id,
        lash_design_id=lash_design_id,
        questionnaire_id=questionnaire_id,
    )

    for field, value in update_data.items():
        setattr(tracking, field, value)

    # Recalcular fechas si cambió la cita asociada o la fecha de aplicación
    # (la categoría del servicio de la cita es la que decide el tiempo).
    if {"appointment_id", "last_application_date"} & update_data.keys():
        base_date = update_data.get("last_application_date", tracking.last_application_date)
        tracking.next_maintenance_date, tracking.next_removal_date = _resolve_next_dates(
            db=db,
            appointment_id=appointment_id,
            base_date=base_date,
        )

    db.commit()
    db.refresh(tracking)

    return get_tracking_by_id(db, tracking.id)


def delete_tracking(db: Session, tracking_id: int) -> None:
    tracking = db.query(Tracking).filter(Tracking.id == tracking_id).first()

    if not tracking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seguimiento no encontrado",
        )

    db.delete(tracking)
    db.commit()