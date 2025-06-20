# app/models/qualification.py
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class QualificationBase(BaseModel):
    qualification_name: str
    institution: str
    year_obtained: Optional[int] = None

class QualificationCreate(QualificationBase):
    pass

class QualificationOut(QualificationBase):
    qualification_id: UUID
    technician_id: UUID
    created_at: datetime

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat()
        }

class QualificationUpdate(BaseModel):
    qualification_name: Optional[str] = None
    institution: Optional[str] = None
    year_obtained: Optional[int] = None