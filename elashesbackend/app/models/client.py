from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

# Valores válidos de status de cliente
CLIENT_STATUS_EN_SERVICIO = "en_servicio"
CLIENT_STATUS_EN_ESPERA = "en_espera"
CLIENT_STATUS_PAGADO = "pagado"
CLIENT_STATUS_RESERVA = "reserva"
CLIENT_STATUS_FINALIZADO = "finalizado"
CLIENT_STATUS_SIN_ESTADO = "sin_estado"


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True, nullable=False)
    last_name = Column(String(100), index=True, nullable=False)
    age = Column(Integer, nullable=True)
    phone = Column(String(20), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    eye_type_id = Column(Integer, ForeignKey("eye_types.id"), nullable=True)
    status = Column(String(32), nullable=False, default=CLIENT_STATUS_EN_ESPERA)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)

    eye_type = relationship("EyeType", back_populates="clients")
    branch = relationship("Branch", back_populates="clients")
    trackings = relationship("Tracking", back_populates="client", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="client", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="client", cascade="all, delete-orphan")
    sales = relationship("PosSale", back_populates="client", cascade="all, delete-orphan")