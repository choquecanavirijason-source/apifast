"""
Migracion: agrega clients.notificaciones_activas (por defecto true) para poder
silenciar los avisos de mantenimiento/retiro de una clienta desde el panel.
Ejecutar con: python -m app.infrastructure.database.migrations.add_notificaciones_activas_to_clients
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    if "clients" not in inspector.get_table_names():
        print("La tabla clients no existe todavia.")
        return

    columns = {c["name"] for c in inspector.get_columns("clients")}
    if "notificaciones_activas" in columns:
        print("La columna notificaciones_activas ya existe en clients.")
        return

    dialect = engine.dialect.name
    if dialect == "postgresql":
        col_def = "BOOLEAN NOT NULL DEFAULT TRUE"
    elif dialect == "sqlite":
        col_def = "BOOLEAN NOT NULL DEFAULT 1"
    else:
        col_def = "TINYINT(1) NOT NULL DEFAULT 1"

    with engine.connect() as conn:
        conn.execute(text(f"ALTER TABLE clients ADD COLUMN notificaciones_activas {col_def}"))
        conn.commit()
    print("Columna notificaciones_activas agregada a clients.")


if __name__ == "__main__":
    upgrade()
