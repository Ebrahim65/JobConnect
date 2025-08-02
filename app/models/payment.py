# app/models/payment.py
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from uuid import UUID

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class PaymentMethod(str, Enum):
    CARD = "card"
    BANK_TRANSFER = "banking"

class PaymentCreate(BaseModel):
    booking_id: str
    amount: float
    payment_method: PaymentMethod

class PaymentOut(BaseModel):
    payment_id: UUID
    booking_id: UUID
    client_id: UUID
    technician_id: UUID
    amount: float
    service_type: Optional[str]
    payment_method: Optional[PaymentMethod]
    payment_status: PaymentStatus
    transaction_date: Optional[datetime]

    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat()
        }

class PaymentUpdate(BaseModel):
    payment_status: PaymentStatus
