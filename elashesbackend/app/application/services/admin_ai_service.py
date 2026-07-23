import base64
import json
import re
from datetime import date, datetime, timedelta
from typing import Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.application.services.admin_ai_tools import ADMIN_AI_TOOLS, execute_tool
from app.application.services.catalog_service import (
    list_effects,
    list_eye_types,
    list_lash_designs,
    list_volumes,
)
from app.domain.entities.admin_ai_settings import AdminAiSettings
from app.domain.entities.branch import Branch
from app.domain.entities.client import Client
from app.domain.entities.pos_sale import PosSale
from app.domain.entities.service_agenda import Appointment
from app.domain.entities.user import User

_MAX_TOOL_ROUNDS = 4


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


async def _call_chat_completions(
    *, url: str, token: str, model: str, messages: list, tools: Optional[list] = None
) -> dict:
    """Llama al endpoint OpenAI-compatible de chat y devuelve el `message`
    (dict) del primer `choice` — puede traer `content` y/o `tool_calls`.
    """
    payload: dict = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
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
    return choices[0].get("message") or {}


async def ask_admin_ai(db: Session, *, message: str, branch_id: Optional[int] = None) -> dict:
    """Chat de negocio con function calling real: además del resumen fijo
    (totales/estadísticas) en el contexto, la IA puede invocar las
    herramientas de [ADMIN_AI_TOOLS] (definidas en `admin_ai_tools.py`) para
    consultar listados concretos (clientes, citas, ventas) según la
    pregunta, en vez de estar limitada a los agregados del contexto.
    """
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
        "Responde en español, de forma clara y breve.\n\n"
        "Tenés dos fuentes de datos:\n"
        "1) El CONTEXTO DEL NEGOCIO de abajo: totales y estadísticas agregadas "
        "(NO tiene nombres ni listados individuales).\n"
        "2) Herramientas (list_clients, list_appointments, list_sales): "
        "úsalas cuando te pidan nombres, listas, o detalles puntuales de "
        "clientes, citas o ventas que no estén en el contexto agregado.\n\n"
        "No inventes cifras ni nombres que no vengan del contexto o de una "
        "herramienta. Si ni el contexto ni las herramientas tienen lo que "
        "piden, decilo.\n\n"
        f"CONTEXTO DEL NEGOCIO:\n{context_json}"
    )

    model = settings_row.ai_model or "gpt-4o-mini"
    url = _resolve_chat_url(settings_row.ai_api_url)
    token = settings_row.ai_api_token

    messages: list = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message.strip()},
    ]

    reply = ""
    for _ in range(_MAX_TOOL_ROUNDS):
        assistant_message = await _call_chat_completions(
            url=url, token=token, model=model, messages=messages, tools=ADMIN_AI_TOOLS
        )
        tool_calls = assistant_message.get("tool_calls") or []

        if not tool_calls:
            reply = (assistant_message.get("content") or "").strip()
            break

        # El mensaje del asistente con los tool_calls tiene que quedar en el
        # historial antes de las respuestas de las tools, si no la mayoría
        # de los proveedores OpenAI-compatible rechaza la siguiente llamada.
        messages.append(assistant_message)
        for call in tool_calls:
            function = call.get("function") or {}
            name = function.get("name") or ""
            try:
                arguments = json.loads(function.get("arguments") or "{}")
            except (TypeError, ValueError):
                arguments = {}
            result = execute_tool(db, name, arguments)
            messages.append({
                "role": "tool",
                "tool_call_id": call.get("id") or "",
                "content": json.dumps(result, ensure_ascii=False, default=str),
            })
    else:
        # Se agotaron las rondas de tool calling sin una respuesta final de
        # texto; se le pide una última vez sin tools para forzar un cierre.
        assistant_message = await _call_chat_completions(
            url=url, token=token, model=model, messages=messages
        )
        reply = (assistant_message.get("content") or "").strip()

    if not reply:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Respuesta vacía de la API de IA.",
        )

    return {
        "reply": reply,
        "model": model,
        "context_summary": {
            "branches_count": context["totals"]["branches_count"],
            "clients_total": context["totals"]["clients_total"],
            "appointments_30d": context["last_30_days"]["appointments"]["total"],
            "sales_30d_total": context["last_30_days"]["pos_sales_total"],
            "scope": context["scope"],
        },
    }


_LASH_VISION_SYSTEM_PROMPT = (
    "Sos una experta en aplicación de extensiones de pestañas (lash artist). "
    "Vas a recibir una foto tomada en vivo durante la aplicación. "
    "Da un consejo breve (máximo 2 frases, en español) sobre simetría, "
    "elevación o dirección del diseño. Si no se distingue bien el ojo en la "
    "foto, decilo y pedí que centre el rostro en cámara. No uses markdown."
)

_LASH_VISION_COMPARE_SYSTEM_PROMPT = (
    "Sos una experta en aplicación de extensiones de pestañas (lash artist). "
    "Vas a recibir dos fotos de la misma aplicación en curso: la primera es "
    "el estado 'antes' y la segunda es el estado 'después' de una corrección "
    "que acaba de hacer la operaria. Compará ambas y respondé en español, "
    "breve (máximo 2-3 frases): decí si mejoró o no, qué cambió concretamente "
    "(simetría, elevación, dirección, separación), y si todavía falta algo "
    "por corregir. Si alguna de las dos fotos no muestra bien el ojo, decilo. "
    "No uses markdown."
)


def _resolve_vision_settings(db: Session) -> tuple:
    """Valida que la IA esté configurada y devuelve `(model, url, token)`.
    Lanza `HTTPException` 400 si falta activar/configurar la IA.
    """
    settings_row = _get_or_create_settings(db)
    if not settings_row.ai_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Activa la IA en configuración antes de pedir una revisión.",
        )
    if not settings_row.ai_api_url or not settings_row.ai_api_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configura la URL y el token de la API de IA.",
        )
    model = settings_row.ai_model or "gpt-4o-mini"
    return model, _resolve_chat_url(settings_row.ai_api_url), settings_row.ai_api_token


async def _ask_vision_model(
    *, system_prompt: str, user_content: list, model: str, url: str, token: str
) -> str:
    """Llamada compartida al endpoint OpenAI-compatible de visión. Devuelve
    el texto de la respuesta (`content` del primer `choice`).
    """
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.4,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
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
    return reply.strip()


def _image_content(image_bytes: bytes) -> dict:
    b64_image = base64.b64encode(image_bytes).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"},
    }


async def ask_lash_ai_vision(db: Session, *, image_bytes: bytes) -> dict:
    """Envía una foto de la aplicación de pestañas en curso a la IA con visión
    configurada en [AdminAiSettings] (mismo endpoint OpenAI-compatible que
    [ask_admin_ai]) y devuelve un consejo breve en texto natural.
    """
    model, url, token = _resolve_vision_settings(db)
    reply = await _ask_vision_model(
        system_prompt=_LASH_VISION_SYSTEM_PROMPT,
        user_content=[
            {"type": "text", "text": "Analiza esta aplicación de pestañas en curso."},
            _image_content(image_bytes),
        ],
        model=model,
        url=url,
        token=token,
    )
    return {"feedback": reply, "model": model}


def _parse_json_loose(text: str) -> dict:
    """Intenta parsear `text` como JSON; si la IA agregó texto extra
    alrededor (a pesar de que se le pidió que no lo haga), busca el primer
    bloque `{...}` y lo parsea. Devuelve `{}` si no se pudo extraer nada.
    """
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            pass
    return {}


