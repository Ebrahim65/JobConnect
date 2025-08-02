from datetime import datetime, timedelta
import io
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import List
from uuid import UUID
import asyncpg
import logging

from xhtml2pdf import pisa
from io import BytesIO
from ..database import get_db
from ..models.technician import BookingLocationStats, TechnicianDashboard, TechnicianDistanceStats, TechnicianSearchResults, InAppTechnician, TechnicianQualification, TechnicianCertification
from ..utils.external_technicians import get_external_technicians
from ..utils.haversine import haversine  # Import the haversine function
from ..utils.auth import get_current_user
from ..utils.file_upload import save_profile_picture
from ..routes.bookings import get_booking, bookings_router
from ..models.booking import BookingCancel, BookingOffer, BookingOut, BookingResponse
import asyncio

technicians_router = APIRouter(prefix="/technicians", tags=["Technicians"])
logger = logging.getLogger(__name__)

@technicians_router.get("/search", response_model=TechnicianSearchResults)
async def search_technicians_endpoint(
    search_string: str = Query("", description="Search term (name or service type)"),
    latitude: float = Query(..., description="Center point latitude"),
    longitude: float = Query(..., description="Center point longitude"),
    radius_km: int = Query(10, gt=0, le=100, description="Search radius in km"),
    limit: int = Query(20, gt=0, le=50, description="Max results per type"),
    conn: asyncpg.Connection = Depends(get_db)
):
    try:
        # Get in-app technicians
        in_app_techs = await conn.fetch(
            """
            SELECT 
                technician_id,
                name,
                surname,
                email,
                phone_number,
                location_name,
                latitude,
                longitude,
                service_types,
                experience_years,
                is_verified,
                is_available,
                (SELECT COALESCE(AVG(rating), 0) FROM review 
                 WHERE technician_id = t.technician_id) as avg_rating
            FROM technician t
            WHERE $1 ILIKE ANY(SELECT unnest(service_types))
                OR name ILIKE '%' || $1 || '%'
                OR surname ILIKE '%' || $1 || '%'
                OR EXISTS (
                    SELECT 1 FROM unnest(service_types) AS service
                    WHERE service ILIKE '%' || $1 || '%'
                )
            """,
            search_string
        )
        
        # Calculate distance for each technician and filter by radius
        filtered_techs = []
        for tech in in_app_techs:
            tech_dict = dict(tech)
            distance = haversine(latitude, longitude, tech['latitude'], tech['longitude'])
            if distance <= radius_km:
                tech_dict['distance_km'] = distance
                tech_dict['rating'] = f"{tech_dict['avg_rating']:.1f}" if tech_dict['avg_rating'] else "Not rated"
                filtered_techs.append(tech_dict)
        
        # Get external technicians (unchanged)
        external_techs = await get_external_technicians(search_string, latitude, longitude, radius_km)
        
        logger.info(f"Found {len(filtered_techs)} in-app and {len(external_techs)} external technicians")
        
        return {
            "in_app_technicians": filtered_techs[:limit],
            "external_technicians": external_techs[:limit],
            "search_center_lat": latitude,
            "search_center_lng": longitude,
            "search_radius_km": radius_km
        }
    except Exception as e:
        logger.error(f"Search failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )

# Temporary test endpoint
@technicians_router.get("/test-search")
async def test_search(service_type: str, conn: asyncpg.Connection = Depends(get_db)):
    return await conn.fetch("SELECT * FROM public.technician WHERE $1 = ANY(service_types) LIMIT 5", service_type)
@technicians_router.get("/debug-technicians")
async def debug_technicians(
    service_type: str,
    conn: asyncpg.Connection = Depends(get_db)
):
    """Debug endpoint to verify raw technician data"""
    service_type_lower = service_type.lower()
    return await conn.fetch(
        """
        SELECT 
            technician_id,
            name,
            email,
            service_types,
            longitude,
            latitude,
            location_name,
            is_available
        FROM public.technician
        WHERE EXISTS (
            SELECT 1 
            FROM unnest(service_types) as st
            WHERE LOWER(TRIM(st)) = $1
        )
        LIMIT 10
        """,
        service_type_lower
    )

@technicians_router.get("/test-model")
async def test_model(
    conn: asyncpg.Connection = Depends(get_db)
):
    """Test if database results match the model"""
    from ..models.technician import InAppTechnician
    test_data = await conn.fetchrow(
        "SELECT * FROM technician LIMIT 1"
    )
    try:
        validated = InAppTechnician(**dict(test_data))
        return {"status": "Model matches", "data": validated.dict()}
    except Exception as e:
        return {"status": "Model mismatch", "error": str(e), "data": dict(test_data)}
    
technicians_router.get("/debug-distance")
async def debug_distance(
    tech_id: str,
    latitude: float,
    longitude: float,
    conn: asyncpg.Connection = Depends(get_db)
):
    """Verify distance calculation for a specific technician"""
    tech = await conn.fetchrow(
        "SELECT technician_id, name, latitude, longitude FROM technician WHERE technician_id = $1",
        tech_id
    )
    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    distance = haversine(latitude, longitude, tech['latitude'], tech['longitude'])
    return {
        "technician_id": tech['technician_id'],
        "name": tech['name'],
        "distance_km": distance,
        "technician_latitude": tech['latitude'],
        "technician_longitude": tech['longitude']
    }

@technicians_router.get("/dashboard", response_model=TechnicianDashboard)
async def get_technician_dashboard(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")
    
    # Get counts for different booking statuses
    counts = await conn.fetchrow(
        """
        SELECT 
            COUNT(*) FILTER (WHERE status = 'pending') as pending_requests,
            COUNT(*) FILTER (WHERE status = 'accepted') as accepted_bookings,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
            COALESCE(SUM(price) FILTER (WHERE status = 'completed'), 0) as total_earnings
        FROM booking
        WHERE technician_id = $1
        """,
        current_user["id"]
    )
    
    # Get recent bookings
    recent_bookings = await conn.fetch(
        """
        SELECT 
            b.booking_id, b.service_type, b.status, b.price,
            b.start_date, b.end_date,
            c.name as client_name, c.surname as client_surname
        FROM booking b
        JOIN client c ON b.client_id = c.client_id
        WHERE b.technician_id = $1
        ORDER BY b.created_at DESC
        LIMIT 5
        """,
        current_user["id"]
    )
    
    return {
        "pending_requests": counts["pending_requests"],
        "accepted_bookings": counts["accepted_bookings"],
        "completed_bookings": counts["completed_bookings"],
        "total_earnings": float(counts["total_earnings"]) if counts["total_earnings"] else 0.0,
        "recent_bookings": [dict(booking) for booking in recent_bookings]
    }

@technicians_router.put("/me/availability")
async def update_technician_availability(
    payload: dict,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403)

    is_available = payload.get("is_available", False)
    
    await conn.execute(
        "UPDATE technician SET is_available = $1 WHERE technician_id = $2",
        is_available, current_user["id"]
    )
    
    return {"message": "Availability updated", "is_available": is_available}

@technicians_router.get("/me/working-hours")
async def get_working_hours(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403)
    
    # Get regular working hours (where specific_date is NULL)
    hours = await conn.fetch(
        "SELECT day_of_week, start_time, end_time FROM technician_schedule WHERE technician_id = $1 AND specific_date IS NULL",
        current_user["id"]
    )
    
    # Format into a structure by day of week
    working_hours = {
        "monday": None,
        "tuesday": None,
        "wednesday": None,
        "thursday": None,
        "friday": None,
        "saturday": None,
        "sunday": None
    }
    
    for entry in hours:
        day_name = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][entry["day_of_week"]]
        working_hours[day_name] = {
            "start": entry["start_time"].strftime("%H:%M"),
            "end": entry["end_time"].strftime("%H:%M")
        }
    
    return working_hours

@technicians_router.put("/me/working-hours")
async def update_working_hours(
    hours: dict,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403)
    
    # First delete existing working hours
    await conn.execute(
        "DELETE FROM technician_schedule WHERE technician_id = $1 AND specific_date IS NULL",
        current_user["id"]
    )
    
    # Insert new working hours
    day_map = {
        "monday": 1,
        "tuesday": 2,
        "wednesday": 3,
        "thursday": 4,
        "friday": 5,
        "saturday": 6,
        "sunday": 0
    }
    
    for day_name, times in hours.items():
        if times and day_name in day_map:
            try:
                # Create datetime objects with today's date and the specified time
                today = datetime.now().date()
                start_dt = datetime.combine(today, datetime.strptime(times["start"], "%H:%M").time())
                end_dt = datetime.combine(today, datetime.strptime(times["end"], "%H:%M").time())
                
                await conn.execute(
                    """
                    INSERT INTO technician_schedule (
                        technician_id, day_of_week, start_time, end_time
                    ) VALUES ($1, $2, $3, $4)
                    """,
                    current_user["id"],
                    day_map[day_name],
                    start_dt,
                    end_dt
                )
            except ValueError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid time format for {day_name}. Use HH:MM format."
                )
    
    return {"message": "Working hours updated"}

@technicians_router.get("/me/time-off")
async def get_time_off_entries(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403)
    
    entries = await conn.fetch(
        """
        SELECT schedule_id as id, specific_date as start_date, 
               (specific_date + (end_time - start_time)) as end_date
        FROM technician_schedule 
        WHERE technician_id = $1 AND specific_date IS NOT NULL
        ORDER BY specific_date
        """,
        current_user["id"]
    )
    
    return [dict(entry) for entry in entries]

@technicians_router.post("/me/time-off")
async def add_time_off_entry(
    entry: dict,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403)
    
    start_date = entry["start_date"]
    end_date = entry["end_date"]
    
    # Calculate duration in days
    duration_days = (end_date - start_date).days + 1
    
    for day in range(duration_days):
        current_date = start_date + timedelta(days=day)
        await conn.execute(
            """
            INSERT INTO technician_schedule (
                technician_id, specific_date, start_time, end_time
            ) VALUES ($1, $2, $3, $4)
            """,
            current_user["id"],
            current_date,
            "00:00:00",  # All day time off
            "23:59:59"
        )
    
    return {"message": "Time off entry added"}

@technicians_router.delete("/me/time-off/{entry_id}")
async def delete_time_off_entry(
    entry_id: UUID,  # Ensure this is typed as UUID
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403)
    
    result = await conn.execute(
        "DELETE FROM technician_schedule WHERE schedule_id = $1 AND technician_id = $2",
        entry_id, current_user["id"]
    )
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Time off entry not found")
    
    return {"message": "Time off entry deleted"}

@technicians_router.get("/jobs", response_model=List[dict])
async def get_technician_jobs(
    status: str = Query("all", description="Filter by job status"),
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")

    base_query = """
        SELECT 
            b.*,
            c.name as client_name,
            c.surname as client_surname,
            c.phone_number as client_phone,
            t.name as technician_name,
            t.surname as technician_surname
        FROM booking b
        JOIN client c ON b.client_id = c.client_id
        JOIN technician t ON b.technician_id = t.technician_id
        WHERE b.technician_id = $1
    """
    
    params = [current_user["id"]]
    
    if status != "all":
        base_query += " AND b.status = $2"
        params.append(status)
    
    base_query += " ORDER BY b.created_at DESC"
    
    jobs = await conn.fetch(base_query, *params)
    
    # Convert asyncpg Records to dicts and format dates
    formatted_jobs = []
    for job in jobs:
        job_dict = dict(job)
        job_dict["booking_id"] = str(job_dict["booking_id"])
        job_dict["client_id"] = str(job_dict["client_id"])
        job_dict["technician_id"] = str(job_dict["technician_id"])
        job_dict["created_at"] = job_dict["created_at"].isoformat()
        
        if job_dict["start_date"]:
            job_dict["start_date"] = job_dict["start_date"].isoformat()
        if job_dict["end_date"]:
            job_dict["end_date"] = job_dict["end_date"].isoformat()
            
        formatted_jobs.append(job_dict)
    
    return formatted_jobs

@technicians_router.get("/me/services")
async def get_technician_services(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403)
    
    services = await conn.fetchval(
        "SELECT service_types FROM technician WHERE technician_id = $1",
        current_user["id"]
    )
    
    # Convert array of service names to array of service objects
    service_objects = [{"name": service, "category": "General"} for service in (services or [])]
    
    return service_objects

@technicians_router.post("/me/services")
async def add_technician_service(
    service: dict,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403)
    
    # Get current services
    current_services = await conn.fetchval(
        "SELECT service_types FROM technician WHERE technician_id = $1",
        current_user["id"]
    ) or []
    
    # Add new service if not already present
    if service["name"] not in current_services:
        updated_services = current_services + [service["name"]]
        await conn.execute(
            "UPDATE technician SET service_types = $1 WHERE technician_id = $2",
            updated_services, current_user["id"]
        )
    
    return {"message": "Service added"}

@technicians_router.delete("/me/services/{service_name}")
async def delete_technician_service(
    service_name: str,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403)
    
    # Get current services
    current_services = await conn.fetchval(
        "SELECT service_types FROM technician WHERE technician_id = $1",
        current_user["id"]
    ) or []
    
    # Remove service if present
    if service_name in current_services:
        updated_services = [s for s in current_services if s != service_name]
        await conn.execute(
            "UPDATE technician SET service_types = $1 WHERE technician_id = $2",
            updated_services, current_user["id"]
        )
    
    return {"message": "Service deleted"}

@technicians_router.post("/bookings/{booking_id}/cancel", response_model=BookingOut)
async def cancel_confirmed_booking(
    booking_id: UUID,
    cancel_data: BookingCancel,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can cancel bookings")

    # Verify the booking belongs to this technician and is in confirmed status
    booking = await conn.fetchrow(
        """
        SELECT * FROM booking 
        WHERE booking_id = $1 
        AND technician_id = $2
        AND status = 'confirmed'
        """,
        booking_id, current_user["id"]
    )
    
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or not in confirmable state"
        )

    # Update booking status to cancelled
    await conn.execute(
        """
        UPDATE booking 
        SET status = 'cancelled', 
            updated_at = NOW(),
            cancelled = true,
            cancellation_reason = $2
        WHERE booking_id = $1
        """,
        booking_id, cancel_data.reason
    )

    # Create notification for client
    await conn.execute(
        """
        INSERT INTO notification (recipient_id, message, is_read)
        VALUES ($1, $2, false)
        """,
        booking["client_id"],
        f"Your {booking['service_type']} booking has been cancelled by the technician"
    )

    # Optionally: Send email notification to client
    client_email = await conn.fetchval(
        "SELECT email FROM client WHERE client_id = $1",
        booking["client_id"]
    )
    # To be implemented
    '''if client_email:
        send_email(
            to_email=client_email,
            subject="⚠️ Booking Cancellation",
            body=f"Your {booking['service_type']} booking has been cancelled by the technician."
        )'''

    return await get_booking_details(booking_id, current_user, conn)

@technicians_router.get("/bookings/{booking_id}", response_model=BookingOut)
async def get_booking_details(
    booking_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")

    booking = await conn.fetchrow(
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
        WHERE b.booking_id = $1 AND b.technician_id = $2
        """,
        booking_id, current_user["id"]
    )

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    return dict(booking)

@technicians_router.post("/bookings/{booking_id}/offer", response_model=BookingOut)
async def make_booking_offer(
    booking_id: UUID,
    offer: BookingOffer,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can make offers")

    # Verify the booking belongs to this technician
    booking = await conn.fetchrow(
        "SELECT * FROM booking WHERE booking_id = $1 AND technician_id = $2",
        booking_id, current_user["id"]
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only make offers on pending bookings")

    # Update booking with offer
    await conn.execute(
        """
        UPDATE booking 
        SET price = $1, status = 'offered', updated_at = NOW()
        WHERE booking_id = $2
        """,
        offer.price, booking_id
    )

    # Create notification for client
    await conn.execute(
        """
        INSERT INTO notification (recipient_id, message, is_read)
        VALUES ($1, $2, false)
        """,
        booking["client_id"],
        f"New price offer (R{offer.price:.2f}) for your {booking['service_type']} booking"
    )

    return await get_booking_details(booking_id, current_user, conn)

@technicians_router.post("/bookings/{booking_id}/reject", response_model=BookingOut)
async def reject_booking(
    booking_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can reject bookings")

    # Verify the booking belongs to this technician
    booking = await conn.fetchrow(
        "SELECT * FROM booking WHERE booking_id = $1 AND technician_id = $2",
        booking_id, current_user["id"]
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only reject pending bookings")

    # Update booking status to rejected
    await conn.execute(
        """
        UPDATE booking 
        SET status = 'rejected', updated_at = NOW()
        WHERE booking_id = $1
        """,
        booking_id
    )

    # Create notification for client
    await conn.execute(
        """
        INSERT INTO notification (recipient_id, message, is_read)
        VALUES ($1, $2, false)
        """,
        booking["client_id"],
        f"Your {booking['service_type']} booking has been rejected by the technician"
    )

    return await get_booking_details(booking_id, current_user, conn)

@technicians_router.get("/me", response_model=InAppTechnician)
async def get_technician_profile(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")

    tech = await conn.fetchrow(
        """
        SELECT 
            technician_id,
            name,
            surname,
            email,
            phone_number,
            service_types,
            experience_years,
            is_verified,
            is_available,
            location_name,
            latitude,
            longitude,
            rating AS avg_rating,
            about_me,
            profile_picture_url
        FROM technician
        WHERE technician_id = $1
        """, current_user["id"])

    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")

    tech_dict = dict(tech)
    tech_dict["distance_km"] = 0.0  # Placeholder for compatibility
    tech_dict["rating"] = f"{tech_dict['avg_rating']:.1f}" if tech_dict["avg_rating"] else "Not rated"
    tech_dict["bio"] = tech_dict["about_me"]

    return tech_dict

@technicians_router.put("/me")
async def update_technician_profile(
    payload: dict,  # You may define a TechnicianUpdate model if needed
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can update profile")

    query = """
        UPDATE technician SET
            name = COALESCE($1, name),
            surname = COALESCE($2, surname),
            phone_number = COALESCE($3, phone_number),
            location_name = COALESCE($4, location_name),
            profile_picture_url = COALESCE($5, profile_picture_url),
            about_me = COALESCE($6, about_me),
            updated_at = NOW()
        WHERE technician_id = $7
    """

    await conn.execute(query, payload.get("name"), payload.get("surname"),
        payload.get("phone_number"), payload.get("location_name"),
        payload.get("profile_picture_url"), payload.get("about_me"),
        current_user["id"])

    return await get_technician_profile(current_user, conn)

@technicians_router.post("/me/upload-picture")
async def upload_technician_picture(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Not a technician")

    url = save_profile_picture(file, "technician", current_user["id"])
    await conn.execute("UPDATE technician SET profile_picture_url = $1 WHERE technician_id = $2", url, current_user["id"])
    return {"message": "Profile picture uploaded", "url": url}

@technicians_router.put("/me/about")
async def update_about_me(about: str, current_user: dict = Depends(get_current_user), conn=Depends(get_db)):
    if current_user["type"] != "technician":
        raise HTTPException(403)
    await conn.execute("UPDATE technician SET about_me = $1 WHERE technician_id = $2", about, current_user["id"])
    return {"message": "About me updated"}

@technicians_router.post("/me/qualification")
async def add_qualification(q: TechnicianQualification, current_user=Depends(get_current_user), conn=Depends(get_db)):
    if current_user["type"] != "technician":
        raise HTTPException(403)
    await conn.execute("""
        INSERT INTO technician_qualification 
        (technician_id, qualification_name, institution, year_obtained)
        VALUES ($1, $2, $3, $4)
    """, current_user["id"], q.qualification_name, q.institution, q.year_obtained)
    return {"message": "Qualification added"}

@technicians_router.get("/me/income")
async def get_income(current_user=Depends(get_current_user), conn=Depends(get_db)):
    if current_user["type"] != "technician":
        raise HTTPException(403)
    income = await conn.fetchval("""
        SELECT COALESCE(SUM(amount), 0)
        FROM payment
        WHERE technician_id = $1 AND payment_status = 'completed'
    """, current_user["id"])
    return {"total_income": float(income)}

@technicians_router.get("/{technician_id}", response_model=InAppTechnician)
async def get_technician_detail(
    technician_id: UUID,
    conn: asyncpg.Connection = Depends(get_db)
):
    tech = await conn.fetchrow(
        """
        SELECT 
            technician_id,
            name,
            surname,
            email,
            phone_number,
            service_types,
            experience_years,
            is_verified,
            is_available,
            location_name,
            latitude,
            longitude,
            rating AS avg_rating,
            about_me
        FROM technician t
        WHERE technician_id = $1
        """,
        technician_id
    )

    if not tech:
        raise HTTPException(status_code=404, detail="Technician not found")

    tech_dict = dict(tech)
    tech_dict["distance_km"] = 0.0  # Placeholder; no distance context in this call
    tech_dict["rating"] = f"{tech_dict['avg_rating']:.1f}" if tech_dict["avg_rating"] else "Not rated"
    tech_dict["bio"] = tech_dict["about_me"]

    return tech_dict

@technicians_router.get("/me/distance-stats", response_model=TechnicianDistanceStats)
async def get_technician_distance_stats(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    """
    Calculate and return the total distance traveled by the authenticated technician 
    for all completed bookings.
    """
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")

    # First get the technician's location
    technician = await conn.fetchrow(
        "SELECT technician_id, name, surname, latitude, longitude FROM technician WHERE technician_id = $1",
        current_user["id"]
    )
    
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")

    # Get all completed bookings for this technician
    completed_bookings = await conn.fetch(
        """
        SELECT 
            booking_id, 
            client_latitude, 
            client_longitude,
            start_date
        FROM booking 
        WHERE technician_id = $1 AND status = 'completed'
        """,
        current_user["id"]
    )
    
    total_distance = 0.0
    booking_distances = []
    
    for booking in completed_bookings:
        if booking['client_latitude'] and booking['client_longitude']:
            distance = haversine(
                technician['latitude'], technician['longitude'],
                booking['client_latitude'], booking['client_longitude']
            )
            total_distance += distance
            booking_distances.append(distance)
    
    completed_count = len(completed_bookings)
    avg_distance = total_distance / completed_count if completed_count > 0 else 0
    
    return {
        "technician_id": technician['technician_id'],
        "technician_name": technician['name'],
        "technician_surname": technician['surname'],
        "total_distance_km": round(total_distance, 2),
        "completed_bookings_count": completed_count,
        "average_distance_per_booking_km": round(avg_distance, 2)
    }

@technicians_router.get("/me/location-stats", response_model=List[BookingLocationStats])
async def get_booking_location_stats(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    """
    Return detailed location information for all completed bookings of the authenticated technician
    """
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")

    # Get technician's location
    technician = await conn.fetchrow(
        "SELECT latitude, longitude FROM technician WHERE technician_id = $1",
        current_user["id"]
    )
    
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")

    # Get all completed bookings with location data
    bookings = await conn.fetch(
        """
        SELECT 
            b.booking_id,
            b.service_type,
            b.client_latitude,
            b.client_longitude,
            b.client_address,
            b.client_city,
            b.client_postal_code,
            b.client_province,
            b.client_country,
            b.start_date
        FROM booking b
        WHERE b.technician_id = $1 
          AND b.status = 'completed'
          AND b.client_latitude IS NOT NULL
          AND b.client_longitude IS NOT NULL
        ORDER BY b.start_date DESC
        """,
        current_user["id"]
    )
    
    results = []
    for booking in bookings:
        distance = haversine(
            technician['latitude'], technician['longitude'],
            booking['client_latitude'], booking['client_longitude']
        )
        
        full_address = ", ".join(filter(None, [
            booking['client_address'],
            booking['client_city'],
            booking['client_postal_code'],
            booking['client_province'],
            booking['client_country']
        ]))
        
        results.append({
            "booking_id": booking['booking_id'],
            "service_type": booking['service_type'],
            "distance_from_technician_km": round(distance, 2),
            "client_address": booking['client_address'],
            "client_city": booking['client_city'],
            "client_postal_code": booking['client_postal_code'],
            "client_province": booking['client_province'],
            "client_country": booking['client_country'],
            "booking_date": booking['start_date']
        })
    
    return results

from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from datetime import datetime

@technicians_router.get("/me/print-stats", response_class=HTMLResponse)
async def print_technician_stats(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    """
    Generate a printable HTML report of the technician's distance and location stats
    """
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")

    # Get the summary stats
    distance_stats = await get_technician_distance_stats(current_user, conn)
    
    # Get the detailed location stats
    location_stats = await get_booking_location_stats(current_user, conn)
    
    # Get technician details
    technician = await conn.fetchrow(
        "SELECT name, surname, email FROM technician WHERE technician_id = $1",
        current_user["id"]
    )
    
    # Generate the HTML report with improved styling for PDF generation
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Technician Stats Report</title>
        <style>
            @page {{
                size: A4;
                margin: 1cm;
            }}
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.5;
                margin: 0;
                padding: 20px;
                color: #333;
            }}
            .header {{
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid #333;
                padding-bottom: 10px;
            }}
            .summary {{
                margin-bottom: 20px;
            }}
            .summary-table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
            }}
            .summary-table th, .summary-table td {{
                padding: 8px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }}
            .details-table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
                page-break-inside: avoid;
            }}
            .details-table th, .details-table td {{
                padding: 6px;
                text-align: left;
                border-bottom: 1px solid #ddd;
                font-size: 12px;
            }}
            .details-table th {{
                background-color: #f2f2f2;
                font-weight: bold;
            }}
            .footer {{
                margin-top: 20px;
                text-align: right;
                font-size: 10px;
                color: #666;
            }}
            h1 {{
                color: #333;
                font-size: 24px;
                margin: 0 0 5px 0;
            }}
            h2 {{
                color: #444;
                font-size: 18px;
                margin: 20px 0 10px 0;
                page-break-after: avoid;
            }}
            p {{
                margin: 5px 0;
            }}
            .no-break {{
                page-break-inside: avoid;
            }}
        </style>
    </head>
    <body>
        <div class="header no-break">
            <h1>Technician Service Report</h1>
            <p><strong>{technician['name']} {technician['surname']}</strong> | {technician['email']}</p>
            <p>Report generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
        </div>
        
        <div class="summary no-break">
            <h2>Summary Statistics</h2>
            <table class="summary-table">
                <tr>
                    <th>Total Distance Traveled</th>
                    <td>{distance_stats['total_distance_km']:.2f} km</td>
                </tr>
                <tr>
                    <th>Completed Bookings</th>
                    <td>{distance_stats['completed_bookings_count']}</td>
                </tr>
                <tr>
                    <th>Average Distance per Booking</th>
                    <td>{distance_stats['average_distance_per_booking_km']:.2f} km</td>
                </tr>
            </table>
        </div>
        
        <div class="details">
            <h2>Booking Details</h2>
            <table class="details-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Service</th>
                        <th>Distance (km)</th>
                        <th>Location</th>
                    </tr>
                </thead>
                <tbody>
                    {"".join([
                        f"""
                        <tr class="no-break">
                            <td>{stat['booking_date'].strftime("%Y-%m-%d")}</td>
                            <td>{stat['service_type']}</td>
                            <td>{stat['distance_from_technician_km']:.2f}</td>
                            <td>
                                {stat['client_address']}, {stat['client_city']}<br>
                                {stat['client_province']} {stat['client_postal_code']}<br>
                                {stat['client_country']}
                            </td>
                        </tr>
                        """ for stat in location_stats
                    ])}
                </tbody>
            </table>
        </div>
        
        <div class="footer no-break">
            <p>End of report</p>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

@technicians_router.get("/me/print-stats/pdf")
async def print_technician_stats_pdf(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    """
    Generate a printable PDF report of the technician's distance and location stats
    using xhtml2pdf/pisa
    """
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can access this endpoint")

    # Get the HTML content from the HTML endpoint
    html_response = await print_technician_stats(current_user, conn)
    html_content = html_response.body.decode('utf-8')
    
    # Create a PDF buffer
    pdf_buffer = BytesIO()
    
    # Create PDF using pisa
    pisa_status = pisa.CreatePDF(
        html_content,
        dest=pdf_buffer,
        encoding='utf-8'
    )
    
    # Check for errors
    if pisa_status.err:
        logger.error(f"PDF generation failed: {pisa_status.err}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate PDF report"
        )
    
    # Return the PDF file
    pdf_buffer.seek(0)
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=technician_distance_report_{datetime.now().strftime('%Y%m%d')}.pdf"
        }
    )

__all__ = ["technicians_router"]
