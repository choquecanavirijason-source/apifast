from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.audit import describe_changes, record_audit
from app.core.dependencies import SUPER_ADMIN_ROLE, get_db, require_permission
from app.core.media import save_catalog_image
from app.domain.entities.user import User
from app.presentation.schemas.base_response import MessageResponse
from app.presentation.schemas.inventory import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    BatchCreate,
    BatchUpdate,
    BatchResponse,
    InventoryMovementCreate,
    InventoryMovementResponse,
    StockSummaryResponse,
    StockTransferCreate,
    StockTransferResponse,
)
from app.application.services.inventory_service import (
    list_categories,
    get_category_by_id,
    create_category,
    update_category,
    delete_category,
    list_products,
    get_product_by_id,
    create_product,
    update_product,
    delete_product,
    list_batches,
    get_batch_by_id,
    create_batch,
    update_batch,
    list_movements,
    create_inventory_movement,
    get_stock_summary,
    transfer_stock_between_branches,
    branch_min_map,
)


router = APIRouter(
    prefix="/inventory",
    tags=["Inventario"],
)

_BRANCH_FREE_ROLES = (SUPER_ADMIN_ROLE, "Admin", "Secretaria")


def _is_branch_free(user: User) -> bool:
    return bool(user.role and user.role.name in _BRANCH_FREE_ROLES)


def _scope_branch(requested: Optional[int], user: User) -> Optional[int]:
    """Sucursal que el usuario puede consultar: SuperAdmin/Admin/Secretaria, la que pidan (o todas);
    el resto, siempre la suya (pedir otra se ignora: no se filtra informacion de otras sucursales)."""
    if _is_branch_free(user):
        return requested
    own = user.effective_branch_id
    if own is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu usuario no tiene una sucursal asignada.")
    return own


def _assert_branch_access(branch_id: Optional[int], user: User) -> None:
    """Para escribir o leer algo de UNA sucursal concreta: el personal acotado solo la suya."""
    if _is_branch_free(user):
        return
    if branch_id is None or user.effective_branch_id is None or branch_id != user.effective_branch_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes manejar el inventario de otra sucursal.",
        )


def _products_for_branch(db: Session, products, branch_id: Optional[int]):
    """Respuesta de productos con el stock minimo que aplica a la sucursal consultada."""
    mins = branch_min_map(db, branch_id)
    out = []
    for product in products:
        item = ProductResponse.model_validate(product)
        if product.id in mins:
            item = item.model_copy(update={"min_stock": mins[product.id], "min_stock_is_branch": True})
        out.append(item)
    return out


# ==========================================
# Categories
# ==========================================
@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    return list_categories(db=db)


@router.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    return get_category_by_id(db=db, category_id=category_id)


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_new_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    return create_category(
        db=db,
        name=payload.name,
        description=payload.description,
    )


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_existing_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    return update_category(
        db=db,
        category_id=category_id,
        name=payload.name,
        description=payload.description,
    )


@router.delete("/categories/{category_id}", response_model=MessageResponse)
def delete_existing_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    delete_category(db=db, category_id=category_id)
    return MessageResponse(message="Categoría eliminada correctamente")


# ==========================================
# Products
# ==========================================
@router.post("/products/upload-image", status_code=status.HTTP_201_CREATED)
def upload_product_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    """Sube la foto de un producto. Endpoint propio: el de catálogo pide catalog:manage, un permiso
    sin relación con crear productos (la cajera lo necesita para el POS)."""
    return {"image_url": save_catalog_image(file=file, folder="products")}


@router.get("/products", response_model=List[ProductResponse])
def get_products(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    category_id: Optional[int] = Query(default=None, ge=1),
    active_only: Optional[bool] = Query(default=None),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    branch_id = _scope_branch(branch_id, current_user)
    products = list_products(
        db=db,
        skip=skip,
        limit=limit,
        category_id=category_id,
        active_only=active_only,
        branch_id=branch_id,
    )
    return _products_for_branch(db, products, branch_id)


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    return get_product_by_id(db=db, product_id=product_id)


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_new_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    # El personal acotado solo crea productos en su sucursal.
    if not _is_branch_free(current_user):
        payload.branch_id = _scope_branch(None, current_user)
    return create_product(
        db=db,
        sku=payload.sku,
        name=payload.name,
        category_id=payload.category_id,
        price=payload.price,
        cost=payload.cost,
        status_value=payload.status,
        image_url=payload.image_url,
        initial_stock=payload.initial_stock,
        branch_id=payload.branch_id,
        min_stock=payload.min_stock,
    )


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_existing_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    existing = get_product_by_id(db=db, product_id=product_id)
    # Con sucursal, el stock minimo es el de ESA sucursal; el personal acotado solo cambia el de la suya.
    min_branch_id = None
    if payload.min_stock is not None:
        min_branch_id = payload.branch_id if _is_branch_free(current_user) else _scope_branch(None, current_user)
    old_values = {
        "name": existing.name, "price": existing.price, "cost": existing.cost,
        "min_stock": existing.min_stock, "status": existing.status,
    }
    result = update_product(
        db=db,
        product_id=product_id,
        sku=payload.sku,
        name=payload.name,
        category_id=payload.category_id,
        price=payload.price,
        cost=payload.cost,
        status_value=payload.status,
        image_url=payload.image_url,
        min_stock=payload.min_stock,
        branch_id=min_branch_id,
    )
    changes = describe_changes(old_values, result, {
        "name": "nombre", "price": "precio", "cost": "costo",
        "min_stock": "stock mínimo", "status": "estado",
    })
    record_audit(
        db, current_user, "update", "product", product_id,
        f"Editó el producto '{result.name}' — {changes}",
    )
    return result


@router.delete("/products/{product_id}", response_model=MessageResponse)
def delete_existing_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    product = get_product_by_id(db=db, product_id=product_id)
    product_name = product.name if product else f"#{product_id}"
    delete_product(db=db, product_id=product_id)
    record_audit(
        db, current_user, "delete", "product", product_id,
        f"Eliminó el producto '{product_name}'",
    )
    return MessageResponse(message="Producto eliminado correctamente")


# ==========================================
# Batches
# ==========================================
@router.get("/batches", response_model=List[BatchResponse])
def get_batches(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    product_id: Optional[int] = Query(default=None, ge=1),
    branch_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    return list_batches(
        db=db,
        skip=skip,
        limit=limit,
        product_id=product_id,
        branch_id=_scope_branch(branch_id, current_user),
    )


@router.get("/batches/{batch_id}", response_model=BatchResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    batch = get_batch_by_id(db=db, batch_id=batch_id)
    _assert_branch_access(batch.branch_id, current_user)
    return batch


@router.post("/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_new_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    _assert_branch_access(payload.branch_id, current_user)
    return create_batch(
        db=db,
        product_id=payload.product_id,
        branch_id=payload.branch_id,
        quantity=payload.quantity,
        cost_per_unit=payload.cost_per_unit,
        sale_price_per_unit=payload.sale_price_per_unit,
    )


@router.put("/batches/{batch_id}", response_model=BatchResponse)
def update_existing_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    existing = get_batch_by_id(db=db, batch_id=batch_id)
    _assert_branch_access(existing.branch_id, current_user)
    old_values = {"cost_per_unit": existing.cost_per_unit, "sale_price_per_unit": existing.sale_price_per_unit}
    result = update_batch(
        db=db,
        batch_id=batch_id,
        cost_per_unit=payload.cost_per_unit,
        sale_price_per_unit=payload.sale_price_per_unit,
    )
    changes = describe_changes(old_values, result, {
        "cost_per_unit": "costo unitario", "sale_price_per_unit": "precio de venta unitario",
    })
    record_audit(
        db, current_user, "update", "batch", batch_id,
        f"Editó el lote #{batch_id} — {changes}",
    )
    return result


# ==========================================
# Movements
# ==========================================
@router.get("/movements", response_model=List[InventoryMovementResponse])
def get_movements(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    product_id: Optional[int] = Query(default=None, ge=1),
    branch_id: Optional[int] = Query(default=None, ge=1),
    movement_type: Optional[str] = Query(default=None),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    return list_movements(
        db=db,
        skip=skip,
        limit=limit,
        product_id=product_id,
        branch_id=_scope_branch(branch_id, current_user),
        movement_type=movement_type,
        date_from=date_from,
        date_to=date_to,
    )


@router.post("/movements", response_model=InventoryMovementResponse, status_code=status.HTTP_201_CREATED)
def create_new_movement(
    payload: InventoryMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    if not _is_branch_free(current_user):
        movement_branch = payload.branch_id
        if movement_branch is None and payload.batch_id is not None:
            movement_branch = get_batch_by_id(db=db, batch_id=payload.batch_id).branch_id
        _assert_branch_access(movement_branch, current_user)
    result = create_inventory_movement(
        db=db,
        product_id=payload.product_id,
        batch_id=payload.batch_id,
        branch_id=payload.branch_id,
        movement_type=payload.movement_type,
        quantity=payload.quantity,
        note=payload.note,
    )
    record_audit(
        db, current_user, "update", "inventory_movement", result.id,
        f"Movimiento de inventario ({payload.movement_type}, cant. {payload.quantity}) en producto #{payload.product_id}",
        branch_id=payload.branch_id,
    )
    return result


# ==========================================
# Stock summary
# ==========================================
@router.get("/stock-summary", response_model=List[StockSummaryResponse])
def get_inventory_stock_summary(
    branch_id: Optional[int] = Query(default=None, ge=1),
    product_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    return get_stock_summary(
        db=db,
        branch_id=_scope_branch(branch_id, current_user),
        product_id=product_id,
    )


# ==========================================
# Stock Transfers
# ==========================================
@router.post("/transfers", response_model=StockTransferResponse, status_code=status.HTTP_201_CREATED)
def create_stock_transfer(
    payload: StockTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    # Solo se saca stock de la propia sucursal (el destino puede ser otra).
    _assert_branch_access(payload.from_branch_id, current_user)
    result = transfer_stock_between_branches(
        db=db,
        product_id=payload.product_id,
        from_branch_id=payload.from_branch_id,
        to_branch_id=payload.to_branch_id,
        quantity=payload.quantity,
        note=payload.note,
    )
    record_audit(
        db, current_user, "update", "stock_transfer", None,
        f"Transferencia de stock: producto #{payload.product_id}, cant. {payload.quantity}, "
        f"de sucursal #{payload.from_branch_id} a #{payload.to_branch_id}",
        branch_id=payload.to_branch_id,
    )
    return result