from pydantic import BaseModel, validator
from typing import Optional
from uuid import UUID
from datetime import datetime, date, timezone

class TechnicianScheduleCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    specific_date: Optional[date] = None
    day_of_week: Optional[int] = None  # 0 = Monday, ..., 6 = Sunday

    @validator('start_time', 'end_time', pre=True)
    def ensure_naive_utc(cls, v):
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                # Convert to UTC then remove timezone info
                return v.astimezone(timezone.utc).replace(tzinfo=None)
            # Ensure it's treated as UTC even if naive
            return v.replace(tzinfo=None)
        return v
    @validator('start_time', 'end_time', pre=True)
    def parse_datetime(cls, v):
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', ''))
            except ValueError:
                raise ValueError("Invalid datetime format")
        return v

class TechnicianScheduleUpdate(BaseModel):
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    specific_date: Optional[date]
    day_of_week: Optional[int]

class TechnicianScheduleOut(BaseModel):
    schedule_id: UUID
    technician_id: UUID
    start_time: datetime
    end_time: datetime
    specific_date: Optional[date]
    day_of_week: Optional[int]
    created_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
