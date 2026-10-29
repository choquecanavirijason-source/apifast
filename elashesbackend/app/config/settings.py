import os
import sys
from urllib.parse import quote_plus

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
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

    # Si defines DATABASE_URL en .env / entorno, se usa tal cual.
    # Si defines DB_HOST (p. ej. Docker), se arma mysql+pymysql://...
    # Si no hay ninguno, SQLite en la carpeta del proyecto (modo .exe / local).
    database_url: Optional[str] = None
    db_host: Optional[str] = None
    db_port: int = 3306
    db_user: Optional[str] = None
    db_password: Optional[str] = None
    db_name: Optional[str] = None

    environment: str = "development"  # "production" en Cloud
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

    # URL interna del backend_marketplace (proxy transparente)
    marketplace_backend_url: str = "http://host.docker.internal:8001"

    # WhatsApp (validación de citas). Ver whatsapp_service.py
    whatsapp_enabled: bool = False
    whatsapp_provider: str = "webhook"
    whatsapp_api_url: Optional[str] = None
    whatsapp_api_token: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None

    # Avisos programados de citas (POST /dispositivos, GET /avisos/programados,
    # DELETE /dispositivos/actual). Solo en el servidor de producción: el
    # instalador de escritorio no los monta aunque la variable esté en true.
    client_notices_enabled: bool = False
    # Secreto server-to-server: backend_marketplace lo envía en X-Internal-Key al
    # registrar un dispositivo tras el login de la clienta. Vacío = registro deshabilitado.
    internal_api_key: Optional[str] = None
    # Firebase Cloud Messaging: ruta al JSON de la cuenta de servicio, montado
    # fuera del repo (ver docker-compose.yml). Vacío o inválido = sin push; el
    # resto (WebSocket, /avisos/programados) funciona igual.
    fcm_credentials_file: Optional[str] = None
    # Correo SMTP (recordatorios manuales por email). Con Gmail: smtp.gmail.com,
    # puerto 587 (STARTTLS) y una "contraseña de aplicación" de la cuenta, no
    # la contraseña normal. Sin host o sin remitente = correo desactivado.
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    # Remitente; si se deja vacío se usa smtp_username.
    smtp_from_email: Optional[str] = None
    smtp_from_name: str = "Elashes"
    # Otros remitentes que el panel puede elegir al enviar (separados por coma).
    # Con Gmail deben estar verificados en la cuenta (Configuración > Cuentas >
    # "Enviar correo como"); si no, Gmail los reemplaza por smtp_username.
    smtp_allowed_from: Optional[str] = None
    # True = STARTTLS (587); False con puerto 465 = SSL directo.
    smtp_use_tls: bool = True
    smtp_timeout_seconds: float = 10.0
    # Correos por día que acepta la cuenta SMTP. Gmail personal: ~500; Google
    # Workspace: ~2000. Solo sirve para avisar en el panel antes de un envío
    # masivo; el servidor de correo es quien corta de verdad.
    smtp_daily_limit: int = 500

    # URL pública con la que los celulares llegan a este backend, sin "/" al
    # final (ej. https://elashes.com/api). Firebase solo acepta la imagen de un
    # push por URL: vacía = el push sale sin imagen (el correo la lleva
    # incrustada y no la necesita).
    public_base_url: Optional[str] = None

    @model_validator(mode="after")
    def resolve_database_url(self):
        if self.database_url and str(self.database_url).strip():
            self.database_url = str(self.database_url).strip()
            return self
        if self.db_host:
            user = self.db_user or "root"
            pwd = self.db_password if self.db_password is not None else ""
            dbn = self.db_name or "elashes"
            self.database_url = (
                f"mysql+pymysql://{quote_plus(user)}:{quote_plus(pwd)}"
                f"@{self.db_host}:{self.db_port}/{dbn}"
            )
            return self
        self.database_url = f"sqlite:///{os.path.join(external_path, 'elashes.db')}"
        return self

    # Esto buscará el .env empaquetado dentro del EXE
    model_config = SettingsConfigDict(
        env_file=os.path.join(base_path, ".env"),
        extra="ignore",
        case_sensitive=False,
    )

settings = Settings()
