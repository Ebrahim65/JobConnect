from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class TechnicianIncomeOut(BaseModel):
    technician_id: UUID
    technician_name: str
    total_income: float
    total_payments: int
    completed_income: float
    pending_income: float
    failed_income: float
    refunded_income: float
    first_payment_date: Optional[datetime]
    last_payment_date: Optional[datetime]

    class Config:
        orm_mode = True
        json_encoders = {
            UUID: lambda v: str(v),
            datetime: lambda v: v.isoformat()
        }
