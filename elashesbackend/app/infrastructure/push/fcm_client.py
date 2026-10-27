"""
Cliente mínimo de Firebase Cloud Messaging (API HTTP v1).

Se eligió la API HTTP v1 en vez de firebase-admin para no arrastrar sus
dependencias (cliente de Google Cloud, gRPC...): google-auth firma y renueva
el token OAuth de la cuenta de servicio, y el envío es un POST con httpx.

Credenciales: settings.fcm_credentials_file (FCM_CREDENTIALS_FILE) apunta al
JSON de la cuenta de servicio, montado fuera del repo. Si falta o no es válido,
get_fcm_client() devuelve None, se avisa una sola vez en el log y nada más
cambia.

Nunca se registra un token FCM completo en los logs (ver mask_token).
"""
import json
import logging
import os
import threading
from dataclasses import dataclass
from enum import Enum
from typing import Optional

import httpx

from app.config.settings import settings

logger = logging.getLogger("elashes.fcm")
# La app no configura logging (uvicorn solo configura sus propios loggers): sin
# un handler aquí, Python mostraría solo los WARNING y nunca "FCM activado".
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s:     %(name)s: %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.INFO)

_SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]
_SEND_URL = "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
# Tiempo máximo por llamada (token OAuth o envío). El recordatorio ya está
# guardado cuando se llega aquí: mejor perder un push que colgar la respuesta.
DEFAULT_TIMEOUT_SECONDS = 4.0


@dataclass(frozen=True)
class FcmNotification:
    """Notificación del sistema que acompaña a un data message (ver send_data)."""

    title: str
    body: str
    # Canal de Android de la app (debe existir: lo crea la app al iniciar).
    channel_id: str
    tag: str


class FcmResult(str, Enum):
    SENT = "sent"
    # El token ya no sirve (desinstaló la app, otro proyecto...): borrarlo.
    INVALID_TOKEN = "invalid_token"
    # Error transitorio o de configuración (red, 5xx, 429, 401): reintentable.
    ERROR = "error"


def mask_token(token: Optional[str]) -> str:
    """Solo el final del token, para poder correlacionar sin exponerlo."""
    if not token:
        return "<vacío>"
    return f"…{token[-6:]}" if len(token) > 6 else "…"


def classify_fcm_error(status_code: int, body: dict) -> FcmResult:
    """Traduce la respuesta de error de FCM v1. UNREGISTERED y
    SENDER_ID_MISMATCH significan token inútil para este proyecto;
    INVALID_ARGUMENT solo cuenta si FCM señala al propio token (con otros
    campos sería un error del mensaje, no del token)."""
    error = body.get("error") or {}
    codes = {
        detail.get("errorCode")
        for detail in error.get("details") or []
        if isinstance(detail, dict)
    }
    if codes & {"UNREGISTERED", "SENDER_ID_MISMATCH"}:
        return FcmResult.INVALID_TOKEN
    if status_code == 404 and error.get("status") == "NOT_FOUND":
        return FcmResult.INVALID_TOKEN
    if "INVALID_ARGUMENT" in codes or error.get("status") == "INVALID_ARGUMENT":
        message = str(error.get("message") or "").lower()
        if "registration token" in message or "message.token" in message:
            return FcmResult.INVALID_TOKEN
    return FcmResult.ERROR


class FcmClient:
    """Envía data messages a un token. Thread-safe: el token OAuth se cachea
    y se renueva bajo un lock (el envío corre en el threadpool de FastAPI)."""

    def __init__(self, credentials, project_id: str, timeout: float = DEFAULT_TIMEOUT_SECONDS):
        self._credentials = credentials
        self._project_id = project_id
        self._timeout = timeout
        self._lock = threading.Lock()

    def _access_token(self) -> str:
        from google.auth.transport.requests import Request

        def timed_request(*args, **kwargs):
            # google-auth espera hasta 120 s por defecto al pedir el token OAuth.
            kwargs["timeout"] = self._timeout
            return Request()(*args, **kwargs)

        with self._lock:
            if not self._credentials.valid:
                self._credentials.refresh(timed_request)
            return self._credentials.token

    def send_data(
        self,
        token: str,
        data: dict[str, str],
        notification: Optional["FcmNotification"] = None,
    ) -> FcmResult:
        """Data message de prioridad alta. Nunca lanza: devuelve el resultado.

        Con [notification] lleva además una notificación del sistema: Android
        la muestra solo aunque la app esté cerrada (un data message necesita
        que el sistema despierte la app, y muchos celulares no lo hacen si la
        clienta la cerró deslizándola). Sin ella, solo datos (la app decide
        si mostrar), que es lo que necesitan los avisos que el teléfono ya
        programa como alarmas locales."""
        message = {
            "token": token,
            # FCM exige que todos los valores de data sean strings.
            "data": {key: str(value) for key, value in data.items()},
            "android": {"priority": "HIGH"},
            # iOS: un push sin alerta solo se entrega como "background" y con
            # prioridad 5 (Apple rechaza 10 sin alerta). iOS puede retrasarlo.
            "apns": {
                "headers": {"apns-push-type": "background", "apns-priority": "5"},
                "payload": {"aps": {"content-available": 1}},
            },
        }
        if notification is not None:
            message["notification"] = {"title": notification.title, "body": notification.body}
            message["android"]["notification"] = {
                "channel_id": notification.channel_id,
                # Misma etiqueta = Android reemplaza en vez de apilar repetidas.
                "tag": notification.tag,
            }
            # Con alerta visible, iOS acepta tipo "alert" y prioridad 10.
            message["apns"]["headers"] = {"apns-push-type": "alert", "apns-priority": "10"}
        try:
            access_token = self._access_token()
            response = httpx.post(
                _SEND_URL.format(project_id=self._project_id),
                json={"message": message},
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=self._timeout,
            )
        except Exception as exc:  # red, timeout, credenciales rechazadas...
            logger.warning("FCM: no se pudo enviar a %s: %s", mask_token(token), type(exc).__name__)
            return FcmResult.ERROR

        if response.status_code == 200:
            return FcmResult.SENT
        try:
            body = response.json()
        except ValueError:
            body = {}
        result = classify_fcm_error(response.status_code, body)
        logger.warning(
            "FCM: %s para %s (HTTP %s, %s)",
            "token inválido" if result is FcmResult.INVALID_TOKEN else "error",
            mask_token(token),
            response.status_code,
            (body.get("error") or {}).get("status", "?"),
        )
        return result


_client: Optional[FcmClient] = None
_loaded = False
_load_lock = threading.Lock()


def _load_client() -> Optional[FcmClient]:
    path = (settings.fcm_credentials_file or "").strip()
    if not path:
        logger.warning("FCM desactivado: FCM_CREDENTIALS_FILE no está configurada.")
        return None
    if not os.path.isfile(path):
        logger.warning("FCM desactivado: FCM_CREDENTIALS_FILE no apunta a un archivo (%s).", path)
        return None
    try:
        from google.oauth2 import service_account

        with open(path, encoding="utf-8") as fh:
            info = json.load(fh)
        credentials = service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
        project_id = info["project_id"]
    except Exception as exc:
        # No se registra el contenido: es la clave privada de la cuenta.
        logger.warning("FCM desactivado: credenciales no válidas en %s (%s).", path, type(exc).__name__)
        return None
    logger.info("FCM activado para el proyecto %s.", project_id)
    return FcmClient(credentials, project_id)


def get_fcm_client() -> Optional[FcmClient]:
    """Cliente FCM o None si el envío está desactivado. Se carga una vez."""
    global _client, _loaded
    if not _loaded:
        with _load_lock:
            if not _loaded:
                _client = _load_client()
                _loaded = True
    return _client
