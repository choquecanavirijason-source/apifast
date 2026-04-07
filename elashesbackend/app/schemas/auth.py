from typing import Optional
from pydantic import BaseModel, Field, EmailStr, field_validator
import re
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    sub: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    expires_at: str
    expires_in_minutes: int


class SessionInfoResponse(BaseModel):
    user: UserResponse
    expires_at: str
    expires_in_minutes: int
    remaining_seconds: int
    
PHONE_REGEX = re.compile(r"^\+[1-9]\d{7,14}$")
    
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    phone: str = Field(..., max_length=20)
    password: str = Field(..., min_length=6, max_length=100)
    role_id: Optional[int] = None
    branch_id: Optional[int] = None
    is_active: bool = True

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        value = value.strip()
        if not PHONE_REGEX.match(value):
            raise ValueError("El phone debe estar en formato internacional, por ejemplo: +59171234567")
        return value

class LogoutResponse(BaseModel):
    message: str = "Logout correcto"