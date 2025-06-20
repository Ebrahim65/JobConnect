from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID
from typing import List
from ..database import get_db
from ..models.schedule import TechnicianScheduleCreate, TechnicianScheduleOut, TechnicianScheduleUpdate
from ..utils.auth import get_current_user
import asyncpg
from datetime import date, datetime, timedelta

schedule_router = APIRouter(prefix="/schedule", tags=["Technician Schedule"])

@schedule_router.post("/", response_model=TechnicianScheduleOut)
async def create_schedule(
    schedule: TechnicianScheduleCreate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can create schedules")

    schedule_id = await conn.fetchval("""
        INSERT INTO technician_schedule (
            technician_id, start_time, end_time, specific_date, day_of_week
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING schedule_id
    """, current_user["id"], schedule.start_time, schedule.end_time, schedule.specific_date, schedule.day_of_week)

    row = await conn.fetchrow("SELECT * FROM technician_schedule WHERE schedule_id = $1", schedule_id)
    return dict(row)

@schedule_router.get("/", response_model=List[TechnicianScheduleOut])
async def get_my_schedule(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can view their schedule")
    
    rows = await conn.fetch("""
        SELECT * FROM technician_schedule WHERE technician_id = $1 ORDER BY start_time
    """, current_user["id"])

    return [dict(r) for r in rows]

@schedule_router.put("/{schedule_id}", response_model=TechnicianScheduleOut)
async def update_schedule(
    schedule_id: UUID,
    update: TechnicianScheduleUpdate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can update schedules")

    row = await conn.fetchrow("SELECT * FROM technician_schedule WHERE schedule_id = $1 AND technician_id = $2", schedule_id, current_user["id"])
    if not row:
        raise HTTPException(status_code=404, detail="Schedule not found")

    await conn.execute("""
        UPDATE technician_schedule
        SET 
            start_time = COALESCE($1, start_time),
            end_time = COALESCE($2, end_time),
            specific_date = COALESCE($3, specific_date),
            day_of_week = COALESCE($4, day_of_week),
            updated_at = now()
        WHERE schedule_id = $5
    """, update.start_time, update.end_time, update.specific_date, update.day_of_week, schedule_id)

    updated = await conn.fetchrow("SELECT * FROM technician_schedule WHERE schedule_id = $1", schedule_id)
    return dict(updated)

@schedule_router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can delete schedules")

    result = await conn.execute("""
        DELETE FROM technician_schedule 
        WHERE schedule_id = $1 AND technician_id = $2
    """, schedule_id, current_user["id"])

    if result[-1] == "0":
        raise HTTPException(status_code=404, detail="Schedule not found")

    return {"message": "Schedule deleted"}

@schedule_router.get("/technician/{technician_id}", response_model=List[TechnicianScheduleOut])
async def get_technician_available_slots(
    technician_id: str,
    date: date = None,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    """
    Get available time slots for a technician with booking conflict prevention
    """
    # Verify technician exists and is available
    technician = await conn.fetchrow(
        "SELECT is_available FROM technician WHERE technician_id = $1", 
        technician_id
    )
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")
    if not technician["is_available"]:
        raise HTTPException(status_code=400, detail="Technician is not currently available")

    # Calculate date range (today + next 30 days)
    today = datetime.now().date()
    end_date = today + timedelta(days=30)
    
    # Build base query
    query = """
        SELECT * FROM technician_schedule 
        WHERE technician_id = $1
        AND start_time > NOW()
    """
    params = [technician_id]

    # Add date filtering if specified
    if date:
        query += """
            AND (
                (specific_date = $2) OR
                (day_of_week = EXTRACT(DOW FROM $2::date) AND specific_date IS NULL)
            )
        """
        params.append(date)
    else:
        query += """
            AND (
                (specific_date BETWEEN $2 AND $3) OR
                (day_of_week IS NOT NULL AND specific_date IS NULL)
            )
        """
        params.extend([today, end_date])

    query += " ORDER BY start_time"
    schedule_rows = await conn.fetch(query, *params)

    # Get existing bookings that could conflict
    bookings_query = """
        SELECT start_date, end_date FROM booking
        WHERE technician_id = $1
        AND status NOT IN ('cancelled', 'rejected', 'completed')
        AND start_date > NOW()
    """
    if date:
        bookings_query += " AND DATE(start_date) = $2"
        bookings_params = [technician_id, date]
    else:
        bookings_query += " AND start_date BETWEEN $2 AND $3"
        bookings_params = [technician_id, today, end_date]

    bookings = await conn.fetch(bookings_query, *bookings_params)

    # Process available slots
    available_slots = []
    for schedule in schedule_rows:
        slot_start = schedule['start_time']
        slot_end = schedule['end_time']
        
        # Check for conflicts with existing bookings
        conflict = False
        for booking in bookings:
            booking_start = booking['start_date']
            booking_end = booking['end_date']
            
            # Check if the schedule slot overlaps with any booking
            if not (slot_end <= booking_start or slot_start >= booking_end):
                conflict = True
                break
        
        if not conflict:
            available_slots.append({
                'schedule_id': schedule['schedule_id'],
                'technician_id': schedule['technician_id'],
                'start_time': slot_start,
                'end_time': slot_end,
                'type': 'specific' if schedule['specific_date'] else 'recurring',
                'day_of_week': schedule['day_of_week'],
                'specific_date': schedule['specific_date']
            })

    return available_slots
