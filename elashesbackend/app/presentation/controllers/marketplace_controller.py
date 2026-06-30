from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.core.dependencies import get_db, require_any_role, require_permission
from app.core.media import save_catalog_image
from app.domain.entities.inventory import Batch, Product as InventoryProduct
from app.domain.entities.marketplace_product import MarketplaceProduct
from app.domain.entities.user import User

router = APIRouter(
    prefix="/marketplace",
    tags=["Marketplace"],
)

ADMIN_ROLES = ["SuperAdmin", "Admin"]


# ─────────────────────────── helpers ───────────────────────────

def _product_to_dict(p: MarketplaceProduct) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "brand": p.brand,
        "description": p.description,
        "price": p.price,
        "original_price": p.original_price,
        "image_url": p.image_url,
        "category": p.category,
        "rating": p.rating,
        "review_count": p.review_count,
        "is_active": p.is_active,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


# ─────────────────────────── public endpoints (app Flutter) ───────────────────────────

@router.get("/products", tags=["Marketplace público"])
def list_marketplace_products(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Retorna productos activos del marketplace (sin autenticación)."""
    query = db.query(MarketplaceProduct).filter(MarketplaceProduct.is_active == True)
    if category and category.lower() != "todos":
        query = query.filter(MarketplaceProduct.category == category)
    products = query.order_by(MarketplaceProduct.created_at.desc()).all()
    return [_product_to_dict(p) for p in products]


@router.get("/products/{product_id}", tags=["Marketplace público"])
def get_marketplace_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(MarketplaceProduct).filter(MarketplaceProduct.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _product_to_dict(p)


# ─────────────────────────── admin endpoints ───────────────────────────

@router.get("/admin/products", tags=["Marketplace admin"])
def admin_list_products(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(*ADMIN_ROLES)),
):
    query = db.query(MarketplaceProduct)
    if not include_inactive:
        query = query.filter(MarketplaceProduct.is_active == True)
    products = query.order_by(MarketplaceProduct.created_at.desc()).all()
    return [_product_to_dict(p) for p in products]


@router.post("/admin/products", status_code=status.HTTP_201_CREATED, tags=["Marketplace admin"])
def admin_create_product(
    name: str = Form(...),
    brand: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    price: float = Form(...),
    original_price: Optional[float] = Form(None),
    category: Optional[str] = Form(None),
    rating: Optional[float] = Form(0.0),
    review_count: Optional[int] = Form(0),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(*ADMIN_ROLES)),
):
    image_url = None
    if image and image.filename:
        image_url = save_catalog_image(image, "marketplace")

    product = MarketplaceProduct(
        name=name,
        brand=brand,
        description=description,
        price=price,
        original_price=original_price,
        image_url=image_url,
        category=category,
        rating=rating,
        review_count=review_count,
        is_active=True,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_to_dict(product)


@router.put("/admin/products/{product_id}", tags=["Marketplace admin"])
def admin_update_product(
    product_id: int,
    name: Optional[str] = Form(None),
    brand: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    original_price: Optional[float] = Form(None),
    category: Optional[str] = Form(None),
    rating: Optional[float] = Form(None),
    review_count: Optional[int] = Form(None),
    is_active: Optional[bool] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(*ADMIN_ROLES)),
):
    p = db.query(MarketplaceProduct).filter(MarketplaceProduct.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if name is not None:
        p.name = name
    if brand is not None:
        p.brand = brand
    if description is not None:
        p.description = description
    if price is not None:
        p.price = price
    if original_price is not None:
        p.original_price = original_price
    if category is not None:
        p.category = category
    if rating is not None:
        p.rating = rating
    if review_count is not None:
        p.review_count = review_count
    if is_active is not None:
        p.is_active = is_active
    if image and image.filename:
        p.image_url = save_catalog_image(image, "marketplace")

    db.commit()
    db.refresh(p)
    return _product_to_dict(p)


@router.delete("/admin/products/{product_id}", tags=["Marketplace admin"])
def admin_delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_role(*ADMIN_ROLES)),
):
    p = db.query(MarketplaceProduct).filter(MarketplaceProduct.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db.delete(p)
    db.commit()
    return {"message": "Producto eliminado"}


# ─────────────────────────── feed unificado ───────────────────────────────────

@router.get("/feed", tags=["Marketplace público"])
async def get_marketplace_feed(
    request: Request,
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Feed unificado: productos del marketplace (backend_marketplace) +
    productos del inventario del salón (elashesbackend) con stock disponible.
    Los productos del inventario que ya existen en marketplace se omiten (evita duplicados).
    """
    # URL base pública de este backend (para construir URLs absolutas de imágenes)
    elashes_base = str(request.base_url).rstrip("/")
    mp_base = settings.marketplace_backend_url.rstrip("/")

    result: list[dict] = []
    mp_names_lower: set[str] = set()

    # ── 1. Productos de backend_marketplace ──────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{mp_base}/api/products")
            if resp.status_code == 200:
                for p in resp.json():
                    raw_img = p.get("image_url") or ""
                    if raw_img and not raw_img.startswith("http"):
                        raw_img = f"{mp_base}{raw_img}"
                    mp_names_lower.add((p.get("name") or "").lower())
                    result.append({
                        "id": p["id"],
                        "source": "marketplace",
                        "name": p.get("name", ""),
                        "brand": p.get("brand"),
                        "description": p.get("description"),
                        "price": p.get("price", 0),
                        "original_price": p.get("original_price"),
                        "image_url": raw_img or None,
                        "category": p.get("category_name") or p.get("category"),
                        "category_id": p.get("category_id"),
                        "stock": p.get("stock", 0),
                        "rating": p.get("rating", 0),
                        "review_count": p.get("review_count", 0),
                    })
    except Exception:
        pass  # marketplace offline: continúa con inventario solamente

    # ── 2. Productos del inventario del salón con stock > 0 ──────────────────
    stock_subq = (
        db.query(Batch.product_id, func.sum(Batch.current_quantity).label("total_stock"))
        .group_by(Batch.product_id)
        .subquery()
    )

    inv_rows = (
        db.query(InventoryProduct, stock_subq.c.total_stock)
        .join(stock_subq, InventoryProduct.id == stock_subq.c.product_id)
        .filter(
            InventoryProduct.status == True,
            stock_subq.c.total_stock > 0,
        )
        .all()
    )

    for prod, total_stock in inv_rows:
        # Omitir si ya existe en marketplace (evita duplicados)
        if prod.name.lower() in mp_names_lower:
            continue

        raw_img = prod.image_url or ""
        if raw_img and not raw_img.startswith("http"):
            raw_img = f"{elashes_base}{raw_img}"

        cat_name = prod.category.name if prod.category else None

        result.append({
            "id": f"inv_{prod.id}",
            "source": "inventory",
            "name": prod.name,
            "brand": None,
            "description": None,
            "price": prod.price,
            "original_price": None,
            "image_url": raw_img or None,
            "category": cat_name,
            "category_id": None,
            "stock": int(total_stock),
            "rating": 0,
            "review_count": 0,
        })

    # ── Filtros opcionales ────────────────────────────────────────────────────
    if search:
        q = search.lower()
        result = [p for p in result if q in p["name"].lower()]

    if category and category.lower() != "todos":
        result = [p for p in result if (p.get("category") or "").lower() == category.lower()]

    return result


@router.get("/feed/categories", tags=["Marketplace público"])
async def get_feed_categories(db: Session = Depends(get_db)):
    """
    Lista de categorías disponibles en el feed unificado
    (marketplace + inventario con stock).
    """
    mp_categories: set[str] = set()

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{settings.marketplace_backend_url.rstrip('/')}/api/categories")
            if resp.status_code == 200:
                for c in resp.json():
                    if c.get("name"):
                        mp_categories.add(c["name"])
    except Exception:
        pass

    # Categorías del inventario (solo productos con stock)
    stock_subq = (
        db.query(Batch.product_id)
        .filter(Batch.current_quantity > 0)
        .subquery()
    )
    inv_rows = (
        db.query(InventoryProduct)
        .join(stock_subq, InventoryProduct.id == stock_subq.c.product_id)
        .filter(InventoryProduct.status == True)
        .all()
    )
    for p in inv_rows:
        if p.category:
            mp_categories.add(p.category.name)

    return sorted(mp_categories)
