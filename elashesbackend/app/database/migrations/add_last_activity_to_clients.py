"""
Migración: agrega columna last_activity_at a clients para calcular sin_estado.
"""
from sqlalchemy import text
from app.config.settings import settings
from app.database import engine


def upgrade():
    is_sqlite = settings.database_url.startswith("sqlite")
    with engine.connect() as conn:
        if is_sqlite:
            result = conn.execute(text("PRAGMA table_info(clients)"))
            if not any(row[1] == "last_activity_at" for row in result):
                conn.execute(text(
                    "ALTER TABLE clients ADD COLUMN last_activity_at DATETIME NULL"
                ))
                conn.commit()
                print("Columna last_activity_at agregada a clients.")
        else:
            result = conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'clients' AND column_name = 'last_activity_at'
            """))
            if result.scalar() == 0:
                conn.execute(text(
                    "ALTER TABLE clients ADD COLUMN last_activity_at DATETIME NULL"
                ))
                conn.commit()
                print("Columna last_activity_at agregada a clients.")
