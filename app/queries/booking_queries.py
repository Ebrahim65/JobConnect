# app/queries/booking_queries.py
from typing import Optional, Dict, Any, List
import asyncpg
from datetime import datetime

async def create_booking(
    conn: asyncpg.Connection,
    client_id: str,
    technician_id: str,
    service_type: str,
    description: str,
    start_date: datetime,
    end_date: datetime
) -> str:
    """Create a new booking"""
    return await conn.fetchval(
        """
        INSERT INTO booking (
            client_id, technician_id, service_type,
            description, start_date, end_date
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING booking_id
        """,
        client_id, technician_id, service_type,
        description, start_date, end_date
    )

async def get_booking_by_id(
    conn: asyncpg.Connection,
    booking_id: str
) -> Optional[Dict[str, Any]]:
    """Get a booking with client and technician details"""
    return await conn.fetchrow(
        """
        SELECT 
            b.*,
            c.name as client_name,
            c.surname as client_surname,
            t.name as technician_name,
            t.surname as technician_surname
        FROM booking b
        JOIN client c ON b.client_id = c.client_id
        JOIN technician t ON b.technician_id = t.technician_id
        WHERE b.booking_id = $1
        """,
        booking_id
    )

async def update_booking_status(
    conn: asyncpg.Connection,
    booking_id: str,
    status: str,
    price: Optional[float] = None
) -> Optional[Dict[str, Any]]:
    """Update a booking's status and optional price"""
    return await conn.fetchrow(
        """
        UPDATE booking
        SET status = $1, price = COALESCE($2, price)
        WHERE booking_id = $3
        RETURNING *
        """,
        status, price, booking_id
    )

async def get_client_bookings(
    conn: asyncpg.Connection,
    client_id: str,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get bookings for a client with optional status filter"""
    query = """
        SELECT 
            b.*,
            t.name as technician_name,
            t.surname as technician_surname
        FROM booking b
        JOIN technician t ON b.technician_id = t.technician_id
        WHERE b.client_id = $1
    """
    params = [client_id]
    
    if status:
        query += " AND b.status = $2"
        params.append(status)
    
    query += " ORDER BY b.created_at DESC"
    
    return await conn.fetch(query, *params)