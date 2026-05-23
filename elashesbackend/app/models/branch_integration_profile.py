from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class BranchIntegrationProfile(Base):
    __tablename__ = "branch_integration_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    is_shared = Column(Boolean, nullable=False, default=True)

    whatsapp_enabled = Column(Boolean, nullable=False, default=False)
    whatsapp_provider = Column(String(30), nullable=False, default="webhook")
    whatsapp_api_url = Column(String(500), nullable=True)
    whatsapp_api_token = Column(Text, nullable=True)
    whatsapp_phone_number_id = Column(String(120), nullable=True)

    ai_api_url = Column(String(500), nullable=True)
    ai_api_token = Column(Text, nullable=True)

    branches = relationship("Branch", back_populates="integration_profile")
