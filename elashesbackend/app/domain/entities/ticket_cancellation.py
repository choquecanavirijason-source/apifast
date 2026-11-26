from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base


class TicketCancellation(Base):
    """Cada cancelación de un ticket o de una venta: quién, por qué y qué pasó con el dinero.

    - `reason`: motivo escrito por quien canceló (obligatorio).
    - `amount`: lo cobrado que correspondía a lo cancelado (0 si no había cobro).
    - `refunded`: True = se devolvió el dinero a la clienta (sale del cuadre de caja);
      False = no se devolvió (el dinero se queda en caja y el cuadre lo sigue contando).
    """
    __tablename__ = "ticket_cancellations"

    id = Column(Integer, primary_key=True, index=True)
    # SET NULL: si algún día se elimina el ticket o la venta, el registro de la cancelación se conserva.
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)
    sale_id = Column(Integer, ForeignKey("pos_sales.id", ondelete="SET NULL"), nullable=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    scope = Column(String(10), nullable=False, default="ticket")  # "ticket" | "sale"
    reason = Column(Text, nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    refunded = Column(Boolean, nullable=False, default=False)
    refund_method = Column(String(30), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    user = relationship("User", foreign_keys=[user_id])
    appointment = relationship("Appointment", foreign_keys=[appointment_id])
    sale = relationship("PosSale", foreign_keys=[sale_id])
