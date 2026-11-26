"""Notificaciones: alertas de stock bajo por WhatsApp (por sucursal)."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import SUPER_ADMIN_ROLE, get_db, require_permission
from app.domain.entities.inventory import Batch, Product
from app.domain.entities.user import User
from app.domain.entities.branch import Branch
from app.application.services.branch_integration_service import get_whatsapp_config_for_branch
from app.application.services.inventory_service.min_stock import branch_min_map
from app.application.services.inventory_service.movements import _stock_alert_recipients
from app.application.services.whatsapp_service import normalize_phone_e164, send_whatsapp_text

router = APIRouter(prefix="/notifications", tags=["Notificaciones"])


def _build_low_stock_message(branch_name: str, low_stock: list[dict]) -> str:
    lines = [f"🔔 *ALERTA DE INVENTARIO — {branch_name}*\n"]
    lines.append("Los siguientes productos requieren reposicion:\n")
    for item in low_stock:
        if item["stock"] == 0:
            lines.append(f"❌ {item['name']} — *AGOTADO* (min {item['min_stock']:g})")
        else:
            faltan = item["min_stock"] - item["stock"]
            lines.append(
                f"⚠️ {item['name']} — Stock: {item['stock']:g} / Min: {item['min_stock']:g} "
                f"(faltan {faltan:g})"
            )
    lines.append("\nPor favor gestiona el pedido a la brevedad. ✅")
    return "\n".join(lines)


def _low_stock_by_branch(db: Session, only_branch_id: Optional[int]) -> dict[int, list[dict]]:
    """Productos bajo su minimo, agrupados por sucursal (cada sucursal con su propio stock y minimo)."""
    products = {p.id: p for p in db.query(Product).filter(Product.status.is_(True)).all()}
    rows = db.query(Batch.product_id, Batch.branch_id, func.coalesce(func.sum(Batch.current_quantity), 0.0)).group_by(
        Batch.product_id, Batch.branch_id
    )
    if only_branch_id is not None:
        rows = rows.filter(Batch.branch_id == only_branch_id)
    result: dict[int, list[dict]] = {}
    mins_cache: dict[int, dict[int, float]] = {}
    for product_id, branch_id, stock in rows.all():
        product = products.get(product_id)
        if product is None:
            continue
        mins = mins_cache.setdefault(branch_id, branch_min_map(db, branch_id))
        min_s = mins.get(product_id, float(product.min_stock or 0))
        if min_s > 0 and float(stock) <= min_s:
            result.setdefault(branch_id, []).append(
                {"name": product.name, "sku": product.sku, "stock": float(stock), "min_stock": float(min_s)}
            )
    return result


@router.post("/stock-alert")
async def send_stock_alert(
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    # El personal acotado solo dispara el aviso de su sucursal.
    if not (current_user.role and current_user.role.name in (SUPER_ADMIN_ROLE, "Admin", "Secretaria")):
        branch_id = current_user.effective_branch_id

    by_branch = _low_stock_by_branch(db, branch_id)
    if not by_branch:
        return {"sent": False, "detail": "No hay productos con stock bajo.", "recipients": []}

    results = []
    low_total = 0
    for b_id, items in by_branch.items():
        low_total += len(items)
        branch = db.query(Branch).filter(Branch.id == b_id).first()
        recipients = _stock_alert_recipients(db, b_id)
        wa_config = get_whatsapp_config_for_branch(db, b_id)
        message = _build_low_stock_message(branch.name if branch else f"Sucursal #{b_id}", items)
        for user in recipients:
            phone = normalize_phone_e164(user.phone)
            if not phone:
                continue
            result = await send_whatsapp_text(phone_e164=phone, message=message, branch_config=wa_config)
            results.append({"username": user.username, "phone": phone, "branch_id": b_id, **result})

    if not results:
        return {
            "sent": False,
            "detail": "No hay secretarias/admins con numero de telefono configurado.",
            "recipients": [],
            "low_stock_count": low_total,
        }

    all_sent = all(r.get("sent") for r in results)
    return {
        "sent": all_sent,
        "has_wa_me": any(r.get("wa_me_url") for r in results),
        "wa_me_url": next((r["wa_me_url"] for r in results if r.get("wa_me_url")), None),
        "low_stock_count": low_total,
        "recipients": results,
        "detail": "Enviado" if all_sent else "WhatsApp no configurado — usa el enlace wa.me",
    }
