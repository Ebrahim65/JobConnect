# app/queries/payment_queries.py
from typing import Optional, Dict, Any, List
import asyncpg

async def create_payment(
    conn: asyncpg.Connection,
    booking_id: str,
    client_id: str,
    technician_id: str,
    amount: float,
    payment_method: str
) -> str:
    """Create a new payment record"""
    return await conn.fetchval(
        """
        INSERT INTO payment (
            booking_id, client_id, technician_id,
            amount, payment_method
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING payment_id
        """,
        booking_id, client_id, technician_id,
        amount, payment_method
    )

async def get_payment_by_id(
    conn: asyncpg.Connection,
    payment_id: str
) -> Optional[Dict[str, Any]]:
    """Get a payment by its ID"""
    return await conn.fetchrow(
        "SELECT * FROM payment WHERE payment_id = $1",
        payment_id
    )

async def update_payment_status(
    conn: asyncpg.Connection,
    payment_id: str,
    status: str
) -> Optional[Dict[str, Any]]:
    """Update a payment's status"""
    return await conn.fetchrow(
        """
        UPDATE payment
        SET payment_status = $1,
            transaction_date = CASE WHEN $1 = 'completed' THEN NOW() ELSE transaction_date END
        WHERE payment_id = $2
        RETURNING *
        """,
        status, payment_id
    )

async def get_client_payments(
    conn: asyncpg.Connection,
    client_id: str,
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get payments for a client with optional status filter"""
    query = """
        SELECT p.*, b.service_type
        FROM payment p
        JOIN booking b ON p.booking_id = b.booking_id
        WHERE p.client_id = $1
    """
    params = [client_id]
    
    if status:
        query += " AND p.payment_status = $2"
        params.append(status)
    
    query += " ORDER BY p.transaction_date DESC"
    
    return await conn.fetch(query, *params)