from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.schemas.catalog import EyeTypeSummary
from app.schemas.branch import BranchSummary

CLIENT_STATUS_SIN_ESTADO = "sin_estado"


class ClientBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    age: Optional[int] = Field(default=None, ge=1, le=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    branch_id: Optional[int] = None
    eye_type_id: Optional[int] = None
    status: Optional[str] = Field(default="en_espera", max_length=32)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    age: Optional[int] = Field(default=None, ge=1, le=100)
    phone: Optional[str] = Field(default=None, max_length=20)
    branch_id: Optional[int] = None
    eye_type_id: Optional[int] = None
    status: Optional[str] = Field(default=None, max_length=32)


class ClientSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    last_name: str
    age: Optional[int] = None
    phone: Optional[str] = None
    branch_id: Optional[int] = None
    eye_type_id: Optional[int] = None
    status: str
    last_activity_at: Optional[datetime] = None

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