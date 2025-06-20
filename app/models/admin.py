# app/models/admin.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime

class AdminOut(BaseModel):
    admin_id: UUID
    name: str
    surname: str
    email: EmailStr
    phone_number: str
    role: str
    created_at: datetime

class AdminUpdate(BaseModel):
    name: Optional[str]
    surname: Optional[str]
    phone_number: Optional[str]
    role: Optional[str]
