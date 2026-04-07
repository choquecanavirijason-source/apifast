from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class BranchBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    address: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)


class BranchSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None


class BranchResponse(BranchSummary):
    pass