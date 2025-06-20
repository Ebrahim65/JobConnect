# app/queries/client_queries.py
from typing import Optional, Dict, Any
import asyncpg

async def create_client(
    conn: asyncpg.Connection,
    name: str,
    surname: str,
    email: str,
    phone_number: str,
    password_hash: str,
    location_name: str,
    longitude: float,
    latitude: float
) -> str:
    """Create a new client in the database"""
    return await conn.fetchval(
        """
        INSERT INTO client (
            name, surname, email, phone_number,
            password_hash, location_name, location
        )
        VALUES ($1, $2, $3, $4, $5, $6, ST_GeomFromText($7, 4326))
        RETURNING client_id
        """,
        name, surname, email, phone_number,
        password_hash, location_name, f"POINT({longitude} {latitude})"
    )

async def get_client_by_id(
    conn: asyncpg.Connection,
    client_id: str
) -> Optional[Dict[str, Any]]:
    """Get a client by their ID"""
    return await conn.fetchrow(
        """
        SELECT 
            client_id, name, surname, email, phone_number,
            location_name, 
            ST_X(location::geometry) as longitude,
            ST_Y(location::geometry) as latitude,
            created_at
        FROM client
        WHERE client_id = $1
        """,
        client_id
    )

async def update_client(
    conn: asyncpg.Connection,
    client_id: str,
    updates: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Update client information"""
    set_clauses = []
    params = []
    idx = 1
    
    if "location" in updates:
        longitude = updates.pop("longitude")
        latitude = updates.pop("latitude")
        set_clauses.append("location = ST_GeomFromText($%d, 4326)" % idx)
        params.append(f"POINT({longitude} {latitude})")
        idx += 1
    
    for field, value in updates.items():
        if value is not None:
            set_clauses.append(f"{field} = ${idx}")
            params.append(value)
            idx += 1
    
    if not set_clauses:
        return None
    
    query = f"""
        UPDATE client
        SET {', '.join(set_clauses)}
        WHERE client_id = ${idx}
        RETURNING 
            client_id, name, surname, email, phone_number,
            location_name, 
            ST_X(location::geometry) as longitude,
            ST_Y(location::geometry) as latitude,
            created_at
    """
    params.append(client_id)
    
    return await conn.fetchrow(query, *params)

async def get_client_favorites(
    conn: asyncpg.Connection,
    client_id: str
) -> list[Dict[str, Any]]:
    """Get a client's favorite technicians"""
    return await conn.fetch(
        """
        SELECT 
            t.technician_id, t.name, t.surname,
            t.service_types, t.is_available,
            ST_Distance(t.location, c.location) / 1000 as distance_km
        FROM favorite_technician f
        JOIN technician t ON f.technician_id = t.technician_id
        JOIN client c ON f.client_id = c.client_id
        WHERE f.client_id = $1
        """,
        client_id
    )