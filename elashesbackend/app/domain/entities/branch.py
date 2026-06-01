from sqlalchemy import Column, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    opening_hours = Column(JSON, nullable=True)
    integration_profile_id = Column(Integer, ForeignKey("branch_integration_profiles.id"), nullable=True)

    integration_profile = relationship("BranchIntegrationProfile", back_populates="branches")
    users = relationship("User", foreign_keys="User.branch_id", back_populates="branch")
    batches = relationship("Batch", back_populates="branch")
    appointments = relationship("Appointment", back_populates="branch")
    payments = relationship("Payment", back_populates="branch")
    sales = relationship("PosSale", back_populates="branch")
    clients = relationship("Client", back_populates="branch")
    branch_services = relationship("BranchService", back_populates="branch", cascade="all, delete-orphan")