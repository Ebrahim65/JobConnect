# app/routes/bookings.py
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from typing import List
import asyncpg

from ..utils.email import send_email
from ..database import get_db
from ..utils.auth import get_current_user
from ..models.booking import (
    BookingCreate,
    BookingOut,
    BookingResponse,
    BookingStatusUpdate,
    BookingQueryParams,
    BookingPayment
)

bookings_router = APIRouter(prefix="/bookings", tags=["Bookings"])

@bookings_router.post("/", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking: BookingCreate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can create bookings")
    
    # Verify technician exists and is available
    technician = await conn.fetchrow(
        "SELECT is_available FROM technician WHERE technician_id = $1", 
        booking.technician_id
    )
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")
    if not technician["is_available"]:
        raise HTTPException(status_code=400, detail="Technician is not available")

    # Check for scheduling conflicts
    conflict_check = await conn.fetchval("""
        SELECT EXISTS(
            SELECT 1 FROM booking 
            WHERE technician_id = $1
            AND status NOT IN ('cancelled', 'rejected', 'completed')
            AND (
                (start_date, end_date) OVERLAPS ($2, $3)
                OR start_date BETWEEN $2 AND $3
                OR end_date BETWEEN $2 AND $3
            )
        )
    """, booking.technician_id, booking.start_date, booking.end_date)

    if conflict_check:
        raise HTTPException(
            status_code=400,
            detail="The technician is already booked during this time slot"
        )

    # Create the booking with address information
    booking_id = await conn.fetchval("""
        INSERT INTO booking (
            client_id, technician_id, service_type, 
            description, status, start_date, end_date,
            client_address, client_city, client_postal_code,
            client_province, client_country, client_latitude, client_longitude
        )
        VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING booking_id
    """,
        current_user["id"], 
        booking.technician_id, 
        booking.service_type,
        booking.description,
        booking.start_date,
        booking.end_date,
        booking.client_address,
        booking.client_city,
        booking.client_postal_code,
        booking.client_province,
        booking.client_country,
        booking.client_latitude,
        booking.client_longitude
    )
    
    # Create notification
    await conn.execute("""
        INSERT INTO notification (message, recipient_id)
        VALUES ($1, $2)
    """,
        f"New booking request for {booking.service_type} at {booking.client_address}",
        booking.technician_id
    )
    
    # Get technician email
    tech_info = await conn.fetchrow(
        "SELECT email FROM technician WHERE technician_id = $1", 
        booking.technician_id
    )
    # TOdo
    '''if tech_info:
        send_email(
            to_email=tech_info["email"],
            subject="📅 New Booking Request",
            body=f"""
            You have a new booking request for {booking.service_type}.
            
            Location: 
            {booking.client_address}
            {booking.client_city}, {booking.client_province} {booking.client_postal_code}
            {booking.client_country}
            
            Please log in to respond.
            """
        )'''
    
    booking_data = await get_booking(str(booking_id), conn)
    return BookingOut(**booking_data)

#  address fields
async def get_booking(booking_id: str, conn: asyncpg.Connection) -> dict:
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
        WHERE b.booking_id = $1
        """,
        booking_id
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking_dict = dict(booking)
    booking_dict["booking_id"] = str(booking_dict["booking_id"])
    booking_dict["client_id"] = str(booking_dict["client_id"])
    booking_dict["technician_id"] = str(booking_dict["technician_id"])
    booking_dict["created_at"] = booking_dict["created_at"].isoformat()
    
    if booking_dict["start_date"]:
        booking_dict["start_date"] = booking_dict["start_date"].isoformat()
    if booking_dict["end_date"]:
        booking_dict["end_date"] = booking_dict["end_date"].isoformat()
    
    return booking_dict

@bookings_router.get("/", response_model=list[BookingOut])
async def get_bookings(
    status: str = None,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    # Only clients can fetch their booking history in this endpoint
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can access this endpoint")

    query = """
        SELECT 
            b.*,
            c.name as client_name,
            c.surname as client_surname,
            t.name as technician_name,
            t.surname as technician_surname
        FROM booking b
        JOIN client c ON b.client_id = c.client_id
        JOIN technician t ON b.technician_id = t.technician_id
        WHERE b.client_id = $1
    """

    params = [current_user["id"]]

    if status:
        query += " AND b.status = $2"
        params.append(status)

    query += " ORDER BY b.created_at DESC"

    rows = await conn.fetch(query, *params)

    results = []
    for booking in rows:
        b = dict(booking)
        b["booking_id"] = str(b["booking_id"])
        b["client_id"] = str(b["client_id"])
        b["technician_id"] = str(b["technician_id"])
        b["created_at"] = b["created_at"].isoformat()
        if b["start_date"]:
            b["start_date"] = b["start_date"].isoformat()
        if b["end_date"]:
            b["end_date"] = b["end_date"].isoformat()
        results.append(b)

    return results

@bookings_router.get("/{booking_id}", response_model=BookingOut)
async def get_booking_by_id(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    booking_data = await get_booking(booking_id, conn)
    
    # Normalize both UUIDs to strings without hyphens and lowercase
    def normalize_uuid(uuid_str):
        return str(uuid_str).lower().replace('-', '')
    
    booking_client_id = normalize_uuid(booking_data["client_id"])
    current_user_id = normalize_uuid(current_user["id"])
    
    # Debug output
    print(f"Normalized Booking Client ID: {booking_client_id}")
    print(f"Normalized Current User ID: {current_user_id}")
    
    # Check authorization
    if current_user["type"] == "client":
        if booking_client_id != current_user_id:
            raise HTTPException(
                status_code=403,
                detail="Not your booking (UUID normalization mismatch)"
            )
    
    elif current_user["type"] == "technician":
        booking_tech_id = normalize_uuid(booking_data["technician_id"])
        if booking_tech_id != current_user_id:
            raise HTTPException(status_code=403, detail="Not your booking")
    
    return BookingOut(**booking_data)


@bookings_router.put("/{booking_id}/status", response_model=BookingOut)
async def update_booking_status(
    booking_id: str,
    status_update: BookingStatusUpdate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    booking = await get_booking(booking_id, conn)
    
    # Authorization check
    if current_user["type"] == "client" and str(booking["client_id"]) != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    if current_user["type"] == "technician" and str(booking["technician_id"]) != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your booking")
    
    # Update status
    await conn.execute(
        "UPDATE booking SET status = $1, price = $2 WHERE booking_id = $3",
        status_update.status,
        status_update.price,
        booking_id
    )
    
    # Create notification
    recipient_id = booking["client_id"] if current_user["type"] == "technician" else booking["technician_id"]
    await conn.execute(
        """
        INSERT INTO notification (message, recipient_id)
        VALUES ($1, $2)
        """,
        f"Booking status updated to {status_update.status}",
        recipient_id
    )
    
    return await get_booking(booking_id, conn)

@bookings_router.put("/{booking_id}/start", response_model=BookingOut)
async def start_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can start bookings")

    # Get booking and verify it belongs to this technician
    booking = await conn.fetchrow(
        "SELECT status, technician_id FROM booking WHERE booking_id = $1",
        booking_id
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if str(booking["technician_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not your booking")
    
    if booking["status"] != "accepted":
        raise HTTPException(
            status_code=400,
            detail="Booking must be in 'accepted' status to start"
        )
    
    # Update status to in_progress
    await conn.execute(
        "UPDATE booking SET status = 'in_progress', start_date = NOW() WHERE booking_id = $1",
        booking_id
    )
    
    # Create notification for client
    await conn.execute(
        """
        INSERT INTO notification (message, recipient_id)
        VALUES ($1, (
            SELECT client_id FROM booking WHERE booking_id = $2
        ))
        """,
        "Technician has been dispatched to your location to start working. Please show them all work to be completed.",
        booking_id
    )
    
    return await get_booking(booking_id, conn)

@bookings_router.put("/{booking_id}/complete", response_model=BookingOut)
async def complete_booking(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=403, detail="Only technicians can complete bookings")

    # Get booking and verify it belongs to this technician
    booking = await conn.fetchrow(
        "SELECT status, technician_id, client_id, price FROM booking WHERE booking_id = $1",
        booking_id
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if str(booking["technician_id"]) != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not your booking")
    
    if booking["status"] != "in_progress":
        raise HTTPException(
            status_code=400,
            detail="Booking must be in 'in_progress' status to complete"
        )
    
    # Start transaction
    async with conn.transaction():
        # Update status to completed and set end date
        await conn.execute(
            "UPDATE booking SET status = 'completed', end_date = NOW() WHERE booking_id = $1",
            booking_id
        )
        
        # Create payment record if price exists
        if booking["price"]:
            await conn.execute(
                """
                INSERT INTO payment (
                    booking_id,
                    client_id,
                    technician_id,
                    amount,
                    payment_status,
                    transaction_date
                )
                VALUES ($1, $2, $3, $4, 'pending', NOW())
                """,
                booking_id,
                booking["client_id"],
                booking["technician_id"],
                booking["price"]
            )
        
        # Create notification for client
        await conn.execute(
            """
            INSERT INTO notification (message, recipient_id)
            VALUES ($1, (
                SELECT client_id FROM booking WHERE booking_id = $2
            ))
            """,
            "Your technician has completed the job",
            booking_id
        )
    
    return await get_booking(booking_id, conn)

async def get_booking(booking_id: str, conn: asyncpg.Connection) -> dict:
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
        WHERE b.booking_id = $1
        """,
        booking_id
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking_dict = dict(booking)
    booking_dict["booking_id"] = str(booking_dict["booking_id"])
    booking_dict["client_id"] = str(booking_dict["client_id"])
    booking_dict["technician_id"] = str(booking_dict["technician_id"])
    booking_dict["created_at"] = booking_dict["created_at"].isoformat()
    
    if booking_dict["start_date"]:
        booking_dict["start_date"] = booking_dict["start_date"].isoformat()
    if booking_dict["end_date"]:
        booking_dict["end_date"] = booking_dict["end_date"].isoformat()
    
    return booking_dict

@bookings_router.get("/recent/{client_id}", response_model=List[BookingOut])
async def get_recent_client_bookings(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can access recent bookings")

    rows = await conn.fetch(
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
        WHERE b.client_id = $1
        ORDER BY b.created_at DESC
        LIMIT 5
        """,
        current_user["id"]
    )

    results = []
    for row in rows:
        data = dict(row)
        data["booking_id"] = str(data["booking_id"])
        data["client_id"] = str(data["client_id"])
        data["technician_id"] = str(data["technician_id"])
        data["created_at"] = data["created_at"].isoformat()
        if data["start_date"]:
            data["start_date"] = data["start_date"].isoformat()
        if data["end_date"]:
            data["end_date"] = data["end_date"].isoformat()
        results.append(data)

    return results

@bookings_router.get("/payable/{client_id}", response_model=List[BookingPayment])
async def get_payable_bookings(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can access this endpoint")
    
    # Fetch bookings that are completed but not paid
    bookings = await conn.fetch(
        """
        SELECT 
            b.booking_id, b.service_type, b.description, b.status, b.price,
            b.created_at, b.start_date, b.end_date,
            t.technician_id, t.name as technician_name, t.surname as technician_surname,
            b.client_address, b.client_city, b.client_postal_code,
            b.client_province, b.client_country, b.client_latitude, b.client_longitude
        FROM booking b
        JOIN technician t ON b.technician_id = t.technician_id
        JOIN payment p ON p.booking_id = b.booking_id
        WHERE b.client_id = $1 
        AND b.status = 'completed'
        AND p.payment_status = 'pending'
        ORDER BY b.created_at DESC
        """,
        current_user["id"]
    )
    
    if not bookings:
        return []
    
    # Convert to list of dicts and format the data
    formatted_bookings = []
    for booking in bookings:
        booking_dict = dict(booking)
        booking_dict["booking_id"] = str(booking_dict["booking_id"])
        booking_dict["technician_id"] = str(booking_dict["technician_id"])
        booking_dict["created_at"] = booking_dict["created_at"].isoformat()
        
        if booking_dict["start_date"]:
            booking_dict["start_date"] = booking_dict["start_date"].isoformat()
        if booking_dict["end_date"]:
            booking_dict["end_date"] = booking_dict["end_date"].isoformat()
        
        formatted_bookings.append(BookingPayment(**booking_dict))
    
    return formatted_bookings

def format_booking_response(booking):
    """Helper function to format booking response"""
    booking_dict = dict(booking)
    booking_dict["booking_id"] = str(booking_dict["booking_id"])
    booking_dict["technician_id"] = str(booking_dict["technician_id"])
    booking_dict["created_at"] = booking_dict["created_at"].isoformat()
    
    if booking_dict["start_date"]:
        booking_dict["start_date"] = booking_dict["start_date"].isoformat()
    if booking_dict["end_date"]:
        booking_dict["end_date"] = booking_dict["end_date"].isoformat()
    
    return booking_dict
    
__all__ = ["bookings_router"]