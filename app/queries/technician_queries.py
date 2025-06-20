# app/queries/technician_queries.py
from typing import Optional, Dict, Any, List
import asyncpg
from ..utils.haversine import haversine

async def create_technician(
    conn: asyncpg.Connection,
    name: str,
    surname: str,
    email: str,
    phone_number: str,
    password_hash: str,
    location_name: str,
    longitude: float,
    latitude: float,
    service_types: List[str],
    experience_years: Optional[float] = None
) -> str:
    """Create a new technician in the database"""
    return await conn.fetchval(
        """
        INSERT INTO technician (
            name, surname, email, phone_number, password_hash,
            location_name, location, service_types, experience_years
        )
        VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromText($7, 4326), $8, $9)
        RETURNING technician_id
        """,
        name, surname, email, phone_number, password_hash,
        location_name, f"POINT({longitude} {latitude})",
        service_types, experience_years
    )

async def get_technician_by_id(
    conn: asyncpg.Connection,
    technician_id: str
) -> Optional[Dict[str, Any]]:
    """Get a technician by their ID with average rating"""
    return await conn.fetchrow(
        """
        SELECT 
            t.*,
            ST_X(t.location::geometry) as longitude,
            ST_Y(t.location::geometry) as latitude,
            COALESCE(AVG(r.rating), 0) as avg_rating,
            COUNT(r.review_id) as review_count
        FROM technician t
        LEFT JOIN review r ON t.technician_id = r.technician_id
        WHERE t.technician_id = $1
        GROUP BY t.technician_id
        """,
        technician_id
    )

async def search_technicians(
    conn: asyncpg.Connection,
    search_string: str,
    latitude: float,
    longitude: float,
    radius_km: float,
    limit: int
) -> List[Dict[str, Any]]:
    """
    Search technicians by service type or name within a radius
    """
    search_pattern = f"%{search_string.lower()}%"
    
    # First get all potentially matching technicians
    query = """
        SELECT 
            t.technician_id,
            t.name,
            t.surname,
            t.email,
            t.phone_number,
            t.location_name,
            ST_Y(t.location::geometry) as latitude,
            ST_X(t.location::geometry) as longitude,
            t.service_types,
            t.experience_years,
            t.is_verified,
            t.is_available,
            COALESCE(AVG(r.rating), 0) as avg_rating
        FROM public.technician t
        LEFT JOIN public.review r ON t.technician_id = r.technician_id
        WHERE (
            $1 = '' OR
            t.name ILIKE $1 OR
            EXISTS (
                SELECT 1 
                FROM unnest(t.service_types) as st 
                WHERE st ILIKE $1
            )
        )
        AND t.is_available = true
        GROUP BY t.technician_id
    """
    
    technicians = await conn.fetch(query, search_pattern)
    
    # Now filter by distance
    results = []
    for tech in technicians:
        distance = haversine(
            latitude, longitude,
            tech['latitude'], tech['longitude']
        )
        if distance <= radius_km:
            result = dict(tech)
            result['distance_km'] = round(distance, 2)
            results.append(result)
    
    # Sort by distance and limit results
    results.sort(key=lambda x: x['distance_km'])
    return results[:limit]

async def update_technician_availability(
    conn: asyncpg.Connection,
    technician_id: str,
    is_available: bool
) -> Optional[Dict[str, Any]]:
    """Update a technician's availability status"""
    return await conn.fetchrow(
        """
        UPDATE technician
        SET is_available = $1
        WHERE technician_id = $2
        RETURNING *
        """,
        is_available, technician_id
    )