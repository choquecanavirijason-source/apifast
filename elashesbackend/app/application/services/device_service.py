"""
Dispositivos (instalaciones de la app) de clientas. El token se genera con
secrets.token_urlsafe(32), se entrega una sola vez y en la BD solo queda su
hash SHA-256. El token FCM (push) se guarda tal cual: Firebase lo necesita
para enviar, y no da acceso a nada del salón.
"""
import hashlib
import secrets
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.domain.entities.client import Client
from app.domain.entities.client_device import ClientDevice


class ClientNotFoundError(Exception):
    pass


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def register_device(
    db: Session, client_id: int, installation_id: str, platform: str
) -> tuple[ClientDevice, str]:
    """Registra la instalación o la reasigna. Devuelve (dispositivo, token en claro).

    Si la instalación ya existía (de la misma u otra clienta) se reutiliza la fila
    y se reemplaza el hash: el token anterior deja de validar, es decir, queda
    revocado. installation_id y token_hash son únicos, así que no puede haber
    dos filas vivas para la misma instalación.
    """
    if db.query(Client.id).filter(Client.id == client_id).first() is None:
        raise ClientNotFoundError(client_id)

    token = secrets.token_urlsafe(32)
    device = (
        db.query(ClientDevice).filter(ClientDevice.installation_id == installation_id).first()
    )
    if device is None:
        device = ClientDevice(installation_id=installation_id)
        db.add(device)
    device.client_id = client_id
    device.platform = platform
    device.token_hash = hash_token(token)
    device.created_at = datetime.utcnow()
    device.last_seen_at = None
    device.revoked_at = None
    # Sesión nueva (quizá de otra clienta): el token FCM anterior no se reusa;
    # la app lo vuelve a registrar ya autenticada como la clienta actual.
    device.fcm_token = None
    device.fcm_token_updated_at = None
    db.commit()
    db.refresh(device)
    return device, token


def authenticate_token(db: Session, token: str) -> Optional[ClientDevice]:
    """Dispositivo no revocado dueño del token (actualiza last_seen_at) o None."""
    device = (
        db.query(ClientDevice)
        .filter(ClientDevice.token_hash == hash_token(token))
        .filter(ClientDevice.revoked_at.is_(None))
        .first()
    )
    if device is None:
        return None
    device.last_seen_at = datetime.utcnow()
    db.commit()
    return device


def revoke_device(db: Session, device: ClientDevice) -> None:
    device.revoked_at = datetime.utcnow()
    # Cerró sesión: sin token, ningún push le llega aunque la fila siga.
    device.fcm_token = None
    device.fcm_token_updated_at = None
    db.commit()


def set_fcm_token(db: Session, device: ClientDevice, fcm_token: str) -> None:
    """Registra o actualiza el token FCM de la instalación. Si otra fila lo
    tenía (p. ej. una instalación anterior en el mismo celular), se le quita:
    un token apunta a un solo celular y solo debe recibir los pushes de la
    sesión actual."""
    (
        db.query(ClientDevice)
        .filter(ClientDevice.fcm_token == fcm_token, ClientDevice.id != device.id)
        .update(
            {ClientDevice.fcm_token: None, ClientDevice.fcm_token_updated_at: None},
            synchronize_session=False,
        )
    )
    device.fcm_token = fcm_token
    device.fcm_token_updated_at = datetime.utcnow()
    db.commit()


def clear_fcm_token(db: Session, device: ClientDevice) -> None:
    device.fcm_token = None
    device.fcm_token_updated_at = datetime.utcnow()
    db.commit()
