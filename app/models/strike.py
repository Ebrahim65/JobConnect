from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum

class UserType(str, Enum):
    CLIENT = "client"
    TECHNICIAN = "technician"

class StrikeBase(BaseModel):
    reason: str = Field(..., max_length=500)

class StrikeCreate(StrikeBase):
    user_id: str
    user_type: UserType

class StrikeOut(StrikeBase):
    strike_id: str
    admin_id: str
    created_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }