# app/models/booking.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum
from uuid import UUID

class BookingStatus(str, Enum):
    PENDING = "pending"
    OFFERED = "offered"  # New status
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class BookingCreate(BaseModel):
    technician_id: str
    service_type: str
    description: str
    start_date: datetime
    end_date: Optional[datetime]


class BookingOut(BaseModel):
    booking_id: UUID
    client_id: UUID  # Changed from str to UUID
    technician_id: UUID  # Changed from str to UUID
    service_type: str
    description: str
    price: Optional[float]
    status: BookingStatus
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    created_at: datetime
    client_name: str
    client_surname: str
    technician_name: str
    technician_surname: str

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat()
        }

class BookingCancel(BaseModel):
    reason: str = Field(..., min_length=10, description="Reason for cancellation")

class BookingStatusUpdate(BaseModel):
    status: BookingStatus
    price: Optional[float] = None

class BookingQueryParams(BaseModel):
    status: Optional[BookingStatus] = None
    client_id: Optional[str] = None
    technician_id: Optional[str] = None

class BookingOffer(BaseModel):
    price: float
    message: Optional[str] = None

class BookingResponse(BaseModel):
    accept: bool
    message: Optional[str] = None

class BookingPayment(BaseModel):
    booking_id: UUID
    service_type: str
    description: str
    status: str
    price: float
    created_at: datetime
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    technician_id: UUID
    technician_name: str
    technician_surname: str