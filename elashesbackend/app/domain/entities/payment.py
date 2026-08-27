from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    sale_id = Column(Integer, ForeignKey("pos_sales.id"), nullable=True)
    registered_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Quien registró el pago

    amount = Column(Float, nullable=False)
    method = Column(String(50), nullable=False)   # cash, card, transfer, qr
    status = Column(String(30), default="paid", nullable=False)
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)  # Observaciones adicionales
    paid_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    # Solo para method="cash": cuánto entregó físicamente la clienta y el
    # vuelto calculado (cash_received - amount) — para que quede registrado
    # en el comprobante y no solo mental en la cajera.
    cash_received = Column(Float, nullable=True)
    cash_change = Column(Float, nullable=True)

    client = relationship("Client", back_populates="payments")
    branch = relationship("Branch", back_populates="payments")
    sale = relationship("PosSale", back_populates="payments")
    registered_by = relationship("User", foreign_keys=[registered_by_id])