# app/routes/reviews.py
from fastapi import APIRouter, Depends, HTTPException, Query
import asyncpg
from datetime import datetime
from typing import List, Optional

from ..database import get_db
from ..utils.auth import get_current_user
from ..models.review import ReviewCreate, ReviewOut, TechnicianReviews, ReviewUpdate

reviews_router = APIRouter(prefix="/reviews", tags=["Reviews"])

@reviews_router.post("/", response_model=ReviewOut, status_code=201)
async def create_review(
    review: ReviewCreate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    def normalize_uuid(uuid_str):
        return str(uuid_str).lower().replace('-', '')
    
    
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can create reviews")
    
    # Verify booking exists and belongs to client
    booking = await conn.fetchrow(
        """
        SELECT client_id, technician_id, status
        FROM booking
        WHERE booking_id = $1
        """,
        review.booking_id
    )
    b_client_id = normalize_uuid(booking["client_id"])
    c_current_user = normalize_uuid(current_user["id"])
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b_client_id != c_current_user:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["status"] != "completed":
        raise HTTPException(status_code=400, detail="Booking must be completed before reviewing")
    
    # Check if review already exists
    exists = await conn.fetchrow(
        "SELECT 1 FROM review WHERE booking_id = $1 AND client_id = $2",
        review.booking_id, current_user["id"]
    )
    if exists:
        raise HTTPException(status_code=400, detail="You already reviewed this booking")
    
    # Create review
    review_id = await conn.fetchval(
        """
        INSERT INTO review (
            booking_id, client_id, technician_id,
            rating, comment
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING review_id
        """,
        review.booking_id, current_user["id"], booking["technician_id"],
        review.rating, review.comment
    )
    
    # Create notification
    await conn.execute(
        """
        INSERT INTO notification (message, recipient_id)
        VALUES ($1, $2)
        """,
        f"New review received (rating: {review.rating})",
        booking["technician_id"]
    )
    
    review_data = await get_review(str(review_id), conn)
    return ReviewOut(**review_data)

@reviews_router.get("/{review_id}", response_model=ReviewOut)
async def get_review_by_id(
    review_id: str,
    conn: asyncpg.Connection = Depends(get_db)
):
    return await get_review(review_id, conn)

@reviews_router.get("/technician/{technician_id}", response_model=TechnicianReviews)
async def get_technician_reviews(
    technician_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    conn: asyncpg.Connection = Depends(get_db)
):
    # Get paginated reviews
    offset = (page - 1) * per_page
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
        LIMIT $2 OFFSET $3
        """,
        technician_id, per_page, offset
    )
    
    # Get total count and average rating
    stats = await conn.fetchrow(
        """
        SELECT 
            COUNT(*) as total_reviews,
            COALESCE(AVG(rating), 0) as average_rating
        FROM review
        WHERE technician_id = $1
        """,
        technician_id
    )
    
    return {
        "average_rating": round(float(stats["average_rating"]), 2),
        "total_reviews": stats["total_reviews"],
        "reviews": [dict(review) for review in reviews]
    }

@reviews_router.get("/me/", response_model=TechnicianReviews)
async def get_my_reviews(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")
    
    return await get_technician_reviews(current_user["id"], page, per_page, conn)

@reviews_router.put("/{review_id}", response_model=ReviewOut)
async def update_review(
    review_id: str,
    review_update: ReviewUpdate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    # Verify review exists and belongs to client
    review = await conn.fetchrow(
        "SELECT client_id FROM review WHERE review_id = $1",
        review_id
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your review")
    
    # Update review
    await conn.execute(
        """
        UPDATE review
        SET rating = $1, comment = $2, updated_at = NOW()
        WHERE review_id = $3
        """,
        review_update.rating, review_update.comment, review_id
    )
    
    return await get_review(review_id, conn)

@reviews_router.delete("/{review_id}")
async def delete_review(
    review_id: str,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    # Verify review exists and belongs to client
    review = await conn.fetchrow(
        "SELECT client_id FROM review WHERE review_id = $1",
        review_id
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your review")
    
    # Delete review
    await conn.execute(
        "DELETE FROM review WHERE review_id = $1",
        review_id
    )
    
    return {"message": "Review deleted successfully"}

async def get_review(review_id: str, conn: asyncpg.Connection) -> dict:
    review = await conn.fetchrow(
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
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review
__all__ = ["reviews_router"]