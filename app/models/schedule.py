from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, date

class TechnicianScheduleCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    specific_date: Optional[date] = None
    day_of_week: Optional[int] = None  # 0 = Monday, ..., 6 = Sunday

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
