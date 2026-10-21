"""
Migracion: client_devices.fcm_token (indexada) y fcm_token_updated_at, para
enviar recordatorios por Firebase Cloud Messaging con la app cerrada.
Ejecutar con: python -m app.infrastructure.database.migrations.add_fcm_token_to_client_devices

Columnas nullable: los dispositivos existentes quedan sin token hasta que la
app lo registre (PUT /dispositivos/actual/fcm-token).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent.parent))

from sqlalchemy import inspect, text

from app.domain.entities.client_device import FCM_TOKEN_MAX_LENGTH
from app.infrastructure.database import engine

INDEX_NAME = "ix_client_devices_fcm_token"


def upgrade():
    inspector = inspect(engine)
    if "client_devices" not in inspector.get_table_names():
        print("La tabla client_devices no existe todavia.")
        return

    columns = {c["name"] for c in inspector.get_columns("client_devices")}
    indexes = {ix["name"] for ix in inspector.get_indexes("client_devices")}
    datetime_type = "TIMESTAMP" if engine.dialect.name == "postgresql" else "DATETIME"

    with engine.connect() as conn:
        if "fcm_token" not in columns:
            conn.execute(
                text(f"ALTER TABLE client_devices ADD COLUMN fcm_token VARCHAR({FCM_TOKEN_MAX_LENGTH})")
            )
            print("Columna fcm_token agregada a client_devices.")
        else:
            print("La columna fcm_token ya existe en client_devices.")

        if "fcm_token_updated_at" not in columns:
            conn.execute(
                text(f"ALTER TABLE client_devices ADD COLUMN fcm_token_updated_at {datetime_type}")
            )
            print("Columna fcm_token_updated_at agregada a client_devices.")
        else:
            print("La columna fcm_token_updated_at ya existe en client_devices.")

        if INDEX_NAME not in indexes:
            conn.execute(text(f"CREATE INDEX {INDEX_NAME} ON client_devices (fcm_token)"))
            print(f"Indice {INDEX_NAME} creado.")
        else:
            print(f"Ya existe el indice {INDEX_NAME}.")

        conn.commit()


if __name__ == "__main__":
    upgrade()
