from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from app.schemas.branch import BranchSummary
from datetime import datetime
import re


class PermissionBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)


class PermissionCreate(PermissionBase):
    pass


class PermissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class RoleBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)


class RoleCreate(RoleBase):
    permission_ids: List[int] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    permission_ids: Optional[List[int]] = None


class RoleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class RoleResponse(RoleSummary):
    permissions: List[PermissionResponse] = []


PHONE_REGEX = re.compile(r"^\+[1-9]\d{7,14}$")

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=20)
    is_active: bool = True
    role_id: Optional[int] = None
    branch_id: Optional[int] = None
    
    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        if value is None:
            return value
        value = value.strip()
        if not PHONE_REGEX.match(value):
            raise ValueError("El phone debe estar en formato internacional, por ejemplo: +59171234567")
        return value
    


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=100)
    phone : Optional[str] = Field(default=None, max_length=20)
    is_active: Optional[bool] = None
    role_id: Optional[int] = None
    branch_id: Optional[int] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        if value is None:
            return value
        value = value.strip()
        if not PHONE_REGEX.match(value):
            raise ValueError("El phone debe estar en formato internacional, por ejemplo: +59171234567")
        return value

class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    phone : Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None


class UserResponse(UserSummary):
    role_id: Optional[int] = None
    branch_id: Optional[int] = None
    role: Optional[RoleSummary] = None
    branch: Optional[BranchSummary] = None
    phone : Optional[str] = None