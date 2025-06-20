from fastapi import APIRouter, Depends, HTTPException
import asyncpg
from datetime import datetime, timedelta
from ..database import get_db
from ..utils.auth import get_current_user

admin_router = APIRouter(prefix="/admin", tags=["Admin Reports"])

# Utility to ensure only admins access these routes
async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@admin_router.get("/registers")
async def registration_report(conn: asyncpg.Connection = Depends(get_db), user=Depends(require_admin)):
    client_count = await conn.fetchval("SELECT COUNT(*) FROM client")
    tech_count = await conn.fetchval("SELECT COUNT(*) FROM technician")
    recent_clients = await conn.fetch("SELECT name, email, created_at FROM client ORDER BY created_at DESC LIMIT 10")
    recent_techs = await conn.fetch("SELECT name, email, created_at FROM technician ORDER BY created_at DESC LIMIT 10")
    return {
        "total_clients": client_count,
        "total_technicians": tech_count,
        "recent_clients": [dict(r) for r in recent_clients],
        "recent_technicians": [dict(r) for r in recent_techs]
    }

@admin_router.get("/logins")
async def login_report(conn: asyncpg.Connection = Depends(get_db), user=Depends(require_admin)):
    records = await conn.fetch("""
        SELECT email, type, login_time
        FROM login_history
        ORDER BY login_time DESC
        LIMIT 50
    """)
    return [dict(r) for r in records]

@admin_router.get("/bookings")
async def booking_report(conn: asyncpg.Connection = Depends(get_db), user=Depends(require_admin)):
    stats = await conn.fetchrow("""
        SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'accepted') AS accepted,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
        FROM booking
    """)
    recent = await conn.fetch("""
        SELECT booking_id, service_type, status, start_date, end_date
        FROM booking
        ORDER BY created_at DESC
        LIMIT 20
    """)
    return {
        "stats": dict(stats),
        "recent_bookings": [dict(r) for r in recent]
    }
