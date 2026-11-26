from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    address = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    country_code = Column(String(2), nullable=True)
    opening_hours = Column(JSON, nullable=True)
    # Imagen del QR de pago como data URL (se sube como archivo, ver set_branch_qr).
    qr_image_url = Column(Text, nullable=True)
    # Quién y cuándo cambió el QR por última vez (el detalle queda en audit_logs).
    qr_updated_at = Column(DateTime(timezone=True), nullable=True)
    # use_alter: branches y users se referencian entre sí (users.branch_id); la clave se crea aparte
    # para no formar un ciclo al crear/borrar las tablas.
    qr_updated_by_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_branches_qr_updated_by"),
        nullable=True,
    )
    maps_url = Column(String(1024), nullable=True)
    integration_profile_id = Column(Integer, ForeignKey("branch_integration_profiles.id"), nullable=True)

    qr_updated_by = relationship("User", foreign_keys=[qr_updated_by_id])

    @property
    def qr_updated_by_name(self):
        return self.qr_updated_by.username if self.qr_updated_by else None

    integration_profile = relationship("BranchIntegrationProfile", back_populates="branches")
    users = relationship("User", foreign_keys="User.branch_id", back_populates="branch")
    batches = relationship("Batch", back_populates="branch")
    appointments = relationship("Appointment", back_populates="branch")
    payments = relationship("Payment", back_populates="branch")
    sales = relationship("PosSale", back_populates="branch")
    clients = relationship("Client", back_populates="branch")
    branch_services = relationship("BranchService", back_populates="branch", cascade="all, delete-orphan")