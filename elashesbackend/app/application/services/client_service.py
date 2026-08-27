from datetime import datetime, timezone
from typing import Iterable, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.client import (
    Client,
    CLIENT_STATUS_EN_ESPERA,
    CLIENT_STATUS_EN_SERVICIO,
    CLIENT_STATUS_FINALIZADO,
    CLIENT_STATUS_PAGADO,
    CLIENT_STATUS_SIN_ESTADO,
)
from app.domain.entities.branch import Branch
from app.domain.entities.service_agenda import Appointment
from app.domain.entities.tracking import EyeType
from app.presentation.schemas.client import ClientCreate, ClientUpdate


def _attach_visit_counts(db: Session, clients: Iterable[Client]) -> None:
    """Cuenta las citas completadas ("visitas" reales) por clienta y las
    asigna como atributo en memoria — no es una columna, se calcula al
    vuelo para no requerir migración ni mantener un contador duplicado."""
    client_ids = [c.id for c in clients]
    if not client_ids:
        return

    counts = dict(
        db.query(Appointment.client_id, func.count(Appointment.id))
        .filter(Appointment.client_id.in_(client_ids), Appointment.status == "completed")
        .group_by(Appointment.client_id)
        .all()
    )

    for client in clients:
        client.visit_count = counts.get(client.id, 0)


# Marca al cliente "Mostrador" generado automáticamente cuando se vende sin
# elegir clienta — permite ubicarlo y protegerlo de un borrado accidental.
GENERIC_CLIENT_CI = "SISTEMA-MOSTRADOR"


def get_or_create_generic_client(db: Session, branch_id: Optional[int]) -> Client:
    """Cliente 'Mostrador' de la sucursal — se usa cuando se registra una
    venta sin elegir clienta, para no frenar el servicio. Uno por sucursal
    (y uno global si no hay sucursal), creado la primera vez que hace falta."""
    existing = (
        db.query(Client)
        .filter(Client.ci == GENERIC_CLIENT_CI, Client.branch_id == branch_id)
        .first()
    )
    if existing:
        return existing

    branch_name = None
    if branch_id:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        branch_name = branch.name if branch else None

    generic = Client(
        name="Cliente",
        last_name=f"Mostrador — {branch_name}" if branch_name else "Mostrador",
        branch_id=branch_id,
        ci=GENERIC_CLIENT_CI,
        status=CLIENT_STATUS_SIN_ESTADO,
        marketplace_enabled=False,
    )
    db.add(generic)
    db.commit()
    db.refresh(generic)
    return generic


def _validate_age(age: Optional[int]) -> None:
    if age is None:
        return

    if age < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La edad no puede ser 0",
        )

    if age > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La edad no puede ser mayor a 100",
        )


def _find_client_duplicate(
    db: Session,
    name: str,
    last_name: str,
    phone: Optional[str],
    branch_id: Optional[int],
    exclude_client_id: Optional[int] = None,
) -> Optional[Client]:
    """Un cliente se considera duplicado solo dentro de la misma sucursal."""
    query = db.query(Client).filter(
        Client.name == name,
        Client.last_name == last_name,
    )

    if phone is not None:
        query = query.filter(Client.phone == phone)
    else:
        query = query.filter(Client.phone.is_(None))

    if branch_id is not None:
        query = query.filter(Client.branch_id == branch_id)
    else:
        query = query.filter(Client.branch_id.is_(None))

    if exclude_client_id is not None:
        query = query.filter(Client.id != exclude_client_id)

    return query.first()


def list_clients(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    branch_id: Optional[int] = None,
):
    query = db.query(Client).options(joinedload(Client.eye_type), joinedload(Client.branch))

    if branch_id is not None:
        query = query.filter(Client.branch_id == branch_id)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Client.name.ilike(search_term),
                Client.last_name.ilike(search_term),
                Client.phone.ilike(search_term),
            )
        )

    clients = query.order_by(Client.id.desc()).offset(skip).limit(limit).all()
    _attach_visit_counts(db, clients)
    return clients


def update_client_status(
    db: Session,
    client_id: int,
    status: str,
) -> None:
    """Actualiza el status del cliente y last_activity_at."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        return
    client.status = status
    client.last_activity_at = datetime.now(timezone.utc)
    db.commit()


def get_client_by_id(db: Session, client_id: int) -> Client:
    client = (
        db.query(Client)
        .options(joinedload(Client.eye_type), joinedload(Client.branch))
        .filter(Client.id == client_id)
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    _attach_visit_counts(db, [client])
    return client


def create_client(db: Session, payload: ClientCreate) -> Client:
    _validate_age(payload.age)

    if payload.branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sucursal indicada no existe",
            )

    if payload.eye_type_id is not None:
        eye_type = db.query(EyeType).filter(EyeType.id == payload.eye_type_id).first()
        if not eye_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El tipo de ojo indicado no existe",
            )

    existing = _find_client_duplicate(
        db,
        name=payload.name,
        last_name=payload.last_name,
        phone=payload.phone,
        branch_id=payload.branch_id,
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un cliente con esos datos en esta sucursal",
        )

    now = datetime.now(timezone.utc)
    client = Client(
        name=payload.name,
        last_name=payload.last_name,
        age=payload.age,
        phone=payload.phone,
        email=payload.email,
        branch_id=payload.branch_id,
        eye_type_id=payload.eye_type_id,
        status=CLIENT_STATUS_SIN_ESTADO,
        last_activity_at=now,
        ci=payload.ci,
    )

    db.add(client)
    db.commit()
    db.refresh(client)

    return get_client_by_id(db, client.id)


def update_client(db: Session, client_id: int, payload: ClientUpdate) -> Client:
    client = db.query(Client).filter(Client.id == client_id).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "age" in update_data:
        _validate_age(update_data.get("age"))

    if "eye_type_id" in update_data and update_data["eye_type_id"] is not None:
        eye_type = db.query(EyeType).filter(EyeType.id == update_data["eye_type_id"]).first()
        if not eye_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El tipo de ojo indicado no existe",
            )

    if "branch_id" in update_data and update_data["branch_id"] is not None:
        branch = db.query(Branch).filter(Branch.id == update_data["branch_id"]).first()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sucursal indicada no existe",
            )

    identity_fields = {"name", "last_name", "phone", "branch_id"}
    if identity_fields.intersection(update_data.keys()):
        final_name = update_data.get("name", client.name)
        final_last_name = update_data.get("last_name", client.last_name)
        final_phone = update_data["phone"] if "phone" in update_data else client.phone
        final_branch_id = (
            update_data["branch_id"] if "branch_id" in update_data else client.branch_id
        )
        existing = _find_client_duplicate(
            db,
            name=final_name,
            last_name=final_last_name,
            phone=final_phone,
            branch_id=final_branch_id,
            exclude_client_id=client_id,
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un cliente con esos datos en esta sucursal",
            )

    for field, value in update_data.items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)

    return get_client_by_id(db, client.id)


def delete_client(db: Session, client_id: int) -> None:
    client = db.query(Client).filter(Client.id == client_id).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )

    if client.ci == GENERIC_CLIENT_CI:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar el cliente Mostrador — lo usa el sistema para ventas sin clienta.",
        )

    db.delete(client)
    db.commit()