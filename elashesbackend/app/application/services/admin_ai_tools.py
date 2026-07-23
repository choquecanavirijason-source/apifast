"""Herramientas (function calling) que el chat de IA de negocio puede invocar
para responder preguntas que no caben en el resumen fijo de
`build_business_context` (listados con nombres, filtros puntuales, etc.).

Todas son de solo lectura, acotadas a un máximo de filas, y devuelven dicts
livianos armados a mano — nunca entidades ORM crudas (tienen relaciones
cargadas en cascada que no son JSON-serializables y podrían filtrar datos
sensibles como contraseñas hasheadas).
"""
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.application.services.client_service import list_clients
from app.application.services.pos_sale_service import list_sales
from app.application.services.service_agenda_service import list_appointments

_MAX_ROWS = 50


def _client_name(client) -> Optional[str]:
    if client is None:
        return None
    return f"{client.name} {client.last_name}".strip()


def _serialize_client(c) -> dict:
    return {
        "id": c.id,
        "name": _client_name(c),
        "phone": c.phone,
        "email": c.email,
        "branch": c.branch.name if c.branch else None,
        "marketplace_enabled": bool(c.marketplace_enabled),
        "status": c.status,
    }


def _serialize_appointment(a) -> dict:
    return {
        "id": a.id,
        "ticket_code": a.ticket_code,
        "client": _client_name(a.client),
        "professional": a.professional.username if a.professional else None,
        "service": a.service.name if a.service else None,
        "branch": a.branch.name if a.branch else None,
        "start_time": a.start_time.isoformat() if a.start_time else None,
        "status": a.status,
    }


def _serialize_sale(s) -> dict:
    return {
        "id": s.id,
        "sale_code": s.sale_code,
        "client": _client_name(s.client),
        "branch": s.branch.name if s.branch else None,
        "total": s.total,
        "payment_method": s.payment_method,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value)).date()
    except ValueError:
        return None


def _tool_list_clients(db: Session, args: dict) -> Any:
    limit = min(int(args.get("limit") or 20), _MAX_ROWS)
    marketplace_only = bool(args.get("marketplace_only"))
    # `list_clients` no filtra por marketplace_enabled a nivel de query, así
    # que se trae un lote más grande y se filtra acá; con bases de clientes
    # muy grandes esto puede no ser exhaustivo (tope de 200 filas leídas).
    fetch_limit = 200 if marketplace_only else limit
    clients = list_clients(
        db=db,
        skip=0,
        limit=fetch_limit,
        search=(args.get("search") or None),
        branch_id=args.get("branch_id"),
    )
    if marketplace_only:
        clients = [c for c in clients if c.marketplace_enabled]
    return [_serialize_client(c) for c in clients[:limit]]


def _tool_list_appointments(db: Session, args: dict) -> Any:
    limit = min(int(args.get("limit") or 20), _MAX_ROWS)
    appointments = list_appointments(
        db=db,
        skip=0,
        limit=limit,
        branch_id=args.get("branch_id"),
        status_filter=args.get("status"),
        start_date=_parse_date(args.get("start_date")),
        end_date=_parse_date(args.get("end_date")),
    )
    return [_serialize_appointment(a) for a in appointments]


def _tool_list_sales(db: Session, args: dict) -> Any:
    limit = min(int(args.get("limit") or 20), _MAX_ROWS)
    branch_id = args.get("branch_id")
    # `list_sales` no filtra por sucursal; se trae un lote más grande cuando
    # hace falta filtrar y se recorta después.
    sales = list_sales(db=db, skip=0, limit=200 if branch_id else limit)
    if branch_id:
        sales = [s for s in sales if s.branch_id == branch_id]
    return [_serialize_sale(s) for s in sales[:limit]]


TOOL_DISPATCH = {
    "list_clients": _tool_list_clients,
    "list_appointments": _tool_list_appointments,
    "list_sales": _tool_list_sales,
}


ADMIN_AI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_clients",
            "description": (
                "Lista clientes registrados con nombre, teléfono, sucursal y si "
                "tienen acceso al marketplace. Usar cuando pidan nombres o "
                "listas de clientes — el resumen general solo trae el total, "
                "nunca nombres."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {
                        "type": "string",
                        "description": "Nombre, apellido o teléfono a buscar (opcional).",
                    },
                    "branch_id": {
                        "type": "integer",
                        "description": "Filtrar por sucursal (opcional).",
                    },
                    "marketplace_only": {
                        "type": "boolean",
                        "description": "Si es true, solo clientes con acceso al marketplace.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": f"Máximo de resultados (por defecto 20, tope {_MAX_ROWS}).",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_appointments",
            "description": (
                "Lista citas/turnos con cliente, profesional, servicio, "
                "sucursal, fecha y estado."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Fecha desde, formato YYYY-MM-DD (opcional).",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "Fecha hasta, formato YYYY-MM-DD (opcional).",
                    },
                    "status": {
                        "type": "string",
                        "description": "Estado: pending, completed o cancelled (opcional).",
                    },
                    "branch_id": {
                        "type": "integer",
                        "description": "Filtrar por sucursal (opcional).",
                    },
                    "limit": {
                        "type": "integer",
                        "description": f"Máximo de resultados (por defecto 20, tope {_MAX_ROWS}).",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_sales",
            "description": (
                "Lista ventas del punto de venta (POS) con cliente, sucursal, "
                "total, método de pago y fecha, más recientes primero."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "branch_id": {
                        "type": "integer",
                        "description": "Filtrar por sucursal (opcional).",
                    },
                    "limit": {
                        "type": "integer",
                        "description": f"Máximo de resultados (por defecto 20, tope {_MAX_ROWS}).",
                    },
                },
            },
        },
    },
]


def execute_tool(db: Session, name: str, arguments: dict) -> Any:
    """Ejecuta la tool `name` con `arguments` y devuelve un valor
    JSON-serializable. Nunca deja pasar una excepción cruda: si algo falla,
    devuelve un dict con `error` para que la IA pueda explicarlo en la
    respuesta en vez de que la request entera se caiga.
    """
    handler = TOOL_DISPATCH.get(name)
    if handler is None:
        return {"error": f"Herramienta desconocida: {name}"}
    try:
        return handler(db, arguments or {})
    except Exception as e:  # noqa: BLE001 - se reporta el fallo como dato, no se propaga
        return {"error": f"No se pudo ejecutar {name}: {e}"}
