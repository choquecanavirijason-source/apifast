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
from app.core.dependencies import get_db, require_permission
from app.domain.entities.client import Client
from app.domain.entities.user import User
from app.domain.entities.branch import Branch
from app.domain.entities.service_agenda import Appointment, Service
from app.domain.entities.tracking import Tracking
from app.application.services.service_agenda_service import create_appointment
from app.application.services.reminder_service import run_daily_reminder_check
from app.infrastructure.security.jwt import create_access_token

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

def _find_or_create_client(
    db: Session, email: str, name: str, phone: Optional[str], branch_id: int
) -> Client:
    ident = email.strip().lower()
    client = db.query(Client).filter(func.lower(Client.email) == ident).first()
    if client:
        # Cliente sin sucursal (ej. creado antes de este fix, o por otra vía sin
        # branch_id): el selector de clientes en Caja filtra por sucursal activa
        # (Client.branch_id == branch_id) y NULL nunca matchea — quedaba invisible
        # ahí para siempre. Se la asignamos con la de su primera reserva real.
        changed = False
        if client.branch_id is None:
            client.branch_id = branch_id
            changed = True
        # El teléfono viaja en cada reserva (viene de su perfil marketplace
        # actual) — si lo cambió después de crear la ficha del salón, esa
        # ficha quedaba con el dato viejo para siempre. Lo mantenemos al día.
        if phone and (client.phone or "").strip() != phone.strip():
            client.phone = phone
            changed = True
        if changed:
            db.commit()
            db.refresh(client)
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
        if client.branch_id is None:
            client.branch_id = branch_id
        if phone and (client.phone or "").strip() != phone.strip():
            client.phone = phone
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
        branch_id=branch_id,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


def _appointment_dict(a: Appointment, tracking: Optional[Tracking] = None) -> dict:
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
        # Recomendación de mantenimiento/retiro registrada al finalizar el
        # servicio (Tracking.appointment_id) — None si aún no se finalizó o
        # el diseño aplicado no tiene duración configurada en el catálogo.
        "next_maintenance_date": tracking.next_maintenance_date.isoformat()
        if tracking and tracking.next_maintenance_date
        else None,
        "next_removal_date": tracking.next_removal_date.isoformat()
        if tracking and tracking.next_removal_date
        else None,
        # Detalle de lo que se le hizo — lo carga la operaria al finalizar
        # (Queue.tsx). None si la cita todavía no se finalizó.
        "treatment_detail": {
            "eye_type": tracking.eye_type.name if tracking.eye_type else None,
            "effect": tracking.effect.name if tracking.effect else None,
            "volume": tracking.volume.name if tracking.volume else None,
            "lash_design": tracking.lash_design.name if tracking.lash_design else None,
            "notes": tracking.design_notes,
            "professional_name": tracking.professional.username if tracking.professional else None,
        }
        if tracking
        else None,
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

    client = _find_or_create_client(db, payload.email, payload.name, payload.phone, branch.id)

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

    appointment_ids = [a.id for a in appointments]
    trackings_by_appointment = {
        t.appointment_id: t
        for t in db.query(Tracking)
        .options(
            joinedload(Tracking.eye_type),
            joinedload(Tracking.effect),
            joinedload(Tracking.volume),
            joinedload(Tracking.lash_design),
            joinedload(Tracking.professional),
        )
        .filter(Tracking.appointment_id.in_(appointment_ids))
        .all()
    } if appointment_ids else {}

    return [_appointment_dict(a, trackings_by_appointment.get(a.id)) for a in appointments]


@router.get("/ws-ticket")
def get_ws_ticket(email: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """Token corto para que la app marketplace abra /ws/client/{client_id} y
    reciba en vivo el aviso de "servicio finalizado" mientras tiene la app
    abierta. 404 si la clienta todavía no tiene ficha en el salón (nunca
    reservó) — no hay nada que notificarle todavía."""
    ident = email.strip().lower()
    client = db.query(Client).filter(func.lower(Client.email) == ident).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    token = create_access_token(
        subject=f"client:{client.id}",
        expires_delta=timedelta(hours=12),
    )
    return {"client_id": client.id, "token": token}


@router.get("/pending-reminders")
def get_pending_reminders(email: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """Recordatorios de mantenimiento/retiro ya generados por el chequeo
    diario (ver reminder_service.py) para esta clienta. La app los pide al
    abrir/reanudar para no perderse los que llegaron mientras estaba
    cerrada — el WebSocket solo cubre el caso de que ya esté conectada
    cuando corre el chequeo. La app se encarga de no repetir la
    notificación local para un mismo id."""
    ident = email.strip().lower()
    client = db.query(Client).filter(func.lower(Client.email) == ident).first()
    if not client:
        return []

    trackings = (
        db.query(Tracking)
        .options(joinedload(Tracking.appointment).joinedload(Appointment.service))
        .filter(Tracking.client_id == client.id)
        .filter(
            (Tracking.maintenance_reminder_sent == True)
            | (Tracking.removal_reminder_sent == True)
        )
        .all()
    )

    reminders = []
    for t in trackings:
        service_name = t.appointment.service.name if t.appointment and t.appointment.service else None
        if t.maintenance_reminder_sent and t.next_maintenance_date:
            reminders.append({
                "id": f"{t.id}-maintenance",
                "tracking_id": t.id,
                "appointment_id": t.appointment_id,
                "type": "maintenance",
                "date": t.next_maintenance_date.isoformat(),
                "service_name": service_name,
            })
        if t.removal_reminder_sent and t.next_removal_date:
            reminders.append({
                "id": f"{t.id}-removal",
                "tracking_id": t.id,
                "appointment_id": t.appointment_id,
                "type": "removal",
                "date": t.next_removal_date.isoformat(),
                "service_name": service_name,
            })
    return reminders


@router.post("/run-reminder-check")
async def run_reminder_check_now(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tracking:manage")),
):
    """Dispara manualmente el chequeo diario de recordatorios (ver
    reminder_service.py) — solo para probar el aviso sin esperar al cron de
    las 9 AM. Corre dentro del proceso real del servidor (a diferencia de un
    script suelto de docker exec), así el broadcast por WebSocket sí llega a
    las conexiones abiertas de verdad."""
    from app.application.services.reminder_service import collect_due_reminders
    from app.core.ws_manager import client_ws_manager

    due = collect_due_reminders(db)
    for reminder in due:
        event = "maintenance_reminder" if reminder["type"] == "maintenance" else "removal_reminder"
        await client_ws_manager.broadcast(reminder["client_id"], {"event": event, **reminder})
    return {"due": due}
