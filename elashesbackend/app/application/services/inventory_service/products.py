"""Casos de uso para Product (catálogo de productos)."""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.domain.entities.branch import Branch
from app.domain.entities.inventory import Batch, InventoryMovement, Product

from .categories import _validate_category


def _product_query(db: Session):
    return db.query(Product).options(joinedload(Product.category))


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
