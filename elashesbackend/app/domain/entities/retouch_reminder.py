"""One manual dispatch per tracking/type/target day, persisted atomically."""
from sqlalchemy import Column, ForeignKey, Integer, String

from app.infrastructure.database import Base


class RetouchReminder(Base):
    __tablename__ = "retouch_reminders"

    # Server-derived event key; uniqueness also covers concurrent requests.
    event_key = Column(String(64), primary_key=True)
    broadcast_id = Column(Integer, ForeignKey("broadcasts.id"), nullable=False, unique=True)
    preview_version = Column(String(64), nullable=False)
