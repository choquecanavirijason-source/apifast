"""Casos de uso para InventoryMovement (entradas, salidas, ajustes, uso por servicio)."""
import asyncio
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.branch import Branch
from app.domain.entities.inventory import Batch, InventoryMovement, Product
from app.domain.entities.user import Role, User


ALLOWED_MOVEMENT_TYPES = {"in", "out", "adjustment", "service_use"}


def _movement_query(db: Session):
    return db.query(InventoryMovement).options(
        joinedload(InventoryMovement.product),
    )


def _validate_movement_type(movement_type: str) -> str:
    normalized = movement_type.strip().lower()
    if normalized not in ALLOWED_MOVEMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de movimiento no válido. Usa uno de: {', '.join(sorted(ALLOWED_MOVEMENT_TYPES))}",
        )
    return normalized


def list_movements(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    product_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    movement_type: Optional[str] = None,
):
    query = _movement_query(db)

    if product_id is not None:
        query = query.filter(InventoryMovement.product_id == product_id)

    if branch_id is not None:
        query = query.filter(InventoryMovement.branch_id == branch_id)

    if movement_type:
        query = query.filter(
            InventoryMovement.movement_type == movement_type.strip().lower()
        )

    return (
        query.order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_inventory_movement(
    db: Session,
    product_id: int,
    batch_id: Optional[int],
    branch_id: Optional[int],
    movement_type: str,
    quantity: float,
    note: Optional[str],
) -> InventoryMovement:
    normalized_type = _validate_movement_type(movement_type)

    if quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cantidad debe ser mayor a 0",
        )

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El producto indicado no existe",
        )

    batch = None
    if batch_id is not None:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El lote indicado no existe",
            )

        if batch.product_id != product_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El lote no pertenece al producto indicado",
            )

    if branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sucursal indicada no existe",
            )

    if batch is not None and branch_id is not None and batch.branch_id != branch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El lote no pertenece a la sucursal indicada",
        )

    # Aplicar efecto al stock del lote si corresponde
    stock_before = batch.current_quantity if batch is not None else None

    if batch is not None:
        if normalized_type in {"out", "service_use"}:
            if batch.current_quantity < quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Stock insuficiente en el lote",
                )
            batch.current_quantity -= quantity

        elif normalized_type == "in":
            batch.current_quantity += quantity

        elif normalized_type == "adjustment":
            batch.current_quantity += quantity

    movement = InventoryMovement(
        product_id=product_id,
        batch_id=batch_id,
        branch_id=branch_id,
        movement_type=normalized_type,
        quantity=quantity,
        note=note,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)

    # ── Alerta automática de stock bajo ──────────────────────────────────
    # Dispara solo cuando el stock cruza el umbral mínimo (antes estaba OK, ahora está bajo)
    if batch is not None and normalized_type in {"out", "service_use"} and product is not None:
        min_s = product.min_stock or 0
        if min_s > 0:
            # Stock total del producto en todos los lotes
            total_stock = sum(
                b.current_quantity
                for b in db.query(Batch).filter(Batch.product_id == product_id).all()
            )
            just_crossed = stock_before is not None and stock_before > min_s and total_stock <= min_s
            if just_crossed:
                _fire_stock_alert_background(db, product, total_stock, min_s)

    return movement


def deduct_stock_fifo(
    db: Session,
    product_id: int,
    branch_id: int,
    quantity: float,
    note: Optional[str],
) -> list["InventoryMovement"]:
    """Descuenta `quantity` de un producto en una sucursal, tomando primero de
    los lotes más antiguos (por entry_date). Lanza 409 si el stock total
    disponible no alcanza — no toca nada en ese caso."""
    if quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0")

    batches = (
        db.query(Batch)
        .filter(
            Batch.product_id == product_id,
            Batch.branch_id == branch_id,
            Batch.current_quantity > 0,
        )
        .order_by(Batch.entry_date.asc(), Batch.id.asc())
        .all()
    )

    available = sum(b.current_quantity for b in batches)
    if available < quantity:
        product = db.query(Product).filter(Product.id == product_id).first()
        product_name = product.name if product else f"#{product_id}"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Stock insuficiente de {product_name}: disponible {available}, pedido {quantity}",
        )

    movements: list[InventoryMovement] = []
    remaining = quantity
    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch.current_quantity, remaining)
        movement = create_inventory_movement(
            db=db,
            product_id=product_id,
            batch_id=batch.id,
            branch_id=branch_id,
            movement_type="out",
            quantity=take,
            note=note,
        )
        movements.append(movement)
        remaining -= take

    return movements


