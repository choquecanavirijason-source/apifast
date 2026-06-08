from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.infrastructure.database import Base


class CommissionPayment(Base):
    __tablename__ = "commission_payments"

    id = Column(Integer, primary_key=True, index=True)
    professional_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    period_start = Column(String(10), nullable=True)   # YYYY-MM-DD
    period_end = Column(String(10), nullable=True)     # YYYY-MM-DD
    notes = Column(String(500), nullable=True)
    registered_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    registered_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    professional = relationship("User", foreign_keys=[professional_id])
    registered_by = relationship("User", foreign_keys=[registered_by_id])
