from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from app.infrastructure.database import Base


class MarketplaceProduct(Base):
    __tablename__ = "marketplace_products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    brand = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    original_price = Column(Float, nullable=True)
    image_url = Column(String(500), nullable=True)
    category = Column(String(100), nullable=True)
    rating = Column(Float, nullable=True, default=0.0)
    review_count = Column(Integer, nullable=True, default=0)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
