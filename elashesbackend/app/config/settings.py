import os
import sys
from pydantic_settings import BaseSettings
from typing import Optional

def get_base_path():
    """Retorna la ruta de la carpeta temporal interna si es .exe, 
    o la carpeta del proyecto si es .py"""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_external_path():
    """Retorna la ruta donde vive el .exe real (para la base de datos)"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Definimos rutas antes de la clase
base_path = get_base_path()
external_path = get_external_path()

class Settings(BaseSettings):
    """Configuración de la aplicación"""
    app_name: str = "Sistema de Reconocimiento Facial y Análisis de Pestañas"
    app_version: str = "1.0.0"
    app_description: str = "..."

    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False # Es mejor False para producción/exe

    # IMPORTANTE: La DB se crea en la carpeta del usuario, NO dentro del exe temporal
    database_url: str = f"sqlite:///{os.path.join(external_path, 'elashes.db')}"

    secret_key: str = "your-secret-key-here"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    allowed_origins: list = ["*"]

    face_recognition_threshold: float = 0.6
    face_min_confidence: float = 0.7
    max_image_size: int = 5242880
    allowed_image_extensions: list = [".jpg", ".jpeg", ".png", ".bmp"]

    mobile_image_quality: int = 85
    mobile_max_resolution: tuple = (1920, 1080)

    class Config:
        # Esto buscará el .env empaquetado dentro del EXE
        env_file = os.path.join(base_path, ".env")
        extra = "ignore"
        case_sensitive = False

settings = Settings()