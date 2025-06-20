# app/models/certification.py
from pydantic import BaseModel, HttpUrl
from typing import Optional
from uuid import UUID
from datetime import date, datetime

class CertificationBase(BaseModel):
    certification_name: str
    issuing_organization: str
    issue_date: Optional[date] = None
    expiration_date: Optional[date] = None
    credential_id: Optional[str] = None
    credential_url: Optional[HttpUrl] = None

class CertificationCreate(CertificationBase):
    pass

class CertificationOut(CertificationBase):
    certification_id: UUID
    technician_id: UUID
    created_at: datetime

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }

class CertificationUpdate(BaseModel):
    certification_name: Optional[str] = None
    issuing_organization: Optional[str] = None
    issue_date: Optional[date] = None
    expiration_date: Optional[date] = None
    credential_id: Optional[str] = None
    credential_url: Optional[HttpUrl] = None