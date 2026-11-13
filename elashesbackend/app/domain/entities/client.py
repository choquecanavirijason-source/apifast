from sqlalchemy import Boolean, Column, Date, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base

# Valores válidos de status de cliente
CLIENT_STATUS_EN_SERVICIO = "en_servicio"
CLIENT_STATUS_EN_ESPERA = "en_espera"
CLIENT_STATUS_PAGADO = "pagado"
CLIENT_STATUS_RESERVA = "reserva"
CLIENT_STATUS_FINALIZADO = "finalizado"
CLIENT_STATUS_SIN_ESTADO = "sin_estado"

# Clienta genérica de cada sucursal ("Cliente Mostrador"): la comparten todas las
# personas que compran sin registrarse, así que NUNCA lleva datos personales.
GENERIC_CLIENT_CI = "SISTEMA-MOSTRADOR"


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True, nullable=False)
    last_name = Column(String(100), index=True, nullable=False)
    age = Column(Integer, nullable=True)
    # Fecha de nacimiento (opcional): de ella sale la edad y el cupón de cumpleaños.
    birth_date = Column(Date, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    eye_type_id = Column(Integer, ForeignKey("eye_types.id"), nullable=True)
    status = Column(String(32), nullable=False, default=CLIENT_STATUS_SIN_ESTADO)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    ci = Column(String(20), nullable=True)
    # Alergias especificas a algun producto (texto libre): se muestra en el
    # ticket y en la app de operarias para que quien atiende lo sepa.
    allergies = Column(String(500), nullable=True)
    # Cuándo el personal le confirmó las alergias (aunque no tenga). None = nadie
    # le ha preguntado: se pregunta al iniciar su atención.
    allergies_checked_at = Column(DateTime(timezone=True), nullable=True)
    marketplace_enabled = Column(Boolean, nullable=False, default=True)
    # Avisos de mantenimiento/retiro (app y WebSocket). Los avisos de citas
    # ("manana"/"hoy") no dependen de esto. Se cambia desde el panel
    # (PATCH /clients/{id}/notificaciones).
    notificaciones_activas = Column(Boolean, nullable=False, default=True)

    @property
    def allergies_confirmed(self) -> bool:
        return self.allergies_checked_at is not None

    @property
    def is_generic(self) -> bool:
        return self.ci == GENERIC_CLIENT_CI

    eye_type = relationship("EyeType", back_populates="clients")
    branch = relationship("Branch", back_populates="clients")
    trackings = relationship("Tracking", back_populates="client", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="client", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="client", cascade="all, delete-orphan")
    sales = relationship("PosSale", back_populates="client", cascade="all, delete-orphan")
    # ON DELETE CASCADE en la BD; passive_deletes evita cargar los dispositivos al borrar.
    devices = relationship(
        "ClientDevice", back_populates="client", cascade="all, delete-orphan", passive_deletes=True
    )