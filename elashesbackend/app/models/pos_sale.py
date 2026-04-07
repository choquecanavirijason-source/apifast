from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class PosSale(Base):
    __tablename__ = "pos_sales"

    id = Column(Integer, primary_key=True, index=True)
    sale_code = Column(String(50), unique=True, index=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    subtotal = Column(Float, nullable=False, default=0)
    discount_type = Column(String(20), nullable=False, default="amount")
    discount_value = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False, default=0)
    payment_method = Column(String(50), nullable=False, default="cash")
    status = Column(String(30), nullable=False, default="paid")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="sales")
    branch = relationship("Branch", back_populates="sales")
    created_by = relationship("User", foreign_keys=[created_by_id])
    appointments = relationship("Appointment", back_populates="sale")
    payments = relationship("Payment", back_populates="sale")
