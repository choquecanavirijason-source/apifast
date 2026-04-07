from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.branch import Branch
from app.models.inventory import (
    Category,
    Product,
    Batch,
    InventoryMovement,
)


ALLOWED_MOVEMENT_TYPES = {"in", "out", "adjustment", "service_use"}


# ==========================================
# Categories
# ==========================================
def list_categories(db: Session):
    return db.query(Category).order_by(Category.name.asc()).all()


def get_category_by_id(db: Session, category_id: int) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )
    return category


def create_category(db: Session, name: str, description: Optional[str]) -> Category:
    existing = db.query(Category).filter(Category.name == name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una categoría con ese nombre",
        )

    category = Category(
        name=name.strip(),
        description=description,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(
    db: Session,
    category_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
) -> Category:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

    if name is not None:
        existing = (
            db.query(Category)
            .filter(Category.name == name.strip(), Category.id != category_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una categoría con ese nombre",
            )
        category.name = name.strip()

    if description is not None:
        category.description = description

    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: int) -> None:
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada",
        )

    try:
        db.delete(category)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar la categoría porque está en uso",
        )


# ==========================================
# Products
# ==========================================
def _product_query(db: Session):
    return db.query(Product).options(joinedload(Product.category))


def _validate_category(db: Session, category_id: Optional[int]):
    if category_id is not None:
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La categoría indicada no existe",
            )


def list_products(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    category_id: Optional[int] = None,
    active_only: Optional[bool] = None,
):
    query = _product_query(db)

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    if active_only is not None:
        query = query.filter(Product.status == active_only)

    return (
        query.order_by(Product.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_product_by_id(db: Session, product_id: int) -> Product:
    product = _product_query(db).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )
    return product


def create_product(
    db: Session,
    sku: str,
    name: str,
    category_id: Optional[int],
    price: float,
    cost: float,
    status_value: bool,
    image_url: Optional[str],
    initial_stock: float = 0,
    branch_id: Optional[int] = None,
) -> Product:
    existing_sku = db.query(Product).filter(Product.sku == sku.strip()).first()
    if existing_sku:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un producto con ese SKU",
        )

    _validate_category(db, category_id)

    product = Product(
        sku=sku.strip(),
        name=name.strip(),
        category_id=category_id,
        price=price,
        cost=cost,
        status=status_value,
        image_url=image_url,
    )
    db.add(product)
    db.flush()

    if initial_stock > 0:
        target_branch = None

        if branch_id is not None:
            target_branch = db.query(Branch).filter(Branch.id == branch_id).first()
            if not target_branch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La sucursal indicada no existe",
                )
        else:
            target_branch = db.query(Branch).order_by(Branch.id.asc()).first()
            if not target_branch:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No existe una sucursal para registrar stock inicial",
                )

        batch = Batch(
            product_id=product.id,
            branch_id=target_branch.id,
            initial_quantity=initial_stock,
            current_quantity=initial_stock,
            cost_per_unit=cost,
            sale_price_per_unit=price,
        )
        db.add(batch)
        db.flush()

        movement = InventoryMovement(
            product_id=product.id,
            batch_id=batch.id,
            branch_id=target_branch.id,
            movement_type="in",
            quantity=initial_stock,
            note="Entrada inicial al crear producto",
        )
        db.add(movement)

    db.commit()
    db.refresh(product)
    return get_product_by_id(db, product.id)


def update_product(
    db: Session,
    product_id: int,
    sku: Optional[str] = None,
    name: Optional[str] = None,
    category_id: Optional[int] = None,
    price: Optional[float] = None,
    cost: Optional[float] = None,
    status_value: Optional[bool] = None,
    image_url: Optional[str] = None,
) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )

    if sku is not None:
        existing_sku = (
            db.query(Product)
            .filter(Product.sku == sku.strip(), Product.id != product_id)
            .first()
        )
        if existing_sku:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un producto con ese SKU",
            )
        product.sku = sku.strip()

    if name is not None:
        product.name = name.strip()

    if category_id is not None:
        _validate_category(db, category_id)
        product.category_id = category_id

    if price is not None:
        product.price = price

    if cost is not None:
        product.cost = cost

    if status_value is not None:
        product.status = status_value

    if image_url is not None:
        product.image_url = image_url

    db.commit()
    db.refresh(product)
    return get_product_by_id(db, product.id)


def delete_product(db: Session, product_id: int) -> None:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )

    try:
        db.delete(product)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar el producto porque está en uso",
        )


# ==========================================
# Batches
# ==========================================
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


# ==========================================
# Inventory Movements
# ==========================================
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
            # Ajuste simple: suma positiva
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


# ==========================================
# Stock summary
# ==========================================
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