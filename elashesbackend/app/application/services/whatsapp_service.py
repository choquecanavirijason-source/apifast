import re
from typing import Optional, TYPE_CHECKING

import httpx
from fastapi import HTTPException, status

from app.config.settings import settings

if TYPE_CHECKING:
    from app.application.services.branch_integration_service import WhatsAppBranchConfig


def normalize_phone_e164(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    trimmed = phone.strip()
    if not trimmed:
        return None
    digits = re.sub(r"\D", "", trimmed)
    if not digits:
        return None
    if trimmed.startswith("+"):
        return f"+{digits}"
    if digits.startswith("591") and len(digits) >= 11:
        return f"+{digits}"
    return f"+591{digits}"


def build_validation_message(
    *,
    client_name: str,
    appointment_date: str,
    appointment_time: str,
    service_name: str,
    branch_name: str,
    ticket_code: Optional[str],
) -> str:
    code_line = f"\nCódigo de reserva: {ticket_code}" if ticket_code else ""
    return (
        f"Hola {client_name}, te escribimos desde Elashes para confirmar tu cita:\n"
        f"Fecha: {appointment_date}\n"
        f"Hora: {appointment_time}\n"
        f"Servicio: {service_name}\n"
        f"Sucursal: {branch_name}{code_line}\n\n"
        "Por favor responde SI para confirmar tu asistencia."
    )


def build_wa_me_link(phone_e164: str, message: str) -> str:
    digits = re.sub(r"\D", "", phone_e164)
    from urllib.parse import quote

    return f"https://wa.me/{digits}?text={quote(message)}"


async def send_whatsapp_text(
    *,
    phone_e164: str,
    message: str,
    branch_config: Optional["WhatsAppBranchConfig"] = None,
) -> dict:
    if branch_config is not None:
        provider = (branch_config.provider or "webhook").strip().lower()
        enabled = bool(branch_config.enabled)
        api_url = branch_config.api_url
        token = branch_config.api_token
        phone_number_id = branch_config.phone_number_id
    else:
        provider = (getattr(settings, "whatsapp_provider", None) or "webhook").strip().lower()
        enabled = bool(getattr(settings, "whatsapp_enabled", False))
        api_url = getattr(settings, "whatsapp_api_url", None)
        token = getattr(settings, "whatsapp_api_token", None)
        phone_number_id = getattr(settings, "whatsapp_phone_number_id", None)

    if provider == "wa_me":
        enabled = False

    if not enabled:
        return {
            "sent": False,
            "mode": "wa_me",
            "wa_me_url": build_wa_me_link(phone_e164, message),
            "detail": "WhatsApp API deshabilitada; usa el enlace wa.me",
        }

    if provider == "meta":
        if not phone_number_id or not token:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Configura WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_API_TOKEN",
            )
        url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": re.sub(r"\D", "", phone_e164),
            "type": "text",
            "text": {"preview_url": False, "body": message},
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"WhatsApp API error: {response.text[:300]}",
            )
        return {"sent": True, "mode": "meta", "provider_response": response.json()}

    if not api_url:
        return {
            "sent": False,
            "mode": "wa_me",
            "wa_me_url": build_wa_me_link(phone_e164, message),
            "detail": "WHATSAPP_API_URL no configurada; usa enlace wa.me",
        }

    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = {"to": phone_e164, "phone": phone_e164, "message": message, "text": message}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(api_url, json=payload, headers=headers)
    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"WhatsApp webhook error: {response.text[:300]}",
        )
    return {"sent": True, "mode": "webhook", "provider_response": response.json() if response.content else {}}
