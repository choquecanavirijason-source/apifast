from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)

    users = relationship("User", back_populates="branch")
    batches = relationship("Batch", back_populates="branch")
    appointments = relationship("Appointment", back_populates="branch")
    payments = relationship("Payment", back_populates="branch")
    sales = relationship("PosSale", back_populates="branch")
    clients = relationship("Client", back_populates="branch")
    branch_services = relationship("BranchService", back_populates="branch", cascade="all, delete-orphan")