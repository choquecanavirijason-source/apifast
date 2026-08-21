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
ALLOWED_FOLDERS = {"lash-designs", "eye-types", "effects", "volumes", "designs", "misc", "marketplace", "branding", "expenses"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_LOGO_BYTES = 500 * 1024  # 500 KB

# Modelos 3D de diseños (vista previa AR/3D en el admin).
MODEL_3D_FOLDER = "design-models"
ALLOWED_MODEL_3D_EXTENSIONS = {".glb", ".gltf", ".obj", ".fbx", ".stl"}
MAX_MODEL_3D_BYTES = 50 * 1024 * 1024  # 50 MB


def ensure_media_dirs() -> str:
    """Crea `MEDIA_ROOT` y las subcarpetas permitidas. Devuelve `MEDIA_ROOT`."""
    os.makedirs(MEDIA_ROOT, exist_ok=True)
    for folder in ALLOWED_FOLDERS:
        os.makedirs(os.path.join(MEDIA_ROOT, folder), exist_ok=True)
    os.makedirs(os.path.join(MEDIA_ROOT, MODEL_3D_FOLDER), exist_ok=True)
    return MEDIA_ROOT


def save_catalog_image(file: UploadFile, folder: str, max_bytes: int = MAX_IMAGE_BYTES) -> str:
    """Guarda `file` en `MEDIA_ROOT/folder` y devuelve la ruta pública `/media/...`.

    Valida carpeta, extensión y tamaño (`max_bytes`, 5 MB por defecto).
    Lanza HTTPException 400 si algo no cuadra.
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
    if len(data) > max_bytes:
        max_mb = max_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La imagen supera el tamaño máximo ({max_mb:.1f} MB).",
        )

    ensure_media_dirs()
    filename = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(MEDIA_ROOT, folder, filename)
    with open(abs_path, "wb") as out:
        out.write(data)

    return f"{MEDIA_URL_PREFIX}/{folder}/{filename}"


def delete_media_file(relative_url: str | None) -> None:
    """Elimina un archivo previamente guardado bajo `MEDIA_ROOT`, dado su path
    público `/media/<carpeta>/<archivo>`. No falla si el archivo ya no existe
    o si `relative_url` no tiene el formato esperado.
    """
    if not relative_url or not relative_url.startswith(f"{MEDIA_URL_PREFIX}/"):
        return
    rel_path = relative_url[len(MEDIA_URL_PREFIX) + 1:]
    abs_path = os.path.join(MEDIA_ROOT, rel_path)
    try:
        os.remove(abs_path)
    except FileNotFoundError:
        pass


def save_design_model(file: UploadFile) -> str:
    """Guarda un modelo 3D (glb/gltf/obj/fbx/stl) de un diseño y devuelve la
    ruta pública `/media/design-models/...`. Lanza HTTPException 400 si la
    extensión o el tamaño no son válidos.
    """
    _, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()
    if ext not in ALLOWED_MODEL_3D_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida. Usa: {sorted(ALLOWED_MODEL_3D_EXTENSIONS)}",
        )

    data = file.file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo está vacío.",
        )
    if len(data) > MAX_MODEL_3D_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El modelo 3D supera el tamaño máximo (50 MB).",
        )

    ensure_media_dirs()
    filename = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(MEDIA_ROOT, MODEL_3D_FOLDER, filename)
    with open(abs_path, "wb") as out:
        out.write(data)

    return f"{MEDIA_URL_PREFIX}/{MODEL_3D_FOLDER}/{filename}"
