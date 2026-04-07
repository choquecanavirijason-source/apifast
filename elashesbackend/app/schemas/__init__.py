# Paquete de esquemas
from app.schemas.base_response import MessageResponse, HealthResponse, ErrorResponse, BaseSchema
from app.schemas.branch import BranchCreate, BranchUpdate, BranchSummary, BranchResponse
from app.schemas.user import (
    PermissionCreate,
    PermissionResponse,
    RoleCreate,
    RoleUpdate,
    RoleSummary,
    RoleResponse,
    UserCreate,
    UserUpdate,
    UserSummary,
    UserResponse,
)
from app.schemas.auth import LoginRequest, TokenResponse, TokenData, LoginResponse, RegisterRequest, LogoutResponse
from app.schemas.client import ClientCreate, ClientUpdate, ClientSummary, ClientResponse
from app.schemas.catalog import (
    EyeTypeCreate,
    EyeTypeUpdate,
    EyeTypeSummary,
    EyeTypeResponse,
    EffectCreate,
    EffectUpdate,
    EffectSummary,
    EffectResponse,
    VolumeCreate,
    VolumeUpdate,
    VolumeSummary,
    VolumeResponse,
    LashDesignCreate,
    LashDesignUpdate,
    LashDesignSummary,
    LashDesignResponse,
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
    QuestionnaireCreate,
    QuestionnaireUpdate,
    QuestionnaireSummary,
    QuestionnaireResponse,
)
from app.schemas.tracking import TrackingCreate, TrackingUpdate, TrackingResponse
from app.schemas.service_agenda import (
    ServiceCreate,
    ServiceUpdate,
    ServiceResponse,
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse
)

from app.schemas.payment import (
    PaymentCreate, 
    PaymentUpdate,
    PaymentResponse
)

from app.schemas.inventory import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    BatchCreate,
    BatchUpdate,
    BatchResponse,
    InventoryMovementCreate,
    InventoryMovementResponse,
    StockSummaryResponse,
)