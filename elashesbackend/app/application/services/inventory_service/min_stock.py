"""Stock mínimo por sucursal.

Cada producto tiene un mínimo general (Product.min_stock) y, opcionalmente, uno propio por sucursal
(ProductBranchMin). Para una sucursal manda el suyo; si no tiene, vale el general.
"""
from typing import Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.domain.entities.inventory import Batch, Product, ProductBranchMin


def branch_min_map(db: Session, branch_id: Optional[int]) -> Dict[int, float]:
    """product_id -> mínimo propio de esa sucursal (solo los que lo tienen)."""
    if branch_id is None:
        return {}
    rows = db.query(ProductBranchMin).filter(ProductBranchMin.branch_id == branch_id).all()
    return {row.product_id: float(row.min_stock) for row in rows}


def min_stock_for(db: Session, product: Product, branch_id: Optional[int]) -> float:
    """Mínimo que aplica a `product` en `branch_id` (0 = sin alerta)."""
    if branch_id is not None:
        row = (
            db.query(ProductBranchMin)
            .filter(ProductBranchMin.product_id == product.id, ProductBranchMin.branch_id == branch_id)
            .first()
        )
        if row is not None:
            return float(row.min_stock)
    return float(product.min_stock or 0)


def set_branch_min(db: Session, product_id: int, branch_id: int, min_stock: float) -> None:
    row = (
        db.query(ProductBranchMin)
        .filter(ProductBranchMin.product_id == product_id, ProductBranchMin.branch_id == branch_id)
        .first()
    )
    if row is None:
        db.add(ProductBranchMin(product_id=product_id, branch_id=branch_id, min_stock=min_stock))
    else:
        row.min_stock = min_stock


def branch_stock(db: Session, product_id: int, branch_id: int) -> float:
    return float(
        db.query(func.coalesce(func.sum(Batch.current_quantity), 0.0))
        .filter(Batch.product_id == product_id, Batch.branch_id == branch_id)
        .scalar()
        or 0.0
    )
