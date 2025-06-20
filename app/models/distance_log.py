# app/models/distance_log.py
from pydantic import BaseModel
from uuid import UUID
from datetime import date
from typing import Optional

class DistanceLogCreate(BaseModel):
    log_date: date
    distance_km: float
    jobs_completed: int

class DistanceLogOut(BaseModel):
    log_id: UUID
    technician_id: UUID
    log_date: date
    distance_km: float
    jobs_completed: int
    created_at: str
