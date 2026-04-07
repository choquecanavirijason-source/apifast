from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.branch import BranchSummary


# ==========================================
# Categories
# ==========================================
class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None


# ==========================================
# Products
# ==========================================
class ProductBase(BaseModel):
    sku: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    category_id: Optional[int] = None
    price: float = Field(..., ge=0)
    cost: float = Field(..., ge=0)
    status: bool = True
    image_url: Optional[str] = Field(default=None, max_length=500)


class ProductCreate(ProductBase):
    initial_stock: float = Field(default=0, ge=0)
    branch_id: Optional[int] = Field(default=None, ge=1)


class ProductUpdate(BaseModel):
    sku: Optional[str] = Field(default=None, min_length=2, max_length=50)
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    category_id: Optional[int] = None
    price: Optional[float] = Field(default=None, ge=0)
    cost: Optional[float] = Field(default=None, ge=0)
    status: Optional[bool] = None
    image_url: Optional[str] = Field(default=None, max_length=500)


class ProductCategorySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    name: str
    category_id: Optional[int] = None
    price: float
    cost: float
    status: bool
    image_url: Optional[str] = None
    category: Optional[ProductCategorySummary] = None


# ==========================================
# Batches
# ==========================================
class BatchBase(BaseModel):
    product_id: int
    branch_id: int
    initial_quantity: float = Field(..., gt=0)
    current_quantity: float = Field(..., ge=0)
    cost_per_unit: float = Field(..., ge=0)
    sale_price_per_unit: Optional[float] = Field(default=None, ge=0)


class BatchCreate(BaseModel):
    product_id: int
    branch_id: int
    quantity: float = Field(..., gt=0)
    cost_per_unit: float = Field(..., ge=0)
    sale_price_per_unit: Optional[float] = Field(default=None, ge=0)


class BatchUpdate(BaseModel):
    cost_per_unit: Optional[float] = Field(default=None, ge=0)
    sale_price_per_unit: Optional[float] = Field(default=None, ge=0)


class BatchProductSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    name: str


class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    branch_id: int
    initial_quantity: float
    current_quantity: float
    cost_per_unit: float
    sale_price_per_unit: Optional[float] = None
    entry_date: datetime

    product: BatchProductSummary
    branch: BranchSummary


# ==========================================
# Inventory Movements
# ==========================================
class InventoryMovementCreate(BaseModel):
    product_id: int
    batch_id: Optional[int] = None
    branch_id: Optional[int] = None
    movement_type: str = Field(..., min_length=2, max_length=30)
    quantity: float = Field(..., gt=0)
    note: Optional[str] = Field(default=None, max_length=255)


class InventoryMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    batch_id: Optional[int] = None
    branch_id: Optional[int] = None
    movement_type: str
    quantity: float
    note: Optional[str] = None
    created_at: datetime

    product: BatchProductSummary


# ==========================================
# Stock Summary
# ==========================================
class StockSummaryResponse(BaseModel):
    product_id: int
    product_name: str
    product_sku: str
    branch_id: int
    branch_name: str
    total_stock: float