"""Reporte agregado de stock por producto/sucursal."""
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.domain.entities.branch import Branch
from app.domain.entities.inventory import Batch, Product


def get_stock_summary(
    db: Session,
    branch_id: Optional[int] = None,
    product_id: Optional[int] = None,
):
    query = (
        db.query(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            Product.sku.label("product_sku"),
            Branch.id.label("branch_id"),
            Branch.name.label("branch_name"),
            func.coalesce(func.sum(Batch.current_quantity), 0).label("total_stock"),
        )
        .join(Batch, Batch.product_id == Product.id)
        .join(Branch, Branch.id == Batch.branch_id)
        .group_by(Product.id, Product.name, Product.sku, Branch.id, Branch.name)
    )

    if branch_id is not None:
        query = query.filter(Branch.id == branch_id)

    if product_id is not None:
        query = query.filter(Product.id == product_id)

    rows = query.order_by(Product.name.asc(), Branch.name.asc()).all()

    return [
        {
            "product_id": row.product_id,
            "product_name": row.product_name,
            "product_sku": row.product_sku,
            "branch_id": row.branch_id,
            "branch_name": row.branch_name,
            "total_stock": float(row.total_stock),
        }
        for row in rows
    ]
