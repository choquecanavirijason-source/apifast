from datetime import datetime, timezone
from typing import Annotated, Literal, Optional, List

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_serializer, field_validator

from app.domain.entities.manual_reminder import MANUAL_REMINDER_MAX_LENGTH
from app.presentation.schemas.branch import BranchSummary
from app.presentation.schemas.client import ClientSummary
from app.presentation.schemas.user import UserSummary


# ==========================================
# Service Categories
# ==========================================
class ServiceCategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    # data:image/...;base64,... puede ser grande; límite ~7M caracteres (~5MB binario)
    image_url: Optional[str] = Field(default=None, max_length=7_500_000)
    is_mobile: bool = False
    # Solo algunas categorías necesitan retoque/retiro (ej. Extensiones sí,
    # Lifting/Tratamientos no). Los días concretos se cargan por Service, no
    # acá — este check solo habilita esos campos en el form de servicio.
    has_maintenance: bool = False
    has_removal: bool = False


class ServiceCategoryCreate(ServiceCategoryBase):
    pass


class ServiceCategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    image_url: Optional[str] = Field(default=None, max_length=7_500_000)
    is_mobile: Optional[bool] = None
    has_maintenance: Optional[bool] = None
    has_removal: Optional[bool] = None


class ServiceCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_mobile: bool = False
    has_maintenance: bool = False
    has_removal: bool = False


# ==========================================
# Services
# ==========================================
class ServiceBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    image_url: Optional[str] = Field(default=None)
    category_id: Optional[int] = Field(default=None, ge=1)
    duration_minutes: int = Field(..., gt=0)
    price: float = Field(..., ge=0)
    commission_rate: Optional[float] = Field(default=None, ge=0, le=1)
    # Días desde la aplicación hasta que la clienta necesita retoque/retiro.
    # Solo tiene sentido si la categoría de este servicio tiene
    # has_maintenance/has_removal activado.
    maintenance_days: Optional[int] = Field(default=None, ge=0)
    removal_days: Optional[int] = Field(default=None, ge=0)
    # Activar/desactivar el servicio para venta y reserva (POS, Agenda) sin
    # borrarlo del catálogo.
    is_active: bool = True
    # Descuento promocional sobre `price` (0-100) — opcional, se aplica solo
    # mientras esté cargado.
    discount_percent: Optional[float] = Field(default=None, ge=0, le=100)


class ServiceCreate(ServiceBase):
    branch_ids: Optional[List[int]] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    image_url: Optional[str] = None
    category_id: Optional[int] = Field(default=None, ge=1)
    duration_minutes: Optional[int] = Field(default=None, gt=0)
    price: Optional[float] = Field(default=None, ge=0)
    commission_rate: Optional[float] = Field(default=None, ge=0, le=1)
    branch_ids: Optional[List[int]] = None
    maintenance_days: Optional[int] = Field(default=None, ge=0)
    removal_days: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    discount_percent: Optional[float] = Field(default=None, ge=0, le=100)


class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    category_id: Optional[int] = None
    duration_minutes: int
    price: float
    commission_rate: Optional[float] = None
    branch_ids: Optional[List[int]] = None
    category: Optional[ServiceCategoryResponse] = None
    ticket_count: int = 0
    maintenance_days: Optional[int] = None
    removal_days: Optional[int] = None
    is_active: bool = True
    discount_percent: Optional[float] = None
    effective_price: float


class ServiceImageUploadResponse(BaseModel):
    image_url: str


# ==========================================
# Appointments
# ==========================================
class AppointmentBase(BaseModel):
    client_id: int
    created_by_id: Optional[int] = None
    professional_id: Optional[int] = None
    service_id: Optional[int] = None
    service_ids: Optional[List[int]] = None
    branch_id: Optional[int] = None
    sale_id: Optional[int] = None
    is_ia: bool = False
    start_time: datetime
    end_time: datetime
    status: str = "pending"
    advance_payment_amount: float = 0.0  # monto adelantado al reservar (0 = sin adelanto)


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    client_id: Optional[int] = None
    professional_id: Optional[int] = None
    service_id: Optional[int] = None
    service_ids: Optional[List[int]] = None
    branch_id: Optional[int] = None
    sale_id: Optional[int] = None
    is_ia: Optional[bool] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None
    skip_availability_check: bool = False


class CallNextAppointment(BaseModel):
    branch_id: int
    professional_id: Optional[int] = None


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_code: Optional[str] = None
    client_id: int
    created_by_id: Optional[int] = None
    professional_id: Optional[int] = None
    service_id: Optional[int] = None
    service_ids: Optional[List[int]] = None
    branch_id: Optional[int] = None
    sale_id: Optional[int] = None
    is_ia: bool = False
    start_time: datetime
    end_time: datetime
    status: str
    advance_payment_amount: float = 0.0

    client: ClientSummary
    created_by: Optional[UserSummary] = None
    professional: Optional[UserSummary] = None
    service: Optional[ServiceResponse] = None
    services: Optional[List[ServiceResponse]] = None
    branch: Optional[BranchSummary] = None

    # Pago de la comisión (Historial de tickets > Confirmar pago).
    pagado: bool = False
    pagado_en: Optional[datetime] = None
    pagado_por: Optional[int] = None
    pagado_monto: Optional[float] = None
    pagador: Optional[UserSummary] = None

    @field_serializer("pagado_en")
    def _pagado_en_utc(self, value: Optional[datetime]) -> Optional[str]:
        # Se guarda en UTC naive: se manda con zona para que el panel no lo
        # interprete como hora local.
        return _as_utc_iso(value)


def _as_utc_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


class CommissionPayRequest(BaseModel):
    appointment_ids: List[int] = Field(..., min_length=1, max_length=500)


class CommissionPaidTicket(BaseModel):
    id: int
    pagado_en: datetime
    pagado_por: int
    pagado_monto: float
    commission_payment_id: int

    @field_serializer("pagado_en")
    def _pagado_en_utc(self, value: datetime) -> Optional[str]:
        return _as_utc_iso(value)


class CommissionPayResponse(BaseModel):
    pagados: List[CommissionPaidTicket]
    tickets: int
    operarias: int
    total: float
    pagado_por_nombre: str


class CommissionVoidRequest(BaseModel):
    # La anulación tiene que confirmarse explícitamente (el panel muestra un
    # diálogo); sin esto, un PUT/POST accidental deshacía un pago.
    confirmar: bool
    motivo: Optional[str] = Field(default=None, max_length=300)


class ManualReminderCreate(BaseModel):
    # Se recortan los espacios antes de validar: un mensaje en blanco no vale.
    message: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MANUAL_REMINDER_MAX_LENGTH)
    ]
    # Canales: push (app de la clienta) y/o correo a Client.email. Al menos uno.
    send_push: bool = True
    send_email: bool = False
    # Remitente del correo para este envío; vacío = el por defecto del servidor.
    # Debe ser uno de ReminderEmailSenderResponse.allowed.
    email_from: Optional[EmailStr] = None

    @field_validator("email_from", mode="before")
    @classmethod
    def _blank_email_from(cls, value):
        if isinstance(value, str):
            return value.strip() or None
        return value


class ReminderEmailSenderItem(BaseModel):
    """Remitente agregado desde el panel."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str


class ReminderEmailSenderResponse(BaseModel):
    """Remitente de los correos de recordatorio (se muestra en el modal)."""
    configured: bool
    # Remitente por defecto.
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    # Remitentes que se pueden elegir (.env + panel, el por defecto primero).
    allowed: List[str] = []
    # Los agregados desde el panel (se pueden quitar); los del .env no.
    registered: List[ReminderEmailSenderItem] = []
    # Si el usuario puede agregar o quitar remitentes (Admin / SuperAdmin).
    can_manage: bool = False


class ReminderEmailSenderCreate(BaseModel):
    email: EmailStr


class ManualReminderResponse(BaseModel):
    id: int
    appointment_id: int
    client_id: int
    message: str
    sent_by: Optional[int] = None
    # UTC con zona ("Z") para que el panel calcule "hace X min" sin adivinar.
    created_at: datetime
    send_push: bool = True
    # Resultado del correo: sent / no_email / not_configured / failed; null si no se pidió.
    email_status: Optional[Literal["sent", "no_email", "not_configured", "failed"]] = None
