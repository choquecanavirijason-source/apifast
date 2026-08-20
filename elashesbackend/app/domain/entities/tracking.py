from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from app.infrastructure.database import Base


class EyeType(Base):
    __tablename__ = "eye_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    image = Column(Text, nullable=True)
    model_3d_url = Column(String(500), nullable=True)
    model_3d_filename = Column(String(255), nullable=True)

    clients = relationship("Client", back_populates="eye_type")
    trackings = relationship("Tracking", back_populates="eye_type")


class Effect(Base):
    __tablename__ = "effects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    image = Column(Text, nullable=True)
    model_3d_url = Column(String(500), nullable=True)
    model_3d_filename = Column(String(255), nullable=True)

    trackings = relationship("Tracking", back_populates="effect")


class Volume(Base):
    __tablename__ = "volumes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    image = Column(Text, nullable=True)
    model_3d_url = Column(String(500), nullable=True)
    model_3d_filename = Column(String(255), nullable=True)

    trackings = relationship("Tracking", back_populates="volume")


class LashDesign(Base):
    __tablename__ = "lash_designs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    image = Column(Text, nullable=True)
    model_3d_url = Column(String(500), nullable=True)
    model_3d_filename = Column(String(255), nullable=True)

    trackings = relationship("Tracking", back_populates="lash_design")


class Design(Base):
    """Combinaciones sugeridas (efecto + tipo de ojo + diseño) con imagen de
    referencia y modelo 3D opcional, mostradas en la página "Diseños" del admin."""
    __tablename__ = "designs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    effect = Column(String(255), nullable=True)
    eye_type = Column(String(255), nullable=True)
    lash_design = Column(String(255), nullable=True)
    volume = Column(String(255), nullable=True)
    note = Column(Text, nullable=True)
    image = Column(Text, nullable=True)
    model_3d_url = Column(String(500), nullable=True)
    model_3d_filename = Column(String(255), nullable=True)


class Questionnaire(Base):
    __tablename__ = "questionnaires"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    questions = relationship("Question", back_populates="questionnaire", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    questionnaire_id = Column(Integer, ForeignKey("questionnaires.id"), nullable=False)
    text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)  # text, number, bool, select, multi_select
    is_required = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)

    questionnaire = relationship("Questionnaire", back_populates="questions")


class Tracking(Base):
    __tablename__ = "client_tracking"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    professional_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    eye_type_id = Column(Integer, ForeignKey("eye_types.id"), nullable=True)
    effect_id = Column(Integer, ForeignKey("effects.id"), nullable=True)
    volume_id = Column(Integer, ForeignKey("volumes.id"), nullable=True)
    lash_design_id = Column(Integer, ForeignKey("lash_designs.id"), nullable=True)
    questionnaire_id = Column(Integer, ForeignKey("questionnaires.id"), nullable=True)

    design_notes = Column(String(255), nullable=True)
    last_application_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    questionnaire_responses = Column(JSON, nullable=True)
    # Calculadas al crear/editar el tracking, a partir de si la categoría del
    # servicio de la cita tiene mantenimiento/retiro activado y sus días
    # configurados (ver tracking_service._resolve_next_dates). Null si la
    # categoría no tiene esa opción activada.
    next_maintenance_date = Column(DateTime, nullable=True)
    next_removal_date = Column(DateTime, nullable=True)
    # True una vez que el chequeo diario ya generó el aviso "se acerca tu
    # mantenimiento/retiro" para esta fecha — evita reenviarlo cada día
    # mientras la fecha objetivo sigue dentro de la ventana de aviso.
    maintenance_reminder_sent = Column(Boolean, default=False, nullable=False)
    removal_reminder_sent = Column(Boolean, default=False, nullable=False)

    client = relationship("Client", back_populates="trackings")
    appointment = relationship("Appointment")
    branch = relationship("Branch")
    professional = relationship("User", back_populates="trackings")
    eye_type = relationship("EyeType", back_populates="trackings")
    effect = relationship("Effect", back_populates="trackings")
    volume = relationship("Volume", back_populates="trackings")
    lash_design = relationship("LashDesign", back_populates="trackings")
    questionnaire = relationship("Questionnaire")