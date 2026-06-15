"""Transferencia atómica de stock entre sucursales."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.domain.entities.branch import Branch
from app.domain.entities.inventory import Batch, InventoryMovement, Product


def transfer_stock_between_branches(
    db: Session,
    product_id: int,
    from_branch_id: int,
    to_branch_id: int,
    quantity: float,
    note: Optional[str] = None,
) -> dict:
    if quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser mayor a 0.")

    if from_branch_id == to_branch_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La sucursal de origen y destino deben ser distintas.")

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado.")

    from_branch = db.query(Branch).filter(Branch.id == from_branch_id).first()
    if not from_branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal de origen no encontrada.")

    to_branch = db.query(Branch).filter(Branch.id == to_branch_id).first()
    if not to_branch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sucursal de destino no encontrada.")

    # Obtener lotes con stock en origen (FIFO: más antiguos primero)
    source_batches = (
        db.query(Batch)
        .filter(Batch.product_id == product_id, Batch.branch_id == from_branch_id, Batch.current_quantity > 0)
        .order_by(Batch.entry_date.asc(), Batch.id.asc())
        .all()
    )

    total_available = sum(b.current_quantity for b in source_batches)
    if total_available < quantity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Stock insuficiente en {from_branch.name}. Disponible: {total_available}, solicitado: {quantity}.",
        )

    # Descontar de los lotes origen (FIFO)
    remaining = quantity
    transfer_note = note or f"Transferencia a {to_branch.name}"
    for batch in source_batches:
        if remaining <= 0:
            break
        deduct = min(batch.current_quantity, remaining)
        batch.current_quantity -= deduct
        remaining -= deduct
        db.add(InventoryMovement(
            product_id=product_id,
            batch_id=batch.id,
            branch_id=from_branch_id,
            movement_type="out",
            quantity=deduct,
            note=transfer_note,
        ))

    # Crear lote en destino con el stock transferido
    # Tomar el costo del primer lote origen como referencia
    ref_cost = source_batches[0].cost_per_unit if source_batches else 0.0
    dest_batch = Batch(
        product_id=product_id,
        branch_id=to_branch_id,
        initial_quantity=quantity,
        current_quantity=quantity,
        cost_per_unit=ref_cost,
        sale_price_per_unit=source_batches[0].sale_price_per_unit if source_batches else None,
    )
    db.add(dest_batch)
    db.flush()

    receive_note = note or f"Transferencia desde {from_branch.name}"
    db.add(InventoryMovement(
        product_id=product_id,
        batch_id=dest_batch.id,
        branch_id=to_branch_id,
        movement_type="in",
        quantity=quantity,
        note=receive_note,
    ))

    db.commit()

    return {
        "product_id": product_id,
        "product_name": product.name,
        "from_branch_id": from_branch_id,
        "from_branch_name": from_branch.name,
        "to_branch_id": to_branch_id,
        "to_branch_name": to_branch.name,
        "quantity": quantity,
        "message": f"Transferidos {quantity} unidades de '{product.name}' de {from_branch.name} a {to_branch.name}.",
    }