_LASH_RECOMMENDATION_SYSTEM_PROMPT_TEMPLATE = (
    "Sos una experta en pestañas postizas de un salón de belleza. Vas a "
    "recibir una foto del ojo de una clienta. Analizá la forma del ojo y "
    "recomendá, EXCLUSIVAMENTE de las listas de catálogo de abajo, el "
    "diseño, efecto y volumen que mejor le quedan.\n\n"
    "Respondé SOLO un objeto JSON válido (sin markdown, sin texto extra "
    "antes o después) con esta forma exacta:\n"
    '{{"eye_shape": "<forma de ojo detectada, breve>", '
    '"reason": "<explicación breve, máx. 2-3 frases, en español>", '
    '"recommended_design": "<nombre EXACTO de la lista de diseños, o null>", '
    '"recommended_effect": "<nombre EXACTO de la lista de efectos, o null>", '
    '"recommended_volume": "<nombre EXACTO de la lista de volúmenes, o null>"}}\n\n'
    "Los nombres recomendados tienen que copiarse tal cual aparecen en las "
    "listas (no traduzcas, no inventes nombres nuevos). Si no se distingue "
    "bien el ojo en la foto, decilo en 'reason' y dejá los demás campos en "
    "null.\n\n"
    "CATÁLOGO DISPONIBLE:\n"
    "Diseños: {designs}\n"
    "Efectos: {effects}\n"
    "Volúmenes: {volumes}\n"
    "Tipos de ojo: {eye_types}"
)


async def ask_lash_ai_recommendation(db: Session, *, image_bytes: bytes) -> dict:
    """Analiza la foto del ojo de una clienta y recomienda, del catálogo real
    del salón, el diseño/efecto/volumen que mejor le queda. A diferencia de
    [LashRecommender] (heurística on-device por geometría de landmarks), acá
    es la IA con visión la que mira la foto y elige.
    """
    model, url, token = _resolve_vision_settings(db)

    designs = [d.name for d in list_lash_designs(db, limit=100)]
    effects = [e.name for e in list_effects(db, limit=100)]
    volumes = [v.name for v in list_volumes(db, limit=100)]
    eye_types = [t.name for t in list_eye_types(db, limit=100)]

    system_prompt = _LASH_RECOMMENDATION_SYSTEM_PROMPT_TEMPLATE.format(
        designs=", ".join(designs) or "(sin datos)",
        effects=", ".join(effects) or "(sin datos)",
        volumes=", ".join(volumes) or "(sin datos)",
        eye_types=", ".join(eye_types) or "(sin datos)",
    )

    reply = await _ask_vision_model(
        system_prompt=system_prompt,
        user_content=[
            {"type": "text", "text": "Recomendá el mejor diseño para este ojo."},
            _image_content(image_bytes),
        ],
        model=model,
        url=url,
        token=token,
    )

    parsed = _parse_json_loose(reply)
    return {
        "reason": (parsed.get("reason") or reply).strip(),
        "eye_shape": parsed.get("eye_shape"),
        "recommended_design": parsed.get("recommended_design"),
        "recommended_effect": parsed.get("recommended_effect"),
        "recommended_volume": parsed.get("recommended_volume"),
        "model": model,
    }


async def ask_lash_ai_compare(
    db: Session, *, before_bytes: bytes, after_bytes: bytes
) -> dict:
    """Compara dos fotos (antes/después de una corrección) de la misma
    aplicación de pestañas y devuelve si mejoró y qué cambió, en texto
    natural. Mismo endpoint/config que [ask_lash_ai_vision].
    """
    model, url, token = _resolve_vision_settings(db)
    reply = await _ask_vision_model(
        system_prompt=_LASH_VISION_COMPARE_SYSTEM_PROMPT,
        user_content=[
            {"type": "text", "text": "Foto 'antes':"},
            _image_content(before_bytes),
            {"type": "text", "text": "Foto 'después':"},
            _image_content(after_bytes),
        ],
        model=model,
        url=url,
        token=token,
    )
    return {"feedback": reply, "model": model}
