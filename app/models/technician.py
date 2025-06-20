# app/models/technician.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime
from enum import Enum
from uuid import UUID

class TechnicianType(str, Enum):
    IN_APP = "in_app"
    EXTERNAL = "external"

class BaseTechnician(BaseModel):
    name: str
    location_name: str
    latitude: float
    longitude: float
    distance_km: float = Field(..., description="Distance from search location in km")
    rating: str

class InAppTechnician(BaseTechnician):
    technician_id: UUID
    surname: str
    email: str
    phone_number: str
    service_types: List[str]
    experience_years: Optional[float]
    is_verified: bool
    is_available: bool
    avg_rating: float
    profile_picture_url: Optional[str] = None
    bio: Optional[str] = None

    class Config:
        json_encoders = {float: lambda v: round(v, 2)}

class ExternalTechnician(BaseTechnician):
    id: str
    type: TechnicianType = TechnicianType.EXTERNAL
    place_id: str
    external_source: str = "google_maps"
    is_available: bool = True
    
    @validator('rating')
    def validate_rating(cls, v):
        if v == "N/A":
            return "Not rated"
        return v

class TechnicianAvailability(BaseModel):
    is_available: bool

class TechnicianVerification(BaseModel):
    is_verified: bool

class TechnicianCertification(BaseModel):
    certification_name: str
    issuing_organization: str
    issue_date: Optional[datetime]
    expiration_date: Optional[datetime]
    credential_id: Optional[str]
    credential_url: Optional[str]

class TechnicianQualification(BaseModel):
    qualification_name: str
    institution: str
    year_obtained: Optional[int]

class TechnicianPaymentDetail(BaseModel):
    payment_method: str
    account_name: Optional[str]
    account_number: Optional[str]
    bank_name: Optional[str]
    branch_code: Optional[str]
    swift_code: Optional[str]
    paypal_email: Optional[str]
    other_details: Optional[dict]
    is_primary: bool = False

class TechnicianSearchResults(BaseModel):
    in_app_technicians: List[InAppTechnician]
    external_technicians: List[ExternalTechnician]
    search_center_lat: float
    search_center_lng: float
    search_radius_km: int

class TechnicianDashboard(BaseModel):
    profile_picture_url: Optional[str] = None
    pending_requests: int
    accepted_bookings: int
    completed_bookings: int
    total_earnings: float
    recent_bookings: list[dict]  # Or create a proper model if needed

class TechnicianScheduleIn(BaseModel):
    start_time: datetime
    end_time: datetime

class TechnicianScheduleOut(TechnicianScheduleIn):
    schedule_id: UUID

__all__ = [
    'BaseTechnician',
    'InAppTechnician',
    'ExternalTechnician',
    'TechnicianAvailability',
    'TechnicianVerification',
    'TechnicianSearchResults'
]