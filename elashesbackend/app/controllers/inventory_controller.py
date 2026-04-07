from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.models.user import User
from app.schemas.base_response import MessageResponse
from app.schemas.inventory import (
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
)
from app.services.inventory_service import (
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
)


router = APIRouter(
    prefix="/inventory",
    tags=["Inventario"],
)


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
@router.get("/products", response_model=List[ProductResponse])
def get_products(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    category_id: Optional[int] = Query(default=None, ge=1),
    active_only: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    return list_products(
        db=db,
        skip=skip,
        limit=limit,
        category_id=category_id,
        active_only=active_only,
    )


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
    )


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_existing_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    return update_product(
        db=db,
        product_id=product_id,
        sku=payload.sku,
        name=payload.name,
        category_id=payload.category_id,
        price=payload.price,
        cost=payload.cost,
        status_value=payload.status,
        image_url=payload.image_url,
    )


@router.delete("/products/{product_id}", response_model=MessageResponse)
def delete_existing_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    delete_product(db=db, product_id=product_id)
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
        branch_id=branch_id,
    )


@router.get("/batches/{batch_id}", response_model=BatchResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    return get_batch_by_id(db=db, batch_id=batch_id)


@router.post("/batches", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_new_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
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
    return update_batch(
        db=db,
        batch_id=batch_id,
        cost_per_unit=payload.cost_per_unit,
        sale_price_per_unit=payload.sale_price_per_unit,
    )


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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:view")),
):
    return list_movements(
        db=db,
        skip=skip,
        limit=limit,
        product_id=product_id,
        branch_id=branch_id,
        movement_type=movement_type,
    )


@router.post("/movements", response_model=InventoryMovementResponse, status_code=status.HTTP_201_CREATED)
def create_new_movement(
    payload: InventoryMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory:manage")),
):
    return create_inventory_movement(
        db=db,
        product_id=payload.product_id,
        batch_id=payload.batch_id,
        branch_id=payload.branch_id,
        movement_type=payload.movement_type,
        quantity=payload.quantity,
        note=payload.note,
    )


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
        branch_id=branch_id,
        product_id=product_id,
    )