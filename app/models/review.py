from typing import Optional
from pydantic import BaseModel, Field, confloat
from datetime import datetime
from uuid import UUID

class ReviewCreate(BaseModel):
    booking_id: str
    rating: confloat(ge=0, le=5) = Field(..., description="Rating between 0 and 5") # type: ignore
    comment: Optional[str] = None

class ReviewUpdate(BaseModel):
    rating: confloat(ge=0, le=5) = Field(..., description="Rating between 0 and 5") # type: ignore
    comment: Optional[str] = None
    

class ReviewOut(BaseModel):
    review_id: UUID
    booking_id: UUID
    client_id: UUID
    technician_id: UUID
    rating: float
    comment: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    client_name: str
    client_surname: str

class TechnicianReviews(BaseModel):
    average_rating: float
    total_reviews: int
    reviews: list[ReviewOut]