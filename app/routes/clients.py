# app/routes/clients.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List
import asyncpg
from ..routes.bookings import get_booking, bookings_router
from ..models.booking import BookingCancel, BookingOffer, BookingOut, BookingResponse
from ..database import get_db
from ..utils.auth import get_current_user
from ..utils.file_upload import save_profile_picture
from ..models.client import ClientOut, ClientUpdate, ClientDashboard, FavoriteTechnician, FavoriteTechnicianOut

clients_router = APIRouter(prefix="/clients", tags=["Clients"])

@clients_router.get("/me", response_model=ClientOut)
async def get_current_client(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can access this endpoint")
    
    client = await conn.fetchrow(
        """
        SELECT 
            client_id, name, surname, email, phone_number,
            location_name, created_at
        FROM client
        WHERE client_id = $1
        """,
        current_user["id"]
    )

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # ✅ Ensure you are returning a proper dict with expected types
    return {
        "client_id": str(client["client_id"]),
        "name": client["name"],
        "surname": client["surname"],
        "email": client["email"],
        "phone_number": client["phone_number"],
        "location_name": client["location_name"],
        "created_at": client["created_at"].isoformat()
    }

@clients_router.get("/dashboard", response_model=ClientDashboard)
async def get_client_dashboard(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can access this endpoint")
    
    # Get active bookings count
    active_bookings = await conn.fetchval(
        """
        SELECT COUNT(*) FROM booking
        WHERE client_id = $1 AND status IN ('pending', 'accepted', 'in_progress')
        """,
        current_user["id"]
    )
    
    # Get pending payments count
    pending_payments = await conn.fetchval(
        """
        SELECT COUNT(*) FROM payment
        WHERE client_id = $1 AND payment_status = 'pending'
        """,
        current_user["id"]
    )
    
    # Get favorite technicians
    favorites = await conn.fetch(
        """
        SELECT t.technician_id, t.name, t.surname, t.rating
        FROM favorite_technician f
        JOIN technician t ON f.technician_id = t.technician_id
        WHERE f.client_id = $1
        """,
        current_user["id"]
    )

    return {
        "active_bookings": active_bookings,
        "pending_payments": pending_payments,
        "favorite_technicians": [
            FavoriteTechnicianOut(**dict(tech)) for tech in favorites
        ]
    }

@clients_router.post("/favorites", status_code=201)
async def add_favorite_technician(
    favorite: FavoriteTechnician,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can access this endpoint")
    
    try:
        await conn.execute(
            """
            INSERT INTO favorite_technician (client_id, technician_id)
            VALUES ($1, $2)
            ON CONFLICT (client_id, technician_id) DO NOTHING
            """,
            current_user["id"], favorite.technician_id
        )
        return {"message": "Technician added to favorites"}
    except asyncpg.ForeignKeyViolationError:
        raise HTTPException(status_code=404, detail="Technician not found")

@clients_router.delete("/favorites/{technician_id}", status_code=200)
async def remove_favorite_technician(
    technician_id: str,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can access this endpoint")
    
    result = await conn.execute(
        """
        DELETE FROM favorite_technician
        WHERE client_id = $1 AND technician_id = $2
        """,
        current_user["id"], technician_id
    )
    
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Favorite not found")
    
    return {"message": "Technician removed from favorites"}

@clients_router.post("/me/upload-picture")
async def upload_client_picture(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Not a client")

    url = save_profile_picture(file, "client", current_user["id"])
    await conn.execute("UPDATE client SET profile_picture_url = $1 WHERE client_id = $2", url, current_user["id"])
    return {"message": "Profile picture uploaded", "url": url}

@clients_router.put("/bookings/{booking_id}/cancel", response_model=BookingOut)
async def cancel_confirmed_booking(
    booking_id: UUID,
    cancel_data: BookingCancel,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can cancel bookings")

    # Verify the booking belongs to this technician and is in confirmed status
    booking = await conn.fetchrow(
        """
        SELECT * FROM booking 
        WHERE booking_id = $1 
        AND technician_id = $2
        AND status = 'confirmed'
        OR status = 'pending'
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
        booking["technician_id"],
        f"Your {booking['service_type']} booking has been cancelled by the client"
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

@clients_router.get("/bookings/{booking_id}", response_model=BookingOut)
async def get_booking_details(
    booking_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can access this endpoint")

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
        WHERE b.booking_id = $1 AND b.client_id = $2
        """,
        booking_id, current_user["id"]
    )

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    return dict(booking)

@bookings_router.post("/{booking_id}/respond", response_model=BookingOut)
async def respond_to_offer(
    booking_id: str,
    response: BookingResponse,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can respond to offers")
    
    # Get the booking and verify it belongs to this client
    booking = await get_booking(booking_id, conn)
    def normalize_uuid(uuid_str):
        return str(uuid_str).lower().replace('-', '')
    
    booking_client_id = normalize_uuid(booking["client_id"])
    current_user_id = normalize_uuid(current_user["id"])

    if booking_client_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not your booking")
    
    if booking["status"] != "offered":
        raise HTTPException(status_code=400, detail="No offer exists for this booking")
    
    if response.accept:
        # Accept the offer
        await conn.execute(
            "UPDATE booking SET status = 'confirmed' WHERE booking_id = $1",
            booking_id
        )
        message = "Booking accepted"
    else:
        # Reject the offer - delete the booking
        await conn.execute(
            "DELETE FROM booking WHERE booking_id = $1",
            booking_id
        )
        message = "Booking rejected and deleted"
    
    # Create notification for technician
    await conn.execute(
        """
        INSERT INTO notification (message, recipient_id)
        VALUES ($1, $2)
        """,
        f"Client has {'accepted' if response.accept else 'rejected'} your offer",
        booking["technician_id"]
    )
    
    if response.accept:
        return await get_booking(booking_id, conn)
    else:
        return {"message": message}
    
@clients_router.get("/me", response_model=ClientOut)
async def get_client_profile(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can access this endpoint")

    client = await conn.fetchrow("""
        SELECT client_id, name, surname, email, phone_number, location_name, 
               created_at, profile_picture_url
        FROM client
        WHERE client_id = $1
    """, current_user["id"])

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    return dict(client)

@clients_router.put("/me", response_model=ClientOut)
async def update_client_profile(
    update: ClientUpdate,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can update their profile")
    url = save_profile_picture(file, "client", current_user["id"]) 
    await conn.execute("""
        UPDATE client
        SET name = COALESCE($1, name),
            surname = COALESCE($2, surname),
            phone_number = COALESCE($3, phone_number),
            location_name = COALESCE($4, location_name),
            profile_picture_url = COALESCE($5, profile_picture_url),
            updated_at = NOW()
        WHERE client_id = $6
    """, update.name, update.surname, update.phone_number, update.location_name,
         url, current_user["id"])

    return await get_client_profile(current_user, conn)
    
__all__ = ["clients_router"]