from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, text, true
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base

MANUAL_REMINDER_MAX_LENGTH = 200

EMAIL_SENT = "sent"
# La clienta no tiene correo registrado.
EMAIL_NO_ADDRESS = "no_email"
# Falta la configuración SMTP del servidor.
EMAIL_NOT_CONFIGURED = "not_configured"
# El servidor SMTP lo rechazó o no respondió.
EMAIL_FAILED = "failed"
EMAIL_STATUSES = (EMAIL_SENT, EMAIL_NO_ADDRESS, EMAIL_NOT_CONFIGURED, EMAIL_FAILED)


class ManualReminder(Base):
    """Recordatorio que el salón envía a mano desde el panel (Atención >
    Próximas citas). Llega a la app como aviso "recordatorio_manual" en
    /avisos/programados y, si está conectada, por el WebSocket de la clienta."""

    __tablename__ = "manual_reminders"

    id = Column(Integer, primary_key=True, index=True)
    # CASCADE: borrar la cita o la clienta borra sus recordatorios (si no, el
    # FK bloquearía el borrado en Postgres).
    appointment_id = Column(
        Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id = Column(
        Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    message = Column(String(MANUAL_REMINDER_MAX_LENGTH), nullable=False)
    sent_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # Canales elegidos en el panel. send_push=False: no llega a la app (ni
    # WebSocket, ni FCM, ni /avisos/programados); solo queda en el historial.
    send_push = Column(Boolean, nullable=False, default=True, server_default=true())
    # Resultado del correo (ver EMAIL_STATUSES); NULL = no se pidió correo.
    email_status = Column(String(20), nullable=True)
    # UTC naive, como appointments.created_at.
    created_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP")
    )

    appointment = relationship("Appointment")
    sender = relationship("User")
