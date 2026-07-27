"""
Endpoints INTERNOS de reserva de citas para el marketplace.
Llamados exclusivamente por backend_marketplace (server-to-server),
igual que /clients/verify-salon-login. No exponen datos sensibles y
las citas creadas quedan en estado 'pending' hasta que el salón confirme.
"""
import os
from datetime import datetime, date, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.countries import COUNTRY_CODE_TO_NAME
from app.core.dependencies import get_db
from app.domain.entities.client import Client
from app.domain.entities.branch import Branch
from app.domain.entities.service_agenda import Appointment, Service
from app.application.services.service_agenda_service import create_appointment

router = APIRouter(prefix="/booking-public", tags=["Reservas Marketplace"])

# Horario por defecto cuando la sucursal no tiene opening_hours configurado
_OPEN_HOUR = int(os.getenv("BOOKING_OPEN_HOUR", "9"))
_CLOSE_HOUR = int(os.getenv("BOOKING_CLOSE_HOUR", "19"))
_SLOT_MINUTES = int(os.getenv("BOOKING_SLOT_MINUTES", "30"))
# Citas simultáneas máximas por sucursal (n° de estaciones de trabajo)
_MAX_CONCURRENT = int(os.getenv("BOOKING_MAX_CONCURRENT", "2"))

_ACTIVE_STATUSES = ("pending", "confirmed", "in_service")


# ── Schemas ───────────────────────────────────────────────────────────────────

class _BookingPayload(BaseModel):
    email: str
    name: str
    phone: Optional[str] = None
    service_id: Optional[int] = None          # compat: un solo servicio
    service_ids: Optional[list[int]] = None   # varios servicios en una cita
    branch_id: int
    start_iso: str  # "2026-07-10T10:30:00"
    notes: Optional[str] = None

    def all_service_ids(self) -> list[int]:
        ids = list(self.service_ids or [])
        if self.service_id and self.service_id not in ids:
            ids.insert(0, self.service_id)
        return ids


# ── Helpers ───────────────────────────────────────────────────────────────────

def _find_or_create_client(db: Session, email: str, name: str, phone: Optional[str]) -> Client:
    ident = email.strip().lower()
    client = db.query(Client).filter(func.lower(Client.email) == ident).first()
    if client:
        return client
    # Buscar por nombre completo (clientes del salón que entraron por nombre+CI,
    # sin cuenta de email propia todavía).
    full_name = func.lower(func.trim(Client.name + " " + func.coalesce(Client.last_name, "")))
    client = db.query(Client).filter(full_name == func.lower(name.strip())).first()
    if client:
        # Si la ficha del salón no tenía este email (o tenía uno distinto),
        # lo actualizamos: si no, sus citas nunca aparecerían en "Mis Citas"
        # de la app, que busca por email exacto.
        if "@" in email and (client.email or "").strip().lower() != ident:
            client.email = email
            db.commit()
            db.refresh(client)
        return client
    # Cliente del app: crear ficha en el salón
    parts = name.strip().split(" ", 1)
    client = Client(
        name=parts[0] or name,
        last_name=parts[1] if len(parts) > 1 else "",
        email=email if "@" in email else None,
        phone=phone,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def _appointment_dict(a: Appointment) -> dict:
    # Nombres de todos los servicios de la cita (multi-servicio)
    names = [s.name for s in a.services if s] or ([a.service.name] if a.service else [])
    return {
        "id": a.id,
        "ticket_code": a.ticket_code,
        "service_id": a.service_id,
        "service_name": " + ".join(names) if names else None,
        "service_names": names,
        "branch_id": a.branch_id,
        "branch_name": a.branch.name if a.branch else None,
        "start_time": a.start_time.isoformat() if a.start_time else None,
        "end_time": a.end_time.isoformat() if a.end_time else None,
        "status": a.status,
        "advance_payment_amount": a.advance_payment_amount,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/services")
def list_bookable_services(db: Session = Depends(get_db)):
    services = db.query(Service).order_by(Service.name).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "image_url": s.image_url,
            "duration_minutes": s.duration_minutes,
            "price": s.price,
            "category": s.category.name if s.category else None,
        }
        for s in services
    ]


@router.get("/branches")
def list_branches(country_code: str | None = Query(default=None), db: Session = Depends(get_db)):
    query = db.query(Branch)
    if country_code:
        query = query.filter(Branch.country_code == country_code.strip().upper())
    branches = query.order_by(Branch.id).all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "address": b.address,
            "city": b.city,
            "country_code": b.country_code,
            # Se deriva del código (fuente confiable) y no de `department`
            # directamente — `department` puede desincronizarse si se edita
            # después sin pasar por el selector de país del admin.
            "country_name": COUNTRY_CODE_TO_NAME.get(b.country_code),
            "maps_url": b.maps_url,
            "qr_image_url": b.qr_image_url,
        }
        for b in branches
    ]


@router.get("/availability")
def get_availability(
    day: str = Query(..., description="Fecha YYYY-MM-DD"),
    service_ids: str = Query(..., description="IDs separados por coma, ej. 1,4"),
    branch_id: int = Query(...),
    db: Session = Depends(get_db),
):
    try:
        target = date.fromisoformat(day)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha inválida, usa YYYY-MM-DD")

    try:
        ids = [int(x) for x in service_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="service_ids inválido")
    if not ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos un servicio")

    services = db.query(Service).filter(Service.id.in_(ids)).all()
    if len(services) != len(set(ids)):
        raise HTTPException(status_code=404, detail="Algún servicio no existe")

    total_minutes = sum(s.duration_minutes for s in services)
    duration = timedelta(minutes=total_minutes)
    day_start = datetime.combine(target, time(_OPEN_HOUR, 0))
    day_end = datetime.combine(target, time(_CLOSE_HOUR, 0))

    # Citas activas de esa sucursal que tocan el día
    existing = (
        db.query(Appointment)
        .filter(
            Appointment.branch_id == branch_id,
            Appointment.status.in_(_ACTIVE_STATUSES),
            Appointment.start_time < day_end + duration,
            Appointment.end_time > day_start,
        )
        .all()
    )

    now = datetime.now()
    slots = []
    cursor = day_start
    while cursor + duration <= day_end:
        slot_end = cursor + duration
        overlapping = sum(
            1 for a in existing if a.start_time < slot_end and a.end_time > cursor
        )
        is_past = cursor <= now
        slots.append({
            "time": cursor.strftime("%H:%M"),
            "start_iso": cursor.isoformat(),
            "available": (not is_past) and overlapping < _MAX_CONCURRENT,
        })
        cursor += timedelta(minutes=_SLOT_MINUTES)

    return {
        "date": day,
        "service_ids": ids,
        "duration_minutes": total_minutes,
        "slots": slots,
    }


@router.post("/appointments", status_code=201)
def create_marketplace_booking(payload: _BookingPayload, db: Session = Depends(get_db)):
    ids = payload.all_service_ids()
    if not ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos un servicio")
    services = db.query(Service).filter(Service.id.in_(ids)).all()
    if len(services) != len(set(ids)):
        raise HTTPException(status_code=404, detail="Algún servicio no existe")
    branch = db.query(Branch).filter(Branch.id == payload.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    try:
        start = datetime.fromisoformat(payload.start_iso)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha/hora inválida")
    if start <= datetime.now():
        raise HTTPException(status_code=400, detail="La cita debe ser en el futuro")

    total_minutes = sum(s.duration_minutes for s in services)
    end = start + timedelta(minutes=total_minutes)

    # Revalidar disponibilidad del slot (podría haberse ocupado)
    overlapping = (
        db.query(Appointment)
        .filter(
            Appointment.branch_id == payload.branch_id,
            Appointment.status.in_(_ACTIVE_STATUSES),
            Appointment.start_time < end,
            Appointment.end_time > start,
        )
        .count()
    )
    if overlapping >= _MAX_CONCURRENT:
        raise HTTPException(
            status_code=409,
            detail="Ese horario acaba de ocuparse. Elige otro horario.",
        )

    client = _find_or_create_client(db, payload.email, payload.name, payload.phone)

    appointment = create_appointment(
        db=db,
        client_id=client.id,
        start_time=start,
        end_time=end,
        service_id=ids[0],
        service_ids=ids,
        branch_id=branch.id,
        status_value="pending",
    )
    return _appointment_dict(
        db.query(Appointment)
        .options(joinedload(Appointment.service), joinedload(Appointment.branch))
        .filter(Appointment.id == appointment.id)
        .first()
    )


@router.get("/my-appointments")
def my_appointments(
    email: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    ident = email.strip().lower()
    client = db.query(Client).filter(func.lower(Client.email) == ident).first()
    if not client:
        return []
    appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.service), joinedload(Appointment.branch))
        .filter(Appointment.client_id == client.id)
        .order_by(Appointment.start_time.desc())
        .limit(50)
        .all()
    )
    return [_appointment_dict(a) for a in appointments]
