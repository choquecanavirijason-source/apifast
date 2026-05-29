from sqlalchemy import Column, Integer, String, ForeignKey, Table, Boolean, DateTime, func
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base


role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)

user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)

    permissions = relationship("Permission", secondary=role_permissions)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    skill_level = Column(Integer, nullable=True)  # 1–5 estrellas, NULL = sin nivel asignado

    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    role = relationship("Role")
    branch = relationship("Branch", back_populates="users")
    direct_permissions = relationship("Permission", secondary=user_permissions)

    trackings = relationship("Tracking", back_populates="professional")
    appointments = relationship(
        "Appointment",
        back_populates="professional",
        foreign_keys="Appointment.professional_id",
    )
    created_appointments = relationship(
        "Appointment",
        back_populates="created_by",
        foreign_keys="Appointment.created_by_id",
    )