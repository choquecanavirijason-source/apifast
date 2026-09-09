from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base


class AuditLog(Base):
    """Registro de acciones sensibles del sistema (crear/editar/eliminar/cancelar)
    para que Admin/Secretaria puedan auditar qué hizo cada usuario. Ver
    app/core/audit.py para cómo se generan estos registros."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(20), nullable=False, index=True)  # create | update | delete | cancel
    entity_type = Column(String(50), nullable=False, index=True)  # ej. "service", "appointment", "pos_sale"
    entity_id = Column(Integer, nullable=True)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)

    user = relationship("User", foreign_keys=[user_id])
    branch = relationship("Branch", foreign_keys=[branch_id])
