from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class OperatorBonus(Base):
    """Pago extra / bono a una operaria (incentivos, metas...). Se registra en
    Corte de Caja y cuenta como egreso en su total (ver reports/cash-summary)."""

    __tablename__ = "operator_bonuses"

    id = Column(Integer, primary_key=True, index=True)
    professional_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Sucursal de la caja de la que salió (filtro del Corte de Caja).
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    amount = Column(Float, nullable=False)
    bonus_date = Column(Date, nullable=False, index=True)  # fecha del pago (puede no ser hoy)
    reason = Column(String(300), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    professional = relationship("User", foreign_keys=[professional_id])
    branch = relationship("Branch")
    created_by = relationship("User", foreign_keys=[created_by_id])
