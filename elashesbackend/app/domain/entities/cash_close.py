from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base


class CashClose(Base):
    """Sesión de caja por sucursal: se abre con un monto inicial y queda
    'open' hasta que alguien la cierra (ver Salones → Caja → Apertura y
    Cierre). Mientras no haya una sesión abierta para una sucursal, el POS
    no deja registrar ventas ahí (ver pos_sale_service.create_sale)."""
    __tablename__ = "cash_closes"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String(10), nullable=False, index=True)          # YYYY-MM-DD (fecha de apertura)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    status = Column(String(10), nullable=False, default="open")    # "open" | "closed"

    opened_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    opened_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    opening_amount = Column(Float, nullable=True)

    closed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime, nullable=True)
    grand_total = Column(Float, nullable=False, default=0.0)      # ventas de TODOS los métodos (informativo)
    grand_commission = Column(Float, nullable=False, default=0.0)
    total_paid = Column(Float, nullable=False, default=0.0)
    total_unpaid = Column(Float, nullable=False, default=0.0)

    # Arqueo de caja: solo efectivo (lo único que físicamente entra/sale de
    # la caja) — inicial + ventas efectivo - gastos efectivo = esperado,
    # comparado contra lo que la cajera contó al cerrar.
    cash_sales = Column(Float, nullable=True)
    cash_expenses = Column(Float, nullable=True)
    expected_cash = Column(Float, nullable=True)
    counted_amount = Column(Float, nullable=True)
    difference = Column(Float, nullable=True)   # counted_amount - expected_cash

    notes = Column(Text, nullable=True)

    branch = relationship("Branch", foreign_keys=[branch_id])
    opened_by = relationship("User", foreign_keys=[opened_by_id])
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
