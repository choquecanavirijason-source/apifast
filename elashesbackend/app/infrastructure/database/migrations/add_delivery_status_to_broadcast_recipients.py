"""
Migracion: resultado por clienta de cada comunicado.
  - broadcast_recipients.push_status (sent / failed / no_app; NULL = sin procesar).
  - broadcast_recipients.email_status (sent / failed / no_email; NULL = sin procesar).
Ejecutar con: python -m app.infrastructure.database.migrations.add_delivery_status_to_broadcast_recipients
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine

TABLE = "broadcast_recipients"


def upgrade():
    inspector = inspect(engine)
    if TABLE not in inspector.get_table_names():
        print(f"La tabla {TABLE} no existe todavia.")
        return

    columns = {c["name"] for c in inspector.get_columns(TABLE)}
    with engine.connect() as conn:
        for name in ("push_status", "email_status"):
            if name in columns:
                print(f"La columna {name} ya existe en {TABLE}.")
                continue
            conn.execute(text(f"ALTER TABLE {TABLE} ADD COLUMN {name} VARCHAR(20)"))
            print(f"Columna {name} agregada a {TABLE}.")
        conn.commit()


if __name__ == "__main__":
    upgrade()
