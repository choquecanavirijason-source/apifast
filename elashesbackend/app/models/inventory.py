from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    price = Column(Float, default=0.0, nullable=False)   # precio de venta
    cost = Column(Float, default=0.0, nullable=False)    # costo base
    status = Column(Boolean, default=True, nullable=False)
    image_url = Column(String(500), nullable=True)

    category = relationship("Category", back_populates="products")
    batches = relationship("Batch", back_populates="product", cascade="all, delete-orphan")
    movements = relationship("InventoryMovement", back_populates="product", cascade="all, delete-orphan")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    initial_quantity = Column(Float, nullable=False)
    current_quantity = Column(Float, nullable=False)
    cost_per_unit = Column(Float, nullable=False)
    sale_price_per_unit = Column(Float, nullable=True)
    entry_date = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="batches")
    branch = relationship("Branch", back_populates="batches")
    movements = relationship("InventoryMovement", back_populates="batch", cascade="all, delete-orphan")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    movement_type = Column(String(30), nullable=False)  # IN, OUT, ADJUSTMENT, SERVICE_USE
    quantity = Column(Float, nullable=False)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="movements")
    batch = relationship("Batch", back_populates="movements")