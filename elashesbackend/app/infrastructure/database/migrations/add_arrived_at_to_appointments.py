"""
Migracion: appointments.arrived_at.

Una reserva no aparece en Control de servicios hasta que la clienta llega y desde la Agenda se pulsa
«Llegó» (eso fija arrived_at). Las ventas de mostrador no lo necesitan.
Ejecutar con: python -m app.infrastructure.database.migrations.add_arrived_at_to_appointments
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
    if "arrived_at" in {c["name"] for c in inspector.get_columns("appointments")}:
        print("La columna arrived_at ya existe en appointments.")
        return
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE appointments ADD COLUMN arrived_at TIMESTAMP NULL"))
        conn.commit()
    print("Columna arrived_at agregada a appointments.")


if __name__ == "__main__":
    upgrade()