def sale_stock_tag(sale_id: int, created_at) -> str:
    """Marca única para poder encontrar después todos los movimientos de
    stock que salieron por una venta puntual.

    NI sale_code NI sale.id alcanzan por sí solos: SQLite reutiliza el id de
    fila (rowid) de una tabla después de un DELETE cuando la columna no tiene
    AUTOINCREMENT explícito — como pos_sales sí borra filas (delete_sale),
    una venta nueva puede terminar con el mismo id que una venta vieja ya
    borrada, y esta marca dejaría de ser única. Se combina el id con el
    timestamp de creación (microsegundos) de la venta, que en la práctica
    nunca coincide entre dos ventas distintas, para que la marca sea
    verdaderamente única sin tener que cambiar el esquema de la tabla."""
    stamp = created_at.strftime("%Y%m%d%H%M%S%f") if created_at else "0"
    return f"[pos_sale:{sale_id}:{stamp}]"


def restock_from_sale(db: Session, sale_id: int, sale_code: str, created_at) -> None:
    """Revierte las salidas de stock hechas para una venta puntual
    (identificada por su tag único, ver `sale_stock_tag`), creando
    movimientos "in" compensatorios en los mismos lotes. Usado al cancelar
    o eliminar una venta con productos.
    NO es idempotente por sí sola — el llamador debe asegurarse de invocarla
    una sola vez por venta (ver guardas en pos_sale_service: cancelar
    restituye, y eliminar una venta YA cancelada no vuelve a restituir)."""
    tag = sale_stock_tag(sale_id, created_at)
    out_movements = (
        db.query(InventoryMovement)
        .filter(
            InventoryMovement.movement_type == "out",
            InventoryMovement.note.like(f"{tag}%"),
        )
        .all()
    )
    for movement in out_movements:
        if movement.batch_id is None:
            continue
        create_inventory_movement(
            db=db,
            product_id=movement.product_id,
            batch_id=movement.batch_id,
            branch_id=movement.branch_id,
            movement_type="in",
            quantity=movement.quantity,
            note=f"{tag} Reversión — cancelación {sale_code}",
        )


def _fire_stock_alert_background(db: Session, product: Product, total_stock: int, min_stock: int) -> None:
    """Envía alerta WhatsApp en background sin bloquear la respuesta HTTP."""
    from app.application.services.branch_integration_service import get_whatsapp_config_for_branch
    from app.application.services.whatsapp_service import normalize_phone_e164, send_whatsapp_text

    try:
        secretaria_roles = db.query(Role).filter(Role.name.in_(["Secretaria", "Admin", "SuperAdmin"])).all()
        role_ids = [r.id for r in secretaria_roles]
        recipients = (
            db.query(User)
            .filter(User.role_id.in_(role_ids), User.is_active.is_(True), User.phone.isnot(None))
            .all()
        )
        if not recipients:
            return

        branch = db.query(Branch).first()
        wa_config = get_whatsapp_config_for_branch(db, branch.id if branch else None)

        agotado = total_stock == 0
        if agotado:
            msg = (
                f"🚨 *PRODUCTO AGOTADO — New Elashes*\n\n"
                f"❌ *{product.name}* (SKU: {product.sku}) se quedó sin stock.\n"
                f"Stock actual: 0 / Mínimo: {min_stock}\n\n"
                "Por favor realizar pedido urgente. ✅"
            )
        else:
            faltan = min_stock - total_stock
            msg = (
                f"⚠️ *STOCK BAJO — New Elashes*\n\n"
                f"*{product.name}* (SKU: {product.sku}) bajó del mínimo.\n"
                f"Stock actual: {total_stock} / Mínimo: {min_stock} (faltan {faltan})\n\n"
                "Por favor gestionar reposición. ✅"
            )

        async def _send_all():
            for user in recipients:
                phone = normalize_phone_e164(user.phone)
                if phone:
                    await send_whatsapp_text(phone_e164=phone, message=msg, branch_config=wa_config)

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(_send_all())
            else:
                loop.run_until_complete(_send_all())
        except RuntimeError:
            asyncio.run(_send_all())
    except Exception as e:
        print(f"[StockAlert] Error enviando alerta WhatsApp: {e}")
