# Paquete de esquemas
from app.presentation.schemas.base_response import MessageResponse, HealthResponse, ErrorResponse, BaseSchema
from app.presentation.schemas.branch import BranchCreate, BranchUpdate, BranchSummary, BranchResponse
from app.presentation.schemas.user import (
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
from app.presentation.schemas.auth import LoginRequest, TokenResponse, TokenData, LoginResponse, RegisterRequest, LogoutResponse
from app.presentation.schemas.client import ClientCreate, ClientUpdate, ClientSummary, ClientResponse
from app.presentation.schemas.catalog import (
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
from app.presentation.schemas.tracking import TrackingCreate, TrackingUpdate, TrackingResponse
from app.presentation.schemas.service_agenda import (
    ServiceCreate,
    ServiceUpdate,
    ServiceResponse,
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse
)

from app.presentation.schemas.payment import (
    PaymentCreate, 
    PaymentUpdate,
    PaymentResponse
)

from app.presentation.schemas.inventory import (
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