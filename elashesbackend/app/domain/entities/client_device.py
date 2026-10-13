from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base

PLATFORM_ANDROID = "android"
PLATFORM_IOS = "ios"
DEVICE_PLATFORMS = (PLATFORM_ANDROID, PLATFORM_IOS)


class ClientDevice(Base):
    """Instalación de la app de una clienta. Solo se guarda el hash SHA-256 del
    token (el token en claro se entrega una única vez al registrar)."""

    __tablename__ = "client_devices"
    __table_args__ = (
        CheckConstraint("platform IN ('android', 'ios')", name="ck_client_devices_platform"),
    )

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(
        Integer,
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    installation_id = Column(String(128), unique=True, nullable=False)
    token_hash = Column(String(64), unique=True, nullable=False)  # SHA-256 hex
    platform = Column(String(10), nullable=False)
    created_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP")
    )
    last_seen_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    client = relationship("Client", back_populates="devices")
