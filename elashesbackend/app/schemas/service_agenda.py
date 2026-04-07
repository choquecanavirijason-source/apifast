from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.branch import BranchSummary
from app.schemas.client import ClientSummary
from app.schemas.user import UserSummary


# ==========================================
# Service Categories
# ==========================================
class ServiceCategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    image_url: Optional[str] = Field(default=None)
    is_mobile: bool = False


class ServiceCategoryCreate(ServiceCategoryBase):
    pass


class ServiceCategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    image_url: Optional[str] = Field(default=None)
    is_mobile: Optional[bool] = None


class ServiceCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_mobile: bool = False


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


class ServiceCreate(ServiceBase):
    branch_ids: Optional[List[int]] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=255)
    image_url: Optional[str] = None
    category_id: Optional[int] = Field(default=None, ge=1)
    duration_minutes: Optional[int] = Field(default=None, gt=0)
    price: Optional[float] = Field(default=None, ge=0)
    branch_ids: Optional[List[int]] = None


class ServiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    category_id: Optional[int] = None
    duration_minutes: int
    price: float
    branch_ids: Optional[List[int]] = None
    category: Optional[ServiceCategoryResponse] = None


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


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdate(BaseModel):
    client_id: Optional[int] = None
    professional_id: Optional[int] = None
    service_id: Optional[int] = None
    service_ids: Optional[List[int]] = None
    branch_id: Optional[int] = None
    is_ia: Optional[bool] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None


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

    client: ClientSummary
    created_by: Optional[UserSummary] = None
    professional: Optional[UserSummary] = None
    service: Optional[ServiceResponse] = None
    services: Optional[List[ServiceResponse]] = None
    branch: Optional[BranchSummary] = None