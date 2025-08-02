# app/models/client.py
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class ClientOut(BaseModel):
    client_id: UUID
    name: str
    surname: str
    email: str
    phone_number: str
    location_name: str
    created_at: str  # or datetime if you prefer
    profile_picture_url: Optional[str] = None

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat()
        }

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    phone_number: Optional[str] = None
    location_name: Optional[str] = None
    profile_picture_url: Optional[str] = None

class FavoriteTechnician(BaseModel):
    technician_id: UUID

class FavoriteTechnicianOut(BaseModel):
    technician_id: UUID
    name: str
    surname: str
    rating: float

class ClientDashboard(BaseModel):
    profile_picture_url: Optional[str] = None
    active_bookings: int
    pending_payments: int
    favorite_technicians: list[FavoriteTechnicianOut]
