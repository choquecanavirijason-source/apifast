"""Comunicados: avisos, promociones y novedades que el salón envía desde
Notificaciones > Comunicados a un grupo de clientas (o a todas)."""
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, false, text, true
from sqlalchemy.orm import relationship

from app.infrastructure.database import Base

BROADCAST_TITLE_MAX_LENGTH = 80
BROADCAST_BODY_MAX_LENGTH = 500

KIND_AVISO = "aviso"
KIND_PROMOCION = "promocion"
KIND_NOVEDAD = "novedad"
BROADCAST_KINDS = (KIND_AVISO, KIND_PROMOCION, KIND_NOVEDAD)
# Promociones y novedades son publicidad: no les llegan a las clientas con el
# interruptor "Notificaciones" apagado. Un aviso (cierre, cambio de horario...) sí.
MARKETING_KINDS = (KIND_PROMOCION, KIND_NOVEDAD)

AUDIENCE_ALL = "all"
AUDIENCE_UPCOMING_APPOINTMENT = "upcoming_appointment"
AUDIENCE_RETOUCH_DUE = "retouch_due"
AUDIENCE_INACTIVE = "inactive"
# Clientas elegidas una por una en el panel (broadcast_recipients guarda cuáles).
AUDIENCE_SELECTED = "selected"
BROADCAST_AUDIENCES = (
    AUDIENCE_ALL, AUDIENCE_UPCOMING_APPOINTMENT, AUDIENCE_RETOUCH_DUE, AUDIENCE_INACTIVE, AUDIENCE_SELECTED,
)
MAX_SELECTED_CLIENTS = 500

# Resultado por clienta y canal en broadcast_recipients; NULL = aún no se
# procesó (o no se pidió ese canal).
DELIVERY_SENT = "sent"
DELIVERY_FAILED = "failed"
DELIVERY_NO_APP = "no_app"
DELIVERY_NO_EMAIL = "no_email"

STATUS_SENDING = "sending"
STATUS_SENT = "sent"
# El servidor se reinició a mitad del envío (ver mark_interrupted_broadcasts).
STATUS_INTERRUPTED = "interrupted"


class Broadcast(Base):
    __tablename__ = "broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String(20), nullable=False)
    title = Column(String(BROADCAST_TITLE_MAX_LENGTH), nullable=False)
    body = Column(String(BROADCAST_BODY_MAX_LENGTH), nullable=False)
    # Ruta pública /media/broadcasts/... (ver core.media).
    image_url = Column(String(255), nullable=True)

    # Grupo elegido en el panel. La lista exacta queda en broadcast_recipients.
    audience = Column(String(30), nullable=False)
    audience_days = Column(Integer, nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)

    send_push = Column(Boolean, nullable=False, default=True, server_default=true())
    send_email = Column(Boolean, nullable=False, default=False, server_default=false())
    email_from = Column(String(255), nullable=True)

    status = Column(String(20), nullable=False, default=STATUS_SENDING, index=True)
    recipients_count = Column(Integer, nullable=False, default=0, server_default="0")
    # Push: por dispositivo. Correo: por clienta.
    push_sent = Column(Integer, nullable=False, default=0, server_default="0")
    push_failed = Column(Integer, nullable=False, default=0, server_default="0")
    email_sent = Column(Integer, nullable=False, default=0, server_default="0")
    email_failed = Column(Integer, nullable=False, default=0, server_default="0")

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # UTC naive, como el resto de created_at.
    created_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, server_default=text("CURRENT_TIMESTAMP")
    )
    finished_at = Column(DateTime, nullable=True)

    branch = relationship("Branch")
    author = relationship("User")


class BroadcastRecipient(Base):
    """A quién se le envió cada comunicado y cómo le fue por canal (detalle
    del panel y bandeja de la app)."""

    __tablename__ = "broadcast_recipients"

    broadcast_id = Column(Integer, ForeignKey("broadcasts.id", ondelete="CASCADE"), primary_key=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), primary_key=True, index=True)
    # sent / failed / no_app (push) y sent / failed / no_email (correo).
    push_status = Column(String(20), nullable=True)
    email_status = Column(String(20), nullable=True)

    client = relationship("Client")
