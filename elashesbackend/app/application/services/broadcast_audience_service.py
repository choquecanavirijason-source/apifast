"""
Grupos de clientas de los comunicados (Notificaciones > Comunicados).

Cada grupo se puede acotar a una sucursal (la de la clienta). Las promociones
y novedades excluyen a quienes apagaron sus notificaciones en el panel.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session, joinedload

from app.application.services.appointment_notice_service import FINAL_STATUSES, LA_PAZ
from app.application.services.push_service import active_devices_query
from app.application.services.retoque_service import retouch_due_client_ids
from app.domain.entities.broadcast import (
    AUDIENCE_INACTIVE,
    AUDIENCE_RETOUCH_DUE,
    AUDIENCE_SELECTED,
    AUDIENCE_UPCOMING_APPOINTMENT,
    MARKETING_KINDS,
)
from app.domain.entities.client import Client
from app.domain.entities.client_device import ClientDevice
from app.domain.entities.service_agenda import Appointment

DEFAULT_AUDIENCE_DAYS = 30
# Una cita así no cuenta como visita para "sin visitar en N días".
NOT_VISITED_STATUSES = ("cancelled", "cancelado", "no_show")


@dataclass(frozen=True)
class AudienceSpec:
    audience: str
    kind: str
    branch_id: Optional[int] = None
    # Ventana del grupo: próximos N días (citas, retoques) o últimos N (inactivas).
    days: Optional[int] = None
    # Solo para AUDIENCE_SELECTED: las clientas elegidas en el panel.
    client_ids: tuple[int, ...] = ()


@dataclass(frozen=True)
class AudienceSummary:
    clients: int
    with_push: int
    with_email: int


def has_email():
    return func.trim(func.coalesce(Client.email, "")) != ""


def _has_appointment(*conditions):
    return exists().where(Appointment.client_id == Client.id, *conditions)


def audience_client_ids(db: Session, spec: AudienceSpec, now_utc: Optional[datetime] = None) -> list[int]:
    """Ids de las clientas del grupo, ordenados."""
    now_utc = now_utc or datetime.now(timezone.utc)
    now_local = now_utc.astimezone(LA_PAZ).replace(tzinfo=None)  # como start_time
    days = spec.days or DEFAULT_AUDIENCE_DAYS

    query = db.query(Client.id)
    if spec.branch_id is not None:
        query = query.filter(Client.branch_id == spec.branch_id)
    if spec.kind in MARKETING_KINDS:
        query = query.filter(Client.notificaciones_activas.is_(True))
    if spec.audience == AUDIENCE_SELECTED:
        query = query.filter(Client.id.in_(spec.client_ids))
    elif spec.audience == AUDIENCE_UPCOMING_APPOINTMENT:
        query = query.filter(_has_appointment(
            Appointment.status.notin_(FINAL_STATUSES),
            Appointment.start_time > now_local,
            Appointment.start_time <= now_local + timedelta(days=days),
        ))
    elif spec.audience == AUDIENCE_INACTIVE:
        # Ni visitas en los últimos N días ni citas a futuro.
        query = query.filter(~_has_appointment(
            Appointment.status.notin_(NOT_VISITED_STATUSES),
            Appointment.start_time >= now_local - timedelta(days=days),
        ))

    client_ids = [client_id for (client_id,) in query.order_by(Client.id)]
    if spec.audience == AUDIENCE_RETOUCH_DUE:
        due = retouch_due_client_ids(db, days, spec.branch_id, now_utc)
        client_ids = [client_id for client_id in client_ids if client_id in due]
    return client_ids


def summarize_audience(db: Session, client_ids: list[int]) -> AudienceSummary:
    """Cuántas pueden recibirlo por cada canal. Se cruza en memoria (no con un
    IN de miles de ids) contra quienes tienen app con push y correo."""
    targets = set(client_ids)
    with_push = {client_id for (client_id,) in active_devices_query(db).with_entities(ClientDevice.client_id)}
    with_email = {client_id for (client_id,) in db.query(Client.id).filter(has_email())}
    return AudienceSummary(
        clients=len(targets),
        with_push=len(targets & with_push),
        with_email=len(targets & with_email),
    )


@dataclass(frozen=True)
class RecipientCandidate:
    """Una clienta en el buscador de "Clientas específicas"."""

    id: int
    name: str
    branch_name: Optional[str]
    has_app: bool
    has_email: bool
    notificaciones_activas: bool


def search_recipients(
    db: Session, search: str, branch_id: Optional[int] = None, limit: int = 20
) -> list[RecipientCandidate]:
    """Clientas por nombre, apellido, teléfono, correo o CI, con lo que el
    panel necesita para saber si le llegará el comunicado."""
    term = f"%{search.strip()}%"
    # "+" en columnas String: || en SQLite/Postgres, CONCAT en MySQL.
    full_name = Client.name + " " + Client.last_name
    query = (
        db.query(Client)
        .options(joinedload(Client.branch))
        .filter(or_(
            full_name.ilike(term), Client.phone.ilike(term), Client.email.ilike(term), Client.ci.ilike(term),
        ))
    )
    if branch_id is not None:
        query = query.filter(Client.branch_id == branch_id)
    clients = query.order_by(Client.name, Client.last_name).limit(limit).all()

    ids = [client.id for client in clients]
    with_app = {
        client_id
        for (client_id,) in active_devices_query(db)
        .filter(ClientDevice.client_id.in_(ids))
        .with_entities(ClientDevice.client_id)
    }
    return [
        RecipientCandidate(
            id=client.id,
            name=f"{client.name} {client.last_name}".strip(),
            branch_name=client.branch.name if client.branch else None,
            has_app=client.id in with_app,
            has_email=bool((client.email or "").strip()),
            notificaciones_activas=client.notificaciones_activas,
        )
        for client in clients
    ]
