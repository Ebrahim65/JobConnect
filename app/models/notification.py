from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class NotificationBase(BaseModel):
    message: str = Field(..., max_length=500)
    is_read: bool = False

class NotificationOut(NotificationBase):
    notification_id: str
    recipient_id: str
    sender_id: Optional[str]
    created_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }