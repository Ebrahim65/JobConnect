# app/routes/payments.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
import asyncpg
from uuid import UUID
from ..database import get_db
from ..utils.auth import get_current_user
from ..models.payment import PaymentCreate, PaymentOut, PaymentUpdate

payments_router = APIRouter(prefix="/payments", tags=["Payments"])

@payments_router.post("/", response_model=dict, status_code=201)
async def create_payment(
    payment: PaymentCreate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    def normalize_uuid(uuid_str):
        return str(uuid_str).lower().replace('-', '')

    if current_user["type"] != "client":
        raise HTTPException(status_code=403, detail="Only clients can make payments")
    
    # Verify booking exists and belongs to client
    booking = await conn.fetchrow(
        """
        SELECT client_id, technician_id, price, status
        FROM booking
        WHERE booking_id = $1
        """,
        payment.booking_id
    )
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    client_id = normalize_uuid(booking["client_id"])
    c_current_user = normalize_uuid(current_user["id"])
    
    if client_id != c_current_user:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["status"] != "completed":
        raise HTTPException(status_code=400, detail="Booking must be completed before payment")
    
    # Check for existing pending payment for this booking
    existing_payment = await conn.fetchrow(
        """
        SELECT payment_id, payment_status
        FROM payment
        WHERE booking_id = $1
        ORDER BY transaction_date DESC
        LIMIT 1
        """,
        payment.booking_id
    )
    
    if existing_payment and existing_payment["payment_status"] == "pending":
        # Update existing pending payment
        payment_id = existing_payment["payment_id"]
        await conn.execute(
            """
            UPDATE payment
            SET 
                payment_method = $1,
                payment_status = 'completed',
                transaction_date = NOW()
            WHERE payment_id = $2
            """,
            payment.payment_method,
            payment_id
        )
    else:
        # Create new payment if no pending payment exists
        payment_id = await conn.fetchval(
            """
            INSERT INTO payment (
                booking_id, client_id, technician_id,
                amount, payment_method, payment_status, transaction_date
            )
            VALUES ($1, $2, $3, $4, $5, 'completed', NOW())
            RETURNING payment_id
            """,
            payment.booking_id, current_user["id"], booking["technician_id"],
            booking["price"], payment.payment_method
        )
    
    # Update booking status to completed
    await conn.execute(
        "UPDATE booking SET status = 'completed' WHERE booking_id = $1",
        payment.booking_id
    )
    
    # Create notifications
    await conn.execute(
        """
        INSERT INTO notification (message, recipient_id)
        VALUES ($1, $2), ($3, $4)
        """,
        "Payment made for your booking", current_user["id"],
        "Client made payment for completed job", booking["technician_id"]
    )
    
    payment_data = await get_payment(payment_id, conn)
    return payment_data

@payments_router.get("/{payment_id}", response_model=dict)
async def get_payment_by_id(
    payment_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    payment_data = await get_payment(payment_id, conn)
    
    # Authorization check
    if current_user["type"] == "client" and payment_data["client_id"] != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not your payment")
    if current_user["type"] == "technician" and payment_data["technician_id"] != str(current_user["id"]):
        raise HTTPException(status_code=403, detail="Not your payment")
    
    return payment_data

async def get_payment(payment_id: UUID, conn: asyncpg.Connection) -> dict:
    payment = await conn.fetchrow(
        "SELECT * FROM payment WHERE payment_id = $1",
        payment_id
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Convert asyncpg Record to dict and format fields
    payment_dict = dict(payment)
    payment_dict["payment_id"] = str(payment_dict["payment_id"])
    payment_dict["booking_id"] = str(payment_dict["booking_id"])
    payment_dict["client_id"] = str(payment_dict["client_id"])
    payment_dict["technician_id"] = str(payment_dict["technician_id"])
    payment_dict["transaction_date"] = payment_dict["transaction_date"].isoformat()
    
    return payment_dict

@payments_router.get("/client/{client_id}", response_model=List[PaymentOut])
async def get_client_payments(
    client_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    # Authorization check
    if current_user["type"] == "client" and client_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only view your own payments")
    
    payments = await conn.fetch(
        """
        SELECT p.*, 
        b.service_type
        FROM payment p
        JOIN booking b ON p.booking_id = b.booking_id
        WHERE p.client_id = $1
        ORDER BY transaction_date DESC
        """,
        client_id
    )
    
    if not payments:
        return []
    
    return [PaymentOut(**dict(p)) for p in payments]

from fastapi.responses import FileResponse
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import io
import os

@payments_router.get("/{payment_id}/receipt")
async def download_receipt(
    payment_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    try:
        # Get payment details
        payment = await get_payment(payment_id, conn)
        
        # Authorization check
        if current_user["type"] == "client" and payment["client_id"] != str(current_user["id"]):
            raise HTTPException(status_code=403, detail="Not your payment")
        if current_user["type"] == "technician" and payment["technician_id"] != str(current_user["id"]):
            raise HTTPException(status_code=403, detail="Not your payment")

        # Create PDF receipt in memory
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        
        # Add receipt 
        # Metadata
        p.setTitle(f"Receipt for Payment {payment_id}")
        p.setAuthor("JobConnect")
        p.setSubject("Service Payment Receipt")

        p.setFont("Helvetica-Bold", 16)
        p.drawString(100, 720, "Service Receipt")
        p.setFont("Helvetica", 12)
        p.drawImage("./assets/technician_app_icon.png", 100, 750, width=50, height=50)
        p.drawString(155, 750, "JobConnect")
        p.setStrokeColorRGB(0.8, 0.8, 0.8)
        p.rect(50, 50, 500, 700)
        y_position = 700
        p.drawString(100, y_position, f"Payment ID: {payment['payment_id']}")
        y_position -= 30
        p.drawString(100, y_position, f"Date: {payment['transaction_date']}")
        y_position -= 30
        p.drawString(100, y_position, f"Amount: R{payment['amount']:.2f}")
        y_position -= 30
        p.drawString(100, y_position, f"Payment Method: {payment['payment_method']}")
        y_position -= 30
        p.drawString(100, y_position, f"Status: {payment['payment_status']}")
        y_position -= 30
        p.drawString(100, y_position, f"Booking ID: {payment['booking_id']}")
        y_position -= 30
        p.drawString(100, y_position, f"Client ID: {payment['client_id']}")
        y_position -= 30
        p.drawString(100, y_position, f"Technician ID: {payment['technician_id']}")
        
        # Add footer
        p.setFont("Helvetica-Oblique", 10)
        p.drawString(100, 50, "Thank you for your business!")
        
        p.showPage()
        p.save()
        
        # Return PDF file
        buffer.seek(0)
        headers = {
        'Content-Disposition': f'attachment; filename="receipt_{payment_id}.pdf"'
        }
        return Response(
            content=buffer.getvalue(),
            media_type='application/pdf',
            headers=headers
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate receipt: {str(e)}"
        )

__all__ = ["payments_router"]