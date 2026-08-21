from sqlalchemy import Column, Integer, Float, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.infrastructure.database import Base


class Expense(Base):
    """Gasto de caja registrado por sucursal (ver Corte de Caja / Caja en
    Salones) — combustible, insumos, pequeños pagos en efectivo, etc."""
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    description = Column(String(500), nullable=False)
    expense_date = Column(Date, nullable=False)  # fecha del gasto (puede no ser hoy)
    photo_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    branch = relationship("Branch")
    created_by = relationship("User", foreign_keys=[created_by_id])
