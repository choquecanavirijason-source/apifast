from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from app.database import Base


class ServiceCategory(Base):
    __tablename__ = "service_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    image_url = Column(Text, nullable=True)
    is_mobile = Column(Boolean, nullable=False, default=False)

    services = relationship("Service", back_populates="category")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    image_url = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("service_categories.id"), nullable=True)
    duration_minutes = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)

    category = relationship("ServiceCategory", back_populates="services")
    appointments = relationship("Appointment", back_populates="service")
    branch_services = relationship("BranchService", back_populates="service", cascade="all, delete-orphan")
    appointment_services = relationship("AppointmentService", back_populates="service", cascade="all, delete-orphan")

    @property
    def branch_ids(self):
        return [item.branch_id for item in self.branch_services if item.is_active]


class BranchService(Base):
    __tablename__ = "branch_services"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    branch = relationship("Branch", back_populates="branch_services")
    service = relationship("Service", back_populates="branch_services")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_code = Column(String(50), unique=True, index=True, nullable=True)  # TKT-YYYYMMDD-XXXX
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    professional_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    sale_id = Column(Integer, ForeignKey("pos_sales.id"), nullable=True)
    is_ia = Column(Boolean, nullable=False, default=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending, completed, cancelled

    client = relationship("Client", back_populates="appointments")
    created_by = relationship(
        "User",
        back_populates="created_appointments",
        foreign_keys=[created_by_id],
    )
    professional = relationship(
        "User",
        back_populates="appointments",
        foreign_keys=[professional_id],
    )
    service = relationship("Service", back_populates="appointments")
    appointment_services = relationship("AppointmentService", back_populates="appointment", cascade="all, delete-orphan")
    branch = relationship("Branch", back_populates="appointments")
    sale = relationship("PosSale", back_populates="appointments")

    @property
    def service_ids(self):
        return [item.service_id for item in self.appointment_services]

    @property
    def services(self):
        return [item.service for item in self.appointment_services]


class AppointmentService(Base):
    __tablename__ = "appointment_services"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)

    appointment = relationship("Appointment", back_populates="appointment_services")
    service = relationship("Service", back_populates="appointment_services")