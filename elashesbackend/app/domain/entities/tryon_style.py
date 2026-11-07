from datetime import datetime
from sqlalchemy import Column, String, Integer, JSON, DateTime, ForeignKey, UniqueConstraint
from app.infrastructure.database import Base

class TryOnStyle(Base):
    __tablename__ = "tryon_styles"
    key = Column(String(64), primary_key=True)
    draft = Column(JSON, nullable=False)
    revision = Column(Integer, nullable=False, default=1)
    published = Column(JSON, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class TryOnStyleVersion(Base):
    __tablename__ = "tryon_style_versions"
    __table_args__ = (UniqueConstraint("style_key", "revision", name="uq_tryon_style_revision"),)
    id = Column(Integer, primary_key=True)
    style_key = Column(String(64), ForeignKey("tryon_styles.key"), nullable=False, index=True)
    revision = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)
    published_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class TryOnOption(Base):
    __tablename__ = "tryon_options"
    key = Column(String(40), primary_key=True)
    kind = Column(String(16), nullable=False, index=True)
    draft = Column(JSON, nullable=False)
    revision = Column(Integer, nullable=False, default=1)
    published = Column(JSON, nullable=True)

class TryOnOptionVersion(Base):
    __tablename__ = "tryon_option_versions"
    __table_args__ = (UniqueConstraint("option_key", "revision", name="uq_tryon_option_revision"),)
    id = Column(Integer, primary_key=True)
    option_key = Column(String(40), ForeignKey("tryon_options.key"), nullable=False)
    revision = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)
