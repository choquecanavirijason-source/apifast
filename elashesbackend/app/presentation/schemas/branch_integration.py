from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class BranchIntegrationProfileBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    is_shared: bool = True
    whatsapp_enabled: bool = False
    whatsapp_provider: str = Field(default="webhook", max_length=30)
    whatsapp_api_url: Optional[str] = Field(default=None, max_length=500)
    whatsapp_phone_number_id: Optional[str] = Field(default=None, max_length=120)
    ai_api_url: Optional[str] = Field(default=None, max_length=500)


class BranchIntegrationProfileCreate(BranchIntegrationProfileBase):
    whatsapp_api_token: Optional[str] = None
    ai_api_token: Optional[str] = None
    branch_ids: list[int] = Field(default_factory=list)


class BranchIntegrationProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    is_shared: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    whatsapp_provider: Optional[str] = Field(default=None, max_length=30)
    whatsapp_api_url: Optional[str] = Field(default=None, max_length=500)
    whatsapp_phone_number_id: Optional[str] = Field(default=None, max_length=120)
    ai_api_url: Optional[str] = Field(default=None, max_length=500)
    whatsapp_api_token: Optional[str] = None
    ai_api_token: Optional[str] = None
    branch_ids: Optional[list[int]] = None


class BranchIntegrationProfileResponse(BranchIntegrationProfileBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    whatsapp_has_token: bool = False
    ai_has_token: bool = False
    branch_ids: list[int] = Field(default_factory=list)


class BranchIntegrationsResponse(BaseModel):
    branch_id: int
    branch_name: str
    integration_profile_id: Optional[int] = None
    integration_profile_name: Optional[str] = None
    use_shared_profile: bool = False
    shared_branch_ids: list[int] = Field(default_factory=list)
    whatsapp_enabled: bool = False
    whatsapp_provider: str = "webhook"
    whatsapp_api_url: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_has_token: bool = False
    ai_api_url: Optional[str] = None
    ai_has_token: bool = False


class BranchIntegrationsUpdate(BaseModel):
    mode: Literal["shared", "own"] = "own"
    integration_profile_id: Optional[int] = None
    whatsapp_enabled: Optional[bool] = None
    whatsapp_provider: Optional[str] = Field(default=None, max_length=30)
    whatsapp_api_url: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_api_token: Optional[str] = None
    ai_api_url: Optional[str] = None
    ai_api_token: Optional[str] = None
