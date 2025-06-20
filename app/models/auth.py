# app/models/auth.py
from uuid import UUID
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: Optional[str] = None
    type: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    email: EmailStr
    current_password: str
    new_password: str
    confirm_password: str

class ClientCreate(BaseModel):
    name: str
    surname: str
    email: EmailStr
    phone_number: str
    password: str
    location_name: str
    

class TechnicianCreate(BaseModel):
    name: str
    surname: str
    email: EmailStr
    phone_number: str
    password: str
    location_name: str
    latitude: float
    longitude: float
    service_types: List[str]  # Make sure this is List[str]
    experience_years: Optional[float] = None
    
    class Config:
        json_encoders = {
            UUID: lambda v: str(v),
        }

class AdminCreate(BaseModel):
    name: str
    surname: str
    email: EmailStr
    phone_number: str
    password: str
    role: str

class AdminOut(BaseModel):
    admin_id: str
    name: str
    surname: str
    email: EmailStr
    phone_number: str
    role: str
    created_at: str