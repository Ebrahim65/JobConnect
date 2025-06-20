from fastapi import APIRouter, Depends, HTTPException
import asyncpg

from ..database import get_db

public_router =  APIRouter(prefix="/public", tags=["public"])

@public_router.get("/top-rated")
async def get_top_rated_technicians(conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("""
        SELECT 
            t.technician_id,
            t.name,
            t.surname,
            COALESCE(AVG(r.rating), 0) AS avg_rating,
            (
                SELECT r2.comment
                FROM review r2
                WHERE r2.technician_id = t.technician_id
                AND r2.comment IS NOT NULL
                ORDER BY r2.rating DESC, r2.created_at DESC
                LIMIT 1
            ) AS top_review
        FROM technician t
        LEFT JOIN review r ON r.technician_id = t.technician_id
        GROUP BY t.technician_id
        ORDER BY avg_rating DESC
        LIMIT 5
    """)
    return [dict(row) for row in rows]


@public_router.get("/most-liked")
async def get_most_liked_technicians(conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("""
        SELECT t.technician_id, t.name, t.surname, COUNT(f.id) as favorites_count
        FROM technician t
        LEFT JOIN favorite_technician f ON t.technician_id = f.technician_id
        GROUP BY t.technician_id
        ORDER BY favorites_count DESC
        LIMIT 5
    """)
    return [dict(r) for r in rows]

@public_router.get("/technician/{technician_id}/profile")
async def get_full_technician_profile(technician_id: str, conn=Depends(get_db)):
    tech = await conn.fetchrow("SELECT * FROM technician WHERE technician_id = $1", technician_id)
    if not tech:
        raise HTTPException(404)

    certifications = await conn.fetch("SELECT * FROM technician_certification WHERE technician_id = $1", technician_id)
    qualifications = await conn.fetch("SELECT * FROM technician_qualification WHERE technician_id = $1", technician_id)
    payments = await conn.fetch("SELECT * FROM technician_payment_detail WHERE technician_id = $1", technician_id)

    return {
        "profile": dict(tech),
        "certifications": [dict(c) for c in certifications],
        "qualifications": [dict(q) for q in qualifications],
        "payment_details": [dict(p) for p in payments],
    }
