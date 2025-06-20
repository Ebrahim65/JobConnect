from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum

class VerificationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class VerificationRequest(BaseModel):
    document_urls: list[str] = Field(
        ...,
        min_items=1,
        description="List of URLs to verification documents"
    )
    additional_info: Optional[str] = None

class VerificationStatusUpdate(BaseModel):
    status: VerificationStatus
    notes: Optional[str] = None