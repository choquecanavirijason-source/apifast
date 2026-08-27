"""Casos de uso de inventario (Category + Product + Batch + InventoryMovement).

Dividido por responsabilidad:
- categories.py — Category CRUD
- products.py   — Product CRUD (con creación de stock inicial)
- batches.py    — Batch CRUD (lotes de stock por sucursal)
- movements.py  — InventoryMovement (entradas/salidas/ajustes/uso por servicio)
- stock.py      — Reporte agregado de stock

Re-exporta las funciones públicas para mantener compat con:
    from app.application.services.inventory_service import create_product
"""
from .batches import (
    create_batch,
    get_batch_by_id,
    list_batches,
    update_batch,
)
from .categories import (
    create_category,
    delete_category,
    get_category_by_id,
    list_categories,
    update_category,
)
from .movements import (
    ALLOWED_MOVEMENT_TYPES,
    create_inventory_movement,
    deduct_stock_fifo,
    list_movements,
    restock_from_sale,
    sale_stock_tag,
)
from .products import (
    create_product,
    delete_product,
    get_product_by_id,
    list_products,
    update_product,
)
from .stock import get_stock_summary
from .transfers import transfer_stock_between_branches

__all__ = [
    # categories
    "list_categories",
    "get_category_by_id",
    "create_category",
    "update_category",
    "delete_category",
    # products
    "list_products",
    "get_product_by_id",
    "create_product",
    "update_product",
    "delete_product",
    # batches
    "list_batches",
    "get_batch_by_id",
    "create_batch",
    "update_batch",
    # movements
    "ALLOWED_MOVEMENT_TYPES",
    "list_movements",
    "create_inventory_movement",
    "deduct_stock_fifo",
    "restock_from_sale",
    "sale_stock_tag",
    # stock
    "get_stock_summary",
    # transfers
    "transfer_stock_between_branches",
]
