from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base

MANUAL_REMINDER_MAX_LENGTH = 200


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
    # UTC naive, como appointments.created_at.
    created_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP")
    )

    appointment = relationship("Appointment")
    sender = relationship("User")
