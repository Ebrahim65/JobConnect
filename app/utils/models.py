from pydantic import BaseModel
from typing import Optional

class PaginationParams(BaseModel):
    page: int = 1
    limit: int = 20

class SearchQuery(BaseModel):
    query: str
    location: Optional[dict]  # {latitude: float, longitude: float}

class TimeRange(BaseModel):
    start: str  # ISO format datetime
    end: str    # ISO format datetime