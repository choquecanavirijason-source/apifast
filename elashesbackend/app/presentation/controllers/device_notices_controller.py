"""
Avisos programados de citas para la app de clientas. El envío por push
(Firebase Cloud Messaging) es opcional: ver PUT /dispositivos/actual/fcm-token.
Ver docs/Recordatorios_de_citas_sin_Firebase.pdf.

Solo se monta cuando settings.client_notices_enabled está activo y no se corre
desde el instalador de escritorio (ver main.py).

Registro: la clienta se autentica en backend_marketplace (email + CI); ese
servicio llama a POST /dispositivos con el header X-Internal-Key y le entrega
a la app el token devuelto. El token se muestra una sola vez.
"""
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy.orm import Session

from app.application.services.appointment_notice_service import get_scheduled_notices
from app.application.services.device_service import (
    ClientNotFoundError,
    clear_fcm_token,
    register_device,
    revoke_device,
    set_fcm_token,
)
from app.core.dependencies import (
    get_current_device,
    get_current_device_client_id,
    get_db,
)
from app.core.internal_auth import require_internal_key
from app.domain.entities.client_device import FCM_TOKEN_MAX_LENGTH, ClientDevice

router = APIRouter(tags=["Avisos de citas"])


class DeviceRegisterRequest(BaseModel):
    client_id: int
    installation_id: str = Field(..., min_length=8, max_length=128)
    platform: Literal["android", "ios"]


class FcmTokenRequest(BaseModel):
    # Los tokens FCM son base64url más ":" (unos 150-200 caracteres).
    fcm_token: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=20,
            max_length=FCM_TOKEN_MAX_LENGTH,
            pattern=r"^[A-Za-z0-9_:\-]+$",
        ),
    ]


class DeviceRegisterResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    client_id: int
    installation_id: str
    platform: str


class AvisoResponse(BaseModel):
    aviso_id: int
    # Siempre presentes: cita_id es null en mantenimiento/retiro (recordar
    # agendar, no hay cita) y seguimiento_id es null en manana/hoy y en
    # recordatorio_manual (enviado a mano desde el panel).
    cita_id: Optional[int]
    seguimiento_id: Optional[int]
    tipo: Literal["manana", "hoy", "mantenimiento", "retiro", "recordatorio_manual"]
    mostrar_en: str
    expira_en: str
    titulo: str
    cuerpo: str


class AvisosProgramadosResponse(BaseModel):
    generado_en: str
    avisos: list[AvisoResponse]


@router.post("/dispositivos", response_model=DeviceRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_device_endpoint(
    payload: DeviceRegisterRequest,
    request: Request,
    x_internal_key: Optional[str] = Header(default=None, alias="X-Internal-Key"),
    db: Session = Depends(get_db),
):
    """Registra (o reasigna) la instalación y devuelve el token UNA sola vez.
    Si la instalación pertenecía a otra clienta, su token anterior queda revocado."""
    require_internal_key(request, x_internal_key, "register-device-bad-key")
    try:
        device, token = register_device(
            db, payload.client_id, payload.installation_id, payload.platform
        )
    except ClientNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return DeviceRegisterResponse(
        token=token,
        client_id=device.client_id,
        installation_id=device.installation_id,
        platform=device.platform,
    )


@router.get("/avisos/programados", response_model=AvisosProgramadosResponse)
def scheduled_notices(
    client_id: int = Depends(get_current_device_client_id),
    db: Session = Depends(get_db),
):
    return get_scheduled_notices(db, client_id)


@router.delete("/dispositivos/actual", status_code=status.HTTP_204_NO_CONTENT)
def revoke_current_device(
    device: ClientDevice = Depends(get_current_device),
    db: Session = Depends(get_db),
):
    revoke_device(db, device)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/dispositivos/actual/fcm-token", status_code=status.HTTP_204_NO_CONTENT)
def register_fcm_token(
    payload: FcmTokenRequest,
    device: ClientDevice = Depends(get_current_device),
    db: Session = Depends(get_db),
):
    """Registra o actualiza el token de Firebase Cloud Messaging de esta
    instalación, para recibir recordatorios con la app cerrada. La app lo
    llama tras iniciar sesión y cada vez que Firebase le renueva el token."""
    set_fcm_token(db, device, payload.fcm_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/dispositivos/actual/fcm-token", status_code=status.HTTP_204_NO_CONTENT)
def delete_fcm_token(
    device: ClientDevice = Depends(get_current_device),
    db: Session = Depends(get_db),
):
    """Deja de enviar push a esta instalación (p. ej. al cerrar sesión).
    Revocar el dispositivo (DELETE /dispositivos/actual) también lo borra."""
    clear_fcm_token(db, device)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
