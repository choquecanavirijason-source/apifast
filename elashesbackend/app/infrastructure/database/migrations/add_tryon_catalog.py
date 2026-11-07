from sqlalchemy import inspect, text
from app.infrastructure.database import engine, SessionLocal
from app.domain.entities.tryon_style import TryOnStyle, TryOnStyleVersion, TryOnOption, TryOnOptionVersion
from app.application.services.tryon_service import initialize_defaults

def upgrade():
    TryOnStyle.__table__.create(engine,checkfirst=True)
    TryOnStyleVersion.__table__.create(engine,checkfirst=True)
    TryOnOption.__table__.create(engine,checkfirst=True)
    TryOnOptionVersion.__table__.create(engine,checkfirst=True)
    inspector=inspect(engine)
    if inspector.has_table("client_tracking") and "tryon_recipe" not in {c["name"] for c in inspector.get_columns("client_tracking")}:
        with engine.begin() as conn: conn.execute(text("ALTER TABLE client_tracking ADD COLUMN tryon_recipe JSON NULL"))
    with SessionLocal() as db: initialize_defaults(db)
