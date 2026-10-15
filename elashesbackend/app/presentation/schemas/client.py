from datetime import date, datetime, timezone, timedelta
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StrictBool, model_validator
from app.presentation.schemas.catalog import EyeTypeSummary
from app.presentation.schemas.branch import BranchSummary

CLIENT_STATUS_SIN_ESTADO = "sin_estado"


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
    marketplace_enabled: Optional[bool] = None


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
    marketplace_enabled: bool = False
    notificaciones_activas: bool = True
    visit_count: int = 0

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


class ClientNotificacionesUpdate(BaseModel):
    notificaciones_activas: StrictBool


class ClientNotificacionesResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    notificaciones_activas: bool


class RetoqueResponse(BaseModel):
    """Fila de "Estado de retoques" (ver retoque_service.list_retoques)."""
    client_id: int
    seguimiento_id: int
    clienta: str
    servicio: Optional[str] = None
    tipo: Literal["mantenimiento", "retiro"]
    fecha_objetivo: date
    # Negativo = vencido (la fecha ya pasó y no agendó).
    dias_restantes: int
    vencido: bool
    # Próxima cita no cancelada (hora de La Paz); null si no agendó.
    proxima_cita: Optional[datetime] = None
    notificaciones_activas: bool
    branch_id: Optional[int] = None


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