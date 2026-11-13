from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base

KIND_BIRTHDAY = "birthday"


class BirthdayCouponConfig(Base):
    """Configuración (una sola fila, id=1) del cupón de cumpleaños. La define el
    administrador. Nace DESACTIVADA y sin porcentaje: no se ofrece nada hasta que se
    configure."""

    __tablename__ = "birthday_coupon_config"

    id = Column(Integer, primary_key=True, default=1)
    enabled = Column(Boolean, nullable=False, default=False)
    # Descuento en % sobre la venta (0 < percent <= 100 cuando está activo).
    percent = Column(Float, nullable=False, default=0)
    # Días antes y después del cumpleaños en que vale (0 = solo el día).
    window_days = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class CouponRedemption(Base):
    """Uso de un cupón en una venta. Una clienta puede usar el de cumpleaños UNA vez por
    cumpleaños (cycle_year = año del cumpleaños que se canjeó). Si la venta se cancela o
    se elimina, el uso se borra y el cupón queda libre otra vez."""

    __tablename__ = "coupon_redemptions"
    __table_args__ = (UniqueConstraint("client_id", "kind", "cycle_year", name="uq_coupon_client_kind_year"),)

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String(20), nullable=False, default=KIND_BIRTHDAY)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_id = Column(Integer, ForeignKey("pos_sales.id", ondelete="CASCADE"), nullable=True, index=True)
    cycle_year = Column(Integer, nullable=False)
    percent = Column(Float, nullable=False)
    discount_amount = Column(Float, nullable=False, default=0)
    applied_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    client = relationship("Client")
    sale = relationship("PosSale", back_populates="redemptions")
    applied_by = relationship("User", foreign_keys=[applied_by_id])
