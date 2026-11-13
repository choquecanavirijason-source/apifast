from datetime import date, datetime, timezone, timedelta
from typing import Literal, Optional
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StrictBool, field_validator, model_validator
from app.presentation.schemas.catalog import EyeTypeSummary
from app.presentation.schemas.branch import BranchSummary

CLIENT_STATUS_SIN_ESTADO = "sin_estado"


LA_PAZ = ZoneInfo("America/La_Paz")
MAX_AGE_YEARS = 100


def today_la_paz() -> date:
    return datetime.now(LA_PAZ).date()


def age_from_birth_date(birth_date: date, today: Optional[date] = None) -> int:
    """Años cumplidos a `today` (hoy en La Paz). Nunca negativa."""
    today = today or today_la_paz()
    years = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    return max(0, years)


def _check_birth_date(value: Optional[date]) -> Optional[date]:
    """Una fecha de nacimiento no puede ser futura ni de alguien de más de 100 años."""
    if value is None:
        return None
    today = today_la_paz()
    if value > today:
        raise ValueError("La fecha de nacimiento no puede ser futura.")
    if age_from_birth_date(value, today) > MAX_AGE_YEARS:
        raise ValueError("La fecha de nacimiento no es válida (más de 100 años).")
    return value


def _blank_to_none(value: Optional[str]) -> Optional[str]:
    """Texto libre: espacios sobrantes fuera y vacío = sin dato (así se puede borrar)."""
    if value is None:
        return None
    value = value.strip()
    return value or None


class ClientBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    age: Optional[int] = Field(default=None, ge=1, le=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[EmailStr] = None
    branch_id: Optional[int] = None
    eye_type_id: Optional[int] = None
    status: Optional[str] = Field(default="en_espera", max_length=32)
    ci: Optional[str] = Field(default=None, max_length=20)
    allergies: Optional[str] = Field(default=None, max_length=500)
    birth_date: Optional[date] = None

    _normalize_allergies = field_validator("allergies")(_blank_to_none)
    _validate_birth_date = field_validator("birth_date")(_check_birth_date)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    age: Optional[int] = Field(default=None, ge=1, le=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    email: Optional[EmailStr] = None
    branch_id: Optional[int] = None
    eye_type_id: Optional[int] = None
    status: Optional[str] = Field(default=None, max_length=32)
    ci: Optional[str] = Field(default=None, max_length=20)
    allergies: Optional[str] = Field(default=None, max_length=500)
    birth_date: Optional[date] = None
    marketplace_enabled: Optional[bool] = None

    _normalize_allergies = field_validator("allergies")(_blank_to_none)
    _validate_birth_date = field_validator("birth_date")(_check_birth_date)


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    last_name: str
    age: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    branch_id: Optional[int] = None
    eye_type_id: Optional[int] = None
    status: str
    last_activity_at: Optional[datetime] = None
    ci: Optional[str] = None
    allergies: Optional[str] = None
    birth_date: Optional[date] = None
    # True si el personal ya le confirmó las alergias (aunque no tenga).
    allergies_confirmed: bool = False
    # Clienta de mostrador compartida: no admite datos personales.
    is_generic: bool = False
    marketplace_enabled: bool = False
    notificaciones_activas: bool = True
    visit_count: int = 0

    @model_validator(mode="after")
    def derive_age_from_birth_date(self):
        """Con fecha de nacimiento, la edad se calcula sola (la guardada puede estar vieja)."""
        if self.birth_date is not None:
            self.age = age_from_birth_date(self.birth_date)
        return self

    @model_validator(mode="after")
    def apply_sin_estado_after_inactivity(self):
        """Si last_activity_at es mayor a 1 día, status pasa a sin_estado."""
        if self.last_activity_at is None:
            return self
        now = datetime.now(timezone.utc)
        if self.last_activity_at.tzinfo is None:
            self.last_activity_at = self.last_activity_at.replace(tzinfo=timezone.utc)
        if now - self.last_activity_at > timedelta(days=1):
            self.status = CLIENT_STATUS_SIN_ESTADO
        return self


class ClientResponse(ClientSummary):
    eye_type: Optional[EyeTypeSummary] = None
    branch: Optional[BranchSummary] = None


class ClientAllergiesUpdate(BaseModel):
    """Confirma las alergias de la clienta. allergies vacío/None = "Sin alergias"."""
    allergies: Optional[str] = Field(default=None, max_length=500)

    _normalize_allergies = field_validator("allergies")(_blank_to_none)


class ClientNotificacionesUpdate(BaseModel):
    notificaciones_activas: StrictBool


class ClientNotificacionesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notificaciones_activas: bool


class RetoqueResponse(BaseModel):
    """Fila de "Estado de retoques" (ver retoque_service.list_retoques)."""
    client_id: int
    # None en filas "pendiente_atencion" (aún no existe seguimiento).
    seguimiento_id: Optional[int] = None
    clienta: str
    servicio: Optional[str] = None
    tipo: Literal["mantenimiento", "retiro"]
    fecha_objetivo: Optional[date] = None
    fecha_aplicacion: Optional[date] = None
    estado_retiro: Optional[Literal["por_verificar", "atencion_posterior"]] = None
    observacion: Optional[str] = None
    recordatorio_permitido: bool = True
    reserva_retiro_estado: Literal["sin_reserva", "reservado", "por_verificar"] = "sin_reserva"
    reserva_retiro_fecha: Optional[datetime] = None
    reserva_retiro_detalle: Optional[str] = None
    # Negativo = vencido (la fecha ya pasó y no agendó).
    dias_restantes: Optional[int] = None
    vencido: bool
    # Próxima cita no cancelada (hora de La Paz); null si no agendó.
    proxima_cita: Optional[datetime] = None
    notificaciones_activas: bool
    branch_id: Optional[int] = None
    # Solo pestañas tipadas: estado del seguimiento y atención de origen.
    estado_seguimiento: Optional[Literal[
        "pendiente_atencion", "habilitado", "recordatorio_enviado", "vencido", "cancelado"
    ]] = None
    appointment_id: Optional[int] = None
    cita_fecha: Optional[datetime] = None
    cita_estado: Optional[str] = None


class CitaProximaResponse(BaseModel):
    """Fila de "Próximas citas" (ver retoque_service.list_citas_proximas)."""
    appointment_id: int
    client_id: int
    clienta: str
    servicio: Optional[str] = None
    # Hora de La Paz, sin zona (como appointments.start_time).
    fecha_hora: datetime
    sucursal: Optional[str] = None
    branch_id: Optional[int] = None
    estado: str
    # De la clienta; solo lectura aquí (se cambia en "Estado de retoques").
    notificaciones_activas: bool
    # Si la clienta tiene correo registrado (para el canal "Correo" del recordatorio).
    tiene_email: bool = False
    # Último recordatorio manual enviado para esta cita, UTC con zona ("Z").
    ultimo_recordatorio: Optional[datetime] = None
