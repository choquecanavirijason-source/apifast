"""Casos de uso para Batch (lotes de stock por sucursal)."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.branch import Branch
from app.domain.entities.inventory import Batch, InventoryMovement, Product


def _batch_query(db: Session):
    return db.query(Batch).options(
        joinedload(Batch.product),
        joinedload(Batch.branch),
    )


def _validate_product_and_branch(db: Session, product_id: int, branch_id: int):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El producto indicado no existe",
        )

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La sucursal indicada no existe",
        )


def list_batches(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    product_id: Optional[int] = None,
    branch_id: Optional[int] = None,
):
    query = _batch_query(db)

    if product_id is not None:
        query = query.filter(Batch.product_id == product_id)

    if branch_id is not None:
        query = query.filter(Batch.branch_id == branch_id)

    return (
        query.order_by(Batch.entry_date.desc(), Batch.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_batch_by_id(db: Session, batch_id: int) -> Batch:
    batch = _batch_query(db).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote no encontrado",
        )
    return batch


def create_batch(
    db: Session,
    product_id: int,
    branch_id: int,
    quantity: float,
    cost_per_unit: float,
    sale_price_per_unit: Optional[float] = None,
) -> Batch:
    _validate_product_and_branch(db, product_id, branch_id)

    if quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cantidad debe ser mayor a 0",
        )

    if cost_per_unit < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El costo por unidad no puede ser negativo",
        )

    if sale_price_per_unit is not None and sale_price_per_unit < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El precio de venta del lote no puede ser negativo",
        )

    product = db.query(Product).filter(Product.id == product_id).first()

    batch = Batch(
        product_id=product_id,
        branch_id=branch_id,
        initial_quantity=quantity,
        current_quantity=quantity,
        cost_per_unit=cost_per_unit,
        sale_price_per_unit=sale_price_per_unit,
    )
    db.add(batch)
    db.flush()

    movement = InventoryMovement(
        product_id=product_id,
        batch_id=batch.id,
        branch_id=branch_id,
        movement_type="in",
        quantity=quantity,
        note="Entrada inicial de lote",
    )
    db.add(movement)

    # Si el lote trae nuevo precio de venta, actualizamos el precio actual del producto.
    if product is not None and sale_price_per_unit is not None:
        product.price = sale_price_per_unit

    db.commit()
    db.refresh(batch)

    return get_batch_by_id(db, batch.id)


def update_batch(
    db: Session,
    batch_id: int,
    cost_per_unit: Optional[float] = None,
    sale_price_per_unit: Optional[float] = None,
) -> Batch:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lote no encontrado",
        )

    if cost_per_unit is not None:
        if cost_per_unit < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El costo por unidad no puede ser negativo",
            )
        batch.cost_per_unit = cost_per_unit

    if sale_price_per_unit is not None:
        if sale_price_per_unit < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El precio de venta del lote no puede ser negativo",
            )
        batch.sale_price_per_unit = sale_price_per_unit
        if batch.product is not None:
            batch.product.price = sale_price_per_unit

    db.commit()
    db.refresh(batch)
    return get_batch_by_id(db, batch.id)
