from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.client import (
    Client,
    CLIENT_STATUS_EN_ESPERA,
    CLIENT_STATUS_EN_SERVICIO,
    CLIENT_STATUS_FINALIZADO,
    CLIENT_STATUS_PAGADO,
)
from app.models.branch import Branch
from app.models.tracking import EyeType
from app.schemas.client import ClientCreate, ClientUpdate


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

    return query.order_by(Client.id.desc()).offset(skip).limit(limit).all()


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

    # Validación simple para evitar duplicados muy obvios
    existing = (
        db.query(Client)
        .filter(
            Client.name == payload.name,
            Client.last_name == payload.last_name,
            Client.phone == payload.phone,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un cliente con esos datos",
        )

    now = datetime.now(timezone.utc)
    client = Client(
        name=payload.name,
        last_name=payload.last_name,
        age=payload.age,
        phone=payload.phone,
        branch_id=payload.branch_id,
        eye_type_id=payload.eye_type_id,
        status=CLIENT_STATUS_EN_ESPERA,
        last_activity_at=now,
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

    db.delete(client)
    db.commit()