from pydantic import BaseModel, ConfigDict


class MessageResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    message: str
    version: str
    database: str


class ErrorResponse(BaseModel):
    detail: str


class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)