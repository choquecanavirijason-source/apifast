"""
Migracion: agrega appointments.scheduled_at (cuando se fijo por ultima vez
start_time: al crear o reprogramar la cita). Lo usa la regla de "reserva de
ultimo momento" de los avisos programados en vez de created_at.
Ejecutar con: python -m app.infrastructure.database.migrations.add_scheduled_at_to_appointments

UTC naive, igual que created_at. Las citas que ya existen quedan con su
created_at, asi su aviso "hoy" no cambia con la migracion.

SQLite no permite ADD COLUMN con DEFAULT no constante (CURRENT_TIMESTAMP), asi
que ahi la columna queda nullable y se rellena con un UPDATE; el ORM siempre
la completa al crear. MySQL/Postgres la reciben NOT NULL con DEFAULT.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine


def upgrade():
    inspector = inspect(engine)
    if "appointments" not in inspector.get_table_names():
        print("La tabla appointments no existe todavia.")
        return

    columns = {c["name"] for c in inspector.get_columns("appointments")}
    if "scheduled_at" in columns:
        print("La columna scheduled_at ya existe en appointments.")
        return

    dialect = engine.dialect.name
    with engine.connect() as conn:
        if dialect == "sqlite":
            conn.execute(text("ALTER TABLE appointments ADD COLUMN scheduled_at DATETIME"))
        else:
            col_type = "TIMESTAMP" if dialect == "postgresql" else "DATETIME"
            conn.execute(
                text(
                    f"ALTER TABLE appointments ADD COLUMN scheduled_at {col_type} "
                    "NOT NULL DEFAULT CURRENT_TIMESTAMP"
                )
            )
        conn.execute(text("UPDATE appointments SET scheduled_at = created_at"))
        conn.commit()
    print("Columna scheduled_at agregada a appointments (rellenada con created_at).")


if __name__ == "__main__":
    upgrade()
