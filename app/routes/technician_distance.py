# app/routes/technician_distance.py
from fastapi import APIRouter, Depends, HTTPException
from ..utils.auth import get_current_user
from ..database import get_db
from ..models.distance_log import DistanceLogCreate, DistanceLogOut
import asyncpg
from uuid import UUID

distance_router = APIRouter(prefix="/technician-distance", tags=["Technician Distance"])

# POST: Technician creates or updates their log
@distance_router.post("/log", response_model=DistanceLogOut)
async def log_distance(
    payload: DistanceLogCreate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can log distance")

    existing = await conn.fetchrow("""
        SELECT log_id FROM technician_distance_log 
        WHERE technician_id = $1 AND log_date = $2
    """, current_user["id"], payload.log_date)

    if existing:
        log = await conn.fetchrow("""
            UPDATE technician_distance_log
            SET distance_km = $1, jobs_completed = $2, updated_at = now()
            WHERE log_id = $3
            RETURNING *
        """, payload.distance_km, payload.jobs_completed, existing["log_id"])
    else:
        log = await conn.fetchrow("""
            INSERT INTO technician_distance_log (technician_id, log_date, distance_km, jobs_completed)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        """, current_user["id"], payload.log_date, payload.distance_km, payload.jobs_completed)

    return dict(log)

# GET: Technician views their logs
@distance_router.get("/my-logs", response_model=list[DistanceLogOut])
async def get_my_logs(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access their logs")

    rows = await conn.fetch("""
        SELECT * FROM technician_distance_log 
        WHERE technician_id = $1
        ORDER BY log_date DESC
    """, current_user["id"])
    return [dict(row) for row in rows]

# GET: Admin views any technician’s logs
@distance_router.get("/technician/{technician_id}", response_model=list[DistanceLogOut])
async def get_logs_by_technician(
    technician_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view technician logs")

    rows = await conn.fetch("""
        SELECT * FROM technician_distance_log
        WHERE technician_id = $1
        ORDER BY log_date DESC
    """, technician_id)
    return [dict(row) for row in rows]
