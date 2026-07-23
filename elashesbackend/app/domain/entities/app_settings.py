from sqlalchemy import Column, Integer, String

from app.infrastructure.database import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, default=1)
    logo_url = Column(String(500), nullable=True)
    logo_original_name = Column(String(255), nullable=True)
