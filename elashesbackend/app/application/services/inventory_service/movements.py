"""Casos de uso para InventoryMovement (entradas, salidas, ajustes, uso por servicio)."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.branch import Branch
from app.domain.entities.inventory import Batch, InventoryMovement, Product


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

    return movement
