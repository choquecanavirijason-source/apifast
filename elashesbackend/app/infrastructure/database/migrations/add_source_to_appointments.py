"""
Migracion: appointments.source ("reserva" | "mostrador").

La Agenda solo muestra reservas; las ventas directas del POS (mostrador) quedan solo en Control de servicios.
Los tickets que ya existen se clasifican una vez por su hora: si empezaban a +-30 min de cuando se CREARON,
son de mostrador; el resto (y todo lo anterior al registro de ese dato) queda como reserva. Se usa la fecha de
creación y no la de reprogramación, porque esta cambia al asignar operaria o mover el ticket.
Ejecutar con: python -m app.infrastructure.database.migrations.add_source_to_appointments
"""
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.infrastructure.database import engine

WINDOW = timedelta(minutes=30)
LA_PAZ = timedelta(hours=-4)


def _naive(value):
    return value.replace(tzinfo=None) if value is not None and value.tzinfo is not None else value


def upgrade():
    inspector = inspect(engine)
    if "appointments" not in inspector.get_table_names():
        print("La tabla appointments no existe todavia.")
        return
    if "source" in {c["name"] for c in inspector.get_columns("appointments")}:
        print("La columna source ya existe en appointments.")
        return

    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE appointments ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'reserva'"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_appointments_source ON appointments (source)"))
        conn.commit()

        rows = conn.execute(text("SELECT id, start_time, created_at FROM appointments")).fetchall()
        counter_ids = []
        for row in rows:
            start, created = _naive(row[1]), _naive(row[2])
            if start is None or created is None:
                continue
            # start_time va en hora local de La Paz; created_at en UTC.
            if abs(start - (created + LA_PAZ)) <= WINDOW:
                counter_ids.append(row[0])
        for i in range(0, len(counter_ids), 500):
            chunk = counter_ids[i : i + 500]
            conn.execute(
                text("UPDATE appointments SET source = 'mostrador' WHERE id IN (" + ",".join(str(int(x)) for x in chunk) + ")")
            )
        conn.commit()
    print(f"Columna source agregada a appointments ({len(counter_ids)} tickets clasificados como mostrador).")


if __name__ == "__main__":
    upgrade()
