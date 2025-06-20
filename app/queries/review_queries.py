# app/queries/review_queries.py
from typing import Optional, Dict, Any, List
import asyncpg

async def create_review(
    conn: asyncpg.Connection,
    booking_id: str,
    client_id: str,
    technician_id: str,
    rating: float,
    comment: Optional[str] = None
) -> str:
    """Create a new review"""
    return await conn.fetchval(
        """
        INSERT INTO review (
            booking_id, client_id, technician_id,
            rating, comment
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING review_id
        """,
        booking_id, client_id, technician_id,
        rating, comment
    )

async def get_review_by_id(
    conn: asyncpg.Connection,
    review_id: str
) -> Optional[Dict[str, Any]]:
    """Get a review with client details"""
    return await conn.fetchrow(
        """
        SELECT 
            r.*,
            c.name as client_name,
            c.surname as client_surname
        FROM review r
        JOIN client c ON r.client_id = c.client_id
        WHERE r.review_id = $1
        """,
        review_id
    )

async def get_technician_reviews(
    conn: asyncpg.Connection,
    technician_id: str
) -> Dict[str, Any]:
    """Get all reviews for a technician with stats"""
    reviews = await conn.fetch(
        """
        SELECT 
            r.*,
            c.name as client_name,
            c.surname as client_surname
        FROM review r
        JOIN client c ON r.client_id = c.client_id
        WHERE r.technician_id = $1
        ORDER BY r.created_at DESC
        """,
        technician_id
    )
    
    avg_rating = await conn.fetchval(
        """
        SELECT COALESCE(AVG(rating), 0)
        FROM review
        WHERE technician_id = $1
        """,
        technician_id
    )
    
    return {
        "average_rating": round(avg_rating, 2),
        "total_reviews": len(reviews),
        "reviews": reviews
    }