"""Un producto nuevo creado para una sucursal aparece en su catálogo (la caja) aunque no tenga stock
inicial. Antes solo aparecía si tenía un lote, así que "Stock inicial 0" lo dejaba invisible en todas.

Ejecutar:
  cd elashesbackend
  pytest tests/test_product_visible_in_branch.py -v
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.infrastructure.database.init_db  # registra los modelos sin ejecutar migraciones
from app.application.services.inventory_service.products import create_product, list_products
from app.domain.entities.branch import Branch
from app.infrastructure.database import Base


@pytest.fixture
def work():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()
    north = Branch(name="Norte", address="Calle 1", city="LP", department="LP")
    south = Branch(name="Sur", address="Calle 2", city="LP", department="LP")
    db.add_all([north, south])
    db.commit()
    yield db, north.id, south.id
    db.close()
    engine.dispose()


def make(db, sku, branch_id, stock):
    return create_product(
        db, sku=sku, name=f"Producto {sku}", category_id=None, price=10.0, cost=5.0,
        status_value=True, image_url=None, initial_stock=stock, branch_id=branch_id,
    )


def names(db, branch_id):
    return {p.sku for p in list_products(db, branch_id=branch_id, active_only=True)}


def test_new_product_without_stock_shows_in_its_branch_only(work):
    db, north, south = work
    make(db, "SINSTOCK", north, 0)
    assert "SINSTOCK" in names(db, north)       # la cajera de Norte lo ve (agotado)
    assert "SINSTOCK" not in names(db, south)   # y la de Sur no


def test_new_product_with_stock_still_works_and_records_the_entry(work):
    db, north, south = work
    product = make(db, "CONSTOCK", south, 7)
    assert "CONSTOCK" in names(db, south)
    assert sum(b.current_quantity for b in product.batches) == 7


def test_zero_stock_creates_no_inventory_movement(work):
    db, north, _ = work
    from app.domain.entities.inventory import InventoryMovement
    make(db, "SINMOV", north, 0)
    assert db.query(InventoryMovement).count() == 0
