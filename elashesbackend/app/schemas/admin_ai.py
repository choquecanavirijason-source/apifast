from typing import Optional

from pydantic import BaseModel, Field


class AdminAiSettingsResponse(BaseModel):
    ai_enabled: bool = False
    ai_api_url: Optional[str] = None
    ai_model: str = "gpt-4o-mini"
    ai_has_token: bool = False


class AdminAiSettingsUpdate(BaseModel):
    ai_enabled: Optional[bool] = None
    ai_api_url: Optional[str] = Field(default=None, max_length=500)
    ai_model: Optional[str] = Field(default=None, max_length=120)
    ai_api_token: Optional[str] = None


class AdminAiChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    branch_id: Optional[int] = Field(default=None, ge=1)


class AdminAiChatResponse(BaseModel):
    reply: str
    model: str
    context_summary: dict
