from fastapi import APIRouter, Depends, HTTPException
from ..models.location import LocationCreate, LocationOut
from ..utils.auth import get_current_user
from ..database import get_db
import asyncpg

location_router = APIRouter(prefix="/locations", tags=["Locations"])

@location_router.post("/", response_model=LocationOut, status_code=201)
async def create_location(
    location: LocationCreate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    location_id = await conn.fetchval(
        """
        INSERT INTO location (
            address, city, zip_code, region, country, latitude, longitude
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING location_id
        """,
        location.address, location.city, location.zip_code,
        location.region, location.country, location.latitude, location.longitude
    )
    return {**location.dict(), "location_id": str(location_id)}