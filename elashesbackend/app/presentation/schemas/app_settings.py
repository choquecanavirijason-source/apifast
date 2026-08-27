from typing import Optional

from pydantic import BaseModel


class AppSettingsResponse(BaseModel):
    logo_url: Optional[str] = None
    logo_original_name: Optional[str] = None
