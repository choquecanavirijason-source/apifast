from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, text

from app.infrastructure.database import Base


class ReminderEmailSender(Base):
    """Remitente extra para los recordatorios por correo, agregado desde el
    panel (Próximas citas). Se suma a SMTP_FROM_EMAIL y SMTP_ALLOWED_FROM del
    .env; con Gmail debe estar verificado como "Enviar correo como" en la
    cuenta de SMTP_USERNAME o Gmail lo reemplaza por esa cuenta."""

    __tablename__ = "reminder_email_senders"

    id = Column(Integer, primary_key=True, index=True)
    # Guardado en minúsculas: la comparación de remitentes no distingue mayúsculas.
    email = Column(String(255), nullable=False, unique=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # UTC naive, como el resto de created_at.
    created_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP")
    )
