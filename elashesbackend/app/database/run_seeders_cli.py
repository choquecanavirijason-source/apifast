"""
Ejecutar seeders sin levantar toda la API.

Uso (desde la carpeta elashesbackend):
  python -m app.database.run_seeders_cli
"""
from __future__ import annotations

import sys

from app.database.seeders import run_seeders
from app.database.session import SessionLocal


def main() -> None:
    db = SessionLocal()
    try:
        run_seeders(db)
        print(">>> Seeders ejecutados correctamente <<<")
    except Exception as exc:
        print(f">>> Error ejecutando seeders: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
