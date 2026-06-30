"""Almacenamiento de imágenes en disco y servido vía mount estático `/media`.

Las imágenes del catálogo (diseños de pestañas, efectos, volúmenes, tipos de ojo)
se guardan bajo `MEDIA_ROOT/<carpeta>/<uuid>.<ext>` y se exponen como
`/media/<carpeta>/<uuid>.<ext>`. Las apps construyen la URL absoluta
anteponiendo el host del backend.
"""
import os
import uuid

from fastapi import HTTPException, UploadFile, status

from app.config.settings import get_external_path

# La carpeta vive junto al .exe / proyecto (igual que la base de datos SQLite),
# para que persista entre despliegues locales.
MEDIA_ROOT = os.path.join(get_external_path(), "media")
MEDIA_URL_PREFIX = "/media"

# Carpetas permitidas para subir (evita escritura arbitraria de rutas).
ALLOWED_FOLDERS = {"lash-designs", "eye-types", "effects", "volumes", "misc", "marketplace"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def ensure_media_dirs() -> str:
    """Crea `MEDIA_ROOT` y las subcarpetas permitidas. Devuelve `MEDIA_ROOT`."""
    os.makedirs(MEDIA_ROOT, exist_ok=True)
    for folder in ALLOWED_FOLDERS:
        os.makedirs(os.path.join(MEDIA_ROOT, folder), exist_ok=True)
    return MEDIA_ROOT


def save_catalog_image(file: UploadFile, folder: str) -> str:
    """Guarda `file` en `MEDIA_ROOT/folder` y devuelve la ruta pública `/media/...`.

    Valida carpeta, extensión y tamaño. Lanza HTTPException 400 si algo no cuadra.
    """
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Carpeta no permitida. Usa una de: {sorted(ALLOWED_FOLDERS)}",
        )

    _, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida. Usa: {sorted(ALLOWED_EXTENSIONS)}",
        )

    data = file.file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen supera el tamaño máximo (5 MB).",
        )

    ensure_media_dirs()
    filename = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(MEDIA_ROOT, folder, filename)
    with open(abs_path, "wb") as out:
        out.write(data)

    return f"{MEDIA_URL_PREFIX}/{folder}/{filename}"
