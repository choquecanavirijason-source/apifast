from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base


class Tecnologia(Base):
    """Catálogo de tecnologías de aplicación (ej. clásico, híbrido, mega volumen)."""
    __tablename__ = "tecnologias"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    image = Column(String(500), nullable=True)


class DisenoFinal(Base):
    """Combinación única de Tecnología + Efecto + Tipo de ojo + Volumen,
    guardada como un diseño reutilizable con nombre propio."""
    __tablename__ = "disenos_finales"

    id = Column(Integer, primary_key=True, index=True)
    nombre_unico = Column(String(150), unique=True, nullable=False)
    tecnologia_id = Column(Integer, ForeignKey("tecnologias.id"), nullable=False)
    efecto_id = Column(Integer, ForeignKey("effects.id"), nullable=False)
    tipo_ojo_id = Column(Integer, ForeignKey("eye_types.id"), nullable=False)
    volumen_id = Column(Integer, ForeignKey("volumes.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    tecnologia = relationship("Tecnologia")
    efecto = relationship("Effect")
    tipo_ojo = relationship("EyeType")
    volumen = relationship("Volume")
    guardados = relationship(
        "DisenoGuardado", back_populates="diseno_final", cascade="all, delete-orphan"
    )


class DisenoGuardado(Base):
    """Diseño final guardado para una clienta (lo hace el staff desde el
    admin, ej. durante una consulta), con la fecha en que se guardó."""
    __tablename__ = "disenos_guardados"
    __table_args__ = (
        UniqueConstraint("client_id", "diseno_final_id", name="uq_client_diseno_final"),
    )

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    diseno_final_id = Column(
        Integer, ForeignKey("disenos_finales.id", ondelete="CASCADE"), nullable=False
    )
    fecha_guardado = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship("Client")
    diseno_final = relationship("DisenoFinal", back_populates="guardados")
