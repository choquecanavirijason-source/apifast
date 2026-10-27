"""
Migracion: canales de los recordatorios manuales (push y/o correo).
  - manual_reminders.send_push (NOT NULL, true): los existentes fueron push.
  - manual_reminders.email_status (NULL = sin correo).
Ejecutar con: python -m app.infrastructure.database.migrations.add_channels_to_manual_reminders
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    if "manual_reminders" not in inspector.get_table_names():
        print("La tabla manual_reminders no existe todavia.")
        return

    true_literal = "1" if engine.dialect.name == "sqlite" else "true"
    columns = {c["name"] for c in inspector.get_columns("manual_reminders")}
    new_columns = [
        ("send_push", f"BOOLEAN NOT NULL DEFAULT {true_literal}"),
        ("email_status", "VARCHAR(20)"),
    ]
    with engine.connect() as conn:
        for name, ddl in new_columns:
            if name in columns:
                print(f"La columna {name} ya existe en manual_reminders.")
                continue
            conn.execute(text(f"ALTER TABLE manual_reminders ADD COLUMN {name} {ddl}"))
            print(f"Columna {name} agregada a manual_reminders.")
        conn.commit()


if __name__ == "__main__":
    upgrade()
