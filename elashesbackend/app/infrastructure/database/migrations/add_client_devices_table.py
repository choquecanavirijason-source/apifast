"""
Migracion: crea la tabla client_devices (instalaciones de la app de clientas
con su token hasheado, para los avisos programados).
Ejecutar con: python -m app.infrastructure.database.migrations.add_client_devices_table

Se crea desde la definicion de la entidad (checkfirst) para que el DDL sea
valido en SQLite, MySQL y Postgres sin ramas por dialecto.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect

from app.domain.entities.client import Client  # noqa: F401  (FK clients.id)
from app.domain.entities.client_device import ClientDevice
from app.infrastructure.database import engine


def upgrade():
    if "client_devices" in inspect(engine).get_table_names():
        print("La tabla client_devices ya existe.")
        return
    ClientDevice.__table__.create(bind=engine, checkfirst=True)
    print("Tabla client_devices creada.")


if __name__ == "__main__":
    upgrade()
