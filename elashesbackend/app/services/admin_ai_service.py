import json
from datetime import date, datetime, timedelta
from typing import Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.admin_ai_settings import AdminAiSettings
from app.models.branch import Branch
from app.models.client import Client
from app.models.pos_sale import PosSale
from app.models.service_agenda import Appointment
from app.models.user import User


def _get_or_create_settings(db: Session) -> AdminAiSettings:
    row = db.query(AdminAiSettings).filter(AdminAiSettings.id == 1).first()
    if row:
        return row
    row = AdminAiSettings(id=1)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_admin_ai_settings(db: Session) -> dict:
    row = _get_or_create_settings(db)
    return {
        "ai_enabled": bool(row.ai_enabled),
        "ai_api_url": row.ai_api_url,
        "ai_model": row.ai_model or "gpt-4o-mini",
        "ai_has_token": bool(row.ai_api_token),
    }


def update_admin_ai_settings(db: Session, payload: dict) -> dict:
    row = _get_or_create_settings(db)
    if payload.get("ai_enabled") is not None:
        row.ai_enabled = payload["ai_enabled"]
    if payload.get("ai_api_url") is not None:
        row.ai_api_url = payload["ai_api_url"].strip() if payload["ai_api_url"] else None
    if payload.get("ai_model") is not None:
        row.ai_model = (payload["ai_model"] or "gpt-4o-mini").strip()
    if payload.get("ai_api_token"):
        row.ai_api_token = payload["ai_api_token"]
    db.commit()
    db.refresh(row)
    return get_admin_ai_settings(db=db)


def _appointment_stats(db: Session, start_at: datetime, end_at: datetime, branch_id: Optional[int]) -> dict:
    query = db.query(
        func.count(Appointment.id).label("total"),
        func.sum(case((Appointment.status == "pending", 1), else_=0)).label("pending"),
        func.sum(case((Appointment.status == "waiting", 1), else_=0)).label("waiting"),
        func.sum(case((Appointment.status == "confirmed", 1), else_=0)).label("confirmed"),
        func.sum(case((Appointment.status == "completed", 1), else_=0)).label("completed"),
        func.sum(case((Appointment.status == "cancelled", 1), else_=0)).label("cancelled"),
    ).filter(Appointment.start_time >= start_at, Appointment.start_time <= end_at)
    if branch_id is not None:
        query = query.filter(Appointment.branch_id == branch_id)
    row = query.one()
    return {
        "total": int(row.total or 0),
        "pending": int(row.pending or 0),
        "waiting": int(row.waiting or 0),
        "confirmed": int(row.confirmed or 0),
        "completed": int(row.completed or 0),
        "cancelled": int(row.cancelled or 0),
    }


def build_business_context(db: Session, branch_id: Optional[int] = None) -> dict:
    today = date.today()
    start_30 = datetime.combine(today - timedelta(days=30), datetime.min.time())
    end_today = datetime.combine(today, datetime.max.time())
    start_today = datetime.combine(today, datetime.min.time())

    branches = db.query(Branch).order_by(Branch.name.asc()).all()
    branch_list = [{"id": b.id, "name": b.name, "city": b.city, "department": b.department} for b in branches]

    scope_name = None
    if branch_id is not None:
        scope_name = db.query(Branch.name).filter(Branch.id == branch_id).scalar()

    clients_total = db.query(func.count(Client.id)).scalar() or 0
    users_active = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0

    sales_query = db.query(
        func.count(PosSale.id).label("count"),
        func.coalesce(func.sum(PosSale.total), 0).label("total"),
    ).filter(PosSale.created_at >= start_30, PosSale.created_at <= end_today)
    if branch_id is not None:
        sales_query = sales_query.filter(PosSale.branch_id == branch_id)
    sales_row = sales_query.one()

    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "scope": {"branch_id": branch_id, "branch_name": scope_name},
        "branches": branch_list,
        "totals": {
            "branches_count": len(branch_list),
            "clients_total": int(clients_total),
            "active_users": int(users_active),
        },
        "last_30_days": {
            "appointments": _appointment_stats(db, start_30, end_today, branch_id),
            "pos_sales_count": int(sales_row.count or 0),
            "pos_sales_total": float(sales_row.total or 0),
        },
        "today": {
            "date": today.isoformat(),
            "appointments": _appointment_stats(db, start_today, end_today, branch_id),
        },
    }


def _resolve_chat_url(base_url: str) -> str:
    trimmed = base_url.rstrip("/")
    if trimmed.endswith("/chat/completions"):
        return trimmed
    if trimmed.endswith("/v1"):
        return f"{trimmed}/chat/completions"
    return f"{trimmed}/v1/chat/completions"


async def ask_admin_ai(db: Session, *, message: str, branch_id: Optional[int] = None) -> dict:
    settings_row = _get_or_create_settings(db)
    if not settings_row.ai_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Activa la IA en configuración antes de consultar.",
        )
    if not settings_row.ai_api_url or not settings_row.ai_api_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configura la URL y el token de la API de IA.",
        )

    context = build_business_context(db=db, branch_id=branch_id)
    context_json = json.dumps(context, ensure_ascii=False, indent=2)

    system_prompt = (
        "Eres un asistente de negocio para Elashes (salones de pestañas). "
        "Responde en español, de forma clara y breve. "
        "Usa SOLO los datos del contexto JSON para responder; si no hay información suficiente, dilo. "
        "No inventes cifras ni nombres.\n\n"
        f"CONTEXTO DEL NEGOCIO:\n{context_json}"
    )

    model = settings_row.ai_model or "gpt-4o-mini"
    url = _resolve_chat_url(settings_row.ai_api_url)
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message.strip()},
        ],
        "temperature": 0.3,
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings_row.ai_api_token}",
                "Content-Type": "application/json",
            },
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Error de la API de IA: {response.text[:400]}",
        )

    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="La API de IA no devolvió una respuesta.",
        )

    reply = (choices[0].get("message") or {}).get("content") or ""
    if not reply.strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Respuesta vacía de la API de IA.",
        )

    return {
        "reply": reply.strip(),
        "model": model,
        "context_summary": {
            "branches_count": context["totals"]["branches_count"],
            "clients_total": context["totals"]["clients_total"],
            "appointments_30d": context["last_30_days"]["appointments"]["total"],
            "sales_30d_total": context["last_30_days"]["pos_sales_total"],
            "scope": context["scope"],
        },
    }
