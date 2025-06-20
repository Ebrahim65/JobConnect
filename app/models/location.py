from pydantic import BaseModel, Field
from typing import Optional

class LocationBase(BaseModel):
    address: str = Field(..., example="123 Main St")
    city: str = Field(..., example="Johannesburg")
    zip_code: Optional[str] = Field(None, example="2000")
    region: Optional[str] = Field(None, example="Gauteng")
    country: str = Field(default="South Africa", example="South Africa")
    latitude: float = Field(..., ge=-90, le=90, example=-26.2041)
    longitude: float = Field(..., ge=-180, le=180, example=28.0473)

class LocationCreate(LocationBase):
    pass

class LocationOut(LocationBase):
    location_id: str

    class Config:
        json_encoders = {
            "location_id": lambda v: str(v),
        }