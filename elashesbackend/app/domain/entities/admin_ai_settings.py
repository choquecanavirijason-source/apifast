from sqlalchemy import Boolean, Column, Integer, String, Text

from app.infrastructure.database import Base


class AdminAiSettings(Base):
    __tablename__ = "admin_ai_settings"

    id = Column(Integer, primary_key=True, default=1)
    ai_enabled = Column(Boolean, nullable=False, default=False)
    ai_api_url = Column(String(500), nullable=True)
    ai_api_token = Column(Text, nullable=True)
    ai_model = Column(String(120), nullable=False, default="gpt-4o-mini")
