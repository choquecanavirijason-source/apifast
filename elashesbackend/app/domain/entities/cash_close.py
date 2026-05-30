from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base


class CashClose(Base):
    """Registro de cierre de caja por fecha y sucursal."""
    __tablename__ = "cash_closes"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), nullable=False, index=True)          # YYYY-MM-DD
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    closed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    grand_total = Column(Float, nullable=False, default=0.0)
    grand_commission = Column(Float, nullable=False, default=0.0)
    total_paid = Column(Float, nullable=False, default=0.0)
    total_unpaid = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)

    branch = relationship("Branch", foreign_keys=[branch_id])
    closed_by = relationship("User", foreign_keys=[closed_by_id])


class CommissionReceipt(Base):
    """Confirmación de entrega de comisión a una operaria."""
    __tablename__ = "commission_receipts"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), nullable=False, index=True)          # YYYY-MM-DD
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    professional_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    professional_name = Column(String(100), nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    confirmed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    confirmed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    branch = relationship("Branch", foreign_keys=[branch_id])
    professional = relationship("User", foreign_keys=[professional_id])
    confirmed_by = relationship("User", foreign_keys=[confirmed_by_id])
