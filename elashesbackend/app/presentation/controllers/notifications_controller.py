"""Notificaciones: alertas de stock bajo por WhatsApp."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.domain.entities.inventory import Batch, Product
from app.domain.entities.user import Role, User
from app.domain.entities.branch import Branch
from app.application.services.branch_integration_service import get_whatsapp_config_for_branch
from app.application.services.whatsapp_service import normalize_phone_e164, send_whatsapp_text

router = APIRouter(prefix="/notifications", tags=["Notificaciones"])


def _build_low_stock_message(low_stock: list[dict]) -> str:
    lines = ["🔔 *ALERTA DE INVENTARIO — New Elashes*\n"]
    lines.append("Los siguientes productos requieren reposición urgente:\n")
    for item in low_stock:
        if item["stock"] == 0:
            lines.append(f"❌ {item['name']} — *AGOTADO* (mín {item['min_stock']})")
        else:
            faltan = item["min_stock"] - item["stock"]
            lines.append(
                f"⚠️ {item['name']} — Stock: {item['stock']} / Mín: {item['min_stock']} "
                f"(faltan {faltan})"
            )
    lines.append("\nPor favor gestiona el pedido a la brevedad. ✅")
    return "\n".join(lines)


@router.post("/stock-alert")
async def send_stock_alert(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    # 1. Detectar productos con stock bajo
    products = db.query(Product).filter(Product.status.is_(True)).all()
    low_stock = []
    for p in products:
        total = sum(b.current_quantity for b in db.query(Batch).filter(Batch.product_id == p.id).all())
        min_s = p.min_stock or 0
        if total <= min_s:
            low_stock.append({"name": p.name, "sku": p.sku, "stock": total, "min_stock": min_s})

    if not low_stock:
        return {"sent": False, "detail": "No hay productos con stock bajo.", "recipients": []}

    # 2. Obtener secretarias/admins con teléfono
    secretaria_role = db.query(Role).filter(Role.name.in_(["Secretaria", "Admin", "SuperAdmin"])).all()
    role_ids = [r.id for r in secretaria_role]
    recipients_users = (
        db.query(User)
        .filter(User.role_id.in_(role_ids), User.is_active.is_(True), User.phone.isnot(None))
        .all()
    )

    if not recipients_users:
        return {
            "sent": False,
            "detail": "No hay secretarias/admins con número de teléfono configurado.",
            "recipients": [],
        }

    # 3. Obtener config WhatsApp de la primera sucursal activa
    branch = db.query(Branch).first()
    wa_config = get_whatsapp_config_for_branch(db, branch.id if branch else None)

    # 4. Construir mensaje
    message = _build_low_stock_message(low_stock)

    # 5. Enviar a cada destinatario
    results = []
    for user in recipients_users:
        phone = normalize_phone_e164(user.phone)
        if not phone:
            continue
        result = await send_whatsapp_text(
            phone_e164=phone,
            message=message,
            branch_config=wa_config,
        )
        results.append({
            "username": user.username,
            "phone": phone,
            **result,
        })

    all_sent = all(r.get("sent") for r in results)
    has_wa_me = any(r.get("wa_me_url") for r in results)

    return {
        "sent": all_sent,
        "has_wa_me": has_wa_me,
        "wa_me_url": next((r["wa_me_url"] for r in results if r.get("wa_me_url")), None),
        "low_stock_count": len(low_stock),
        "recipients": results,
        "detail": "Enviado" if all_sent else "WhatsApp no configurado — usa el enlace wa.me",
    }
