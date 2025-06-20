# app/routes/payments.py
from fastapi import APIRouter, Depends, HTTPException
import asyncpg
from uuid import UUID
from ..database import get_db
from ..utils.auth import get_current_user
from ..models.payment import PaymentCreate, PaymentOut, PaymentUpdate

payments_router = APIRouter(prefix="/payments", tags=["Payments"])

@payments_router.post("/", response_model=PaymentOut, status_code=201)
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
    client_id = normalize_uuid(booking["client_id"])
    c_current_user = normalize_uuid(current_user["id"])
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if client_id != c_current_user:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking["status"] != "completed":
        raise HTTPException(status_code=400, detail="Booking must be completed before payment")
    
    # Create payment
    payment_id = await conn.fetchval(
        """
        INSERT INTO payment (
            booking_id, client_id, technician_id,
            amount, payment_method, payment_status, transaction_date
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
        RETURNING payment_id
        """,
        payment.booking_id, current_user["id"], booking["technician_id"],
        booking["price"], payment.payment_method
    )
    
    # Update booking status
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
        "Payment initiated for your booking", current_user["id"],
        "Client initiated payment for completed job", booking["technician_id"]
    )
    
    return await get_payment(payment_id, conn)

@payments_router.get("/{payment_id}", response_model=PaymentOut)
async def get_payment_by_id(
    payment_id: str,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    payment = await get_payment(payment_id, conn)
    
    # Authorization check
    if current_user["type"] == "client" and str(payment["client_id"]) != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your payment")
    if current_user["type"] == "technician" and str(payment["technician_id"]) != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your payment")
    
    return payment

async def get_payment(payment_id: str, conn: asyncpg.Connection) -> PaymentOut:
    payment = await conn.fetchrow(
        "SELECT * FROM payment WHERE payment_id = $1",
        payment_id
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@payments_router.get("/{client_id}", response_model=PaymentOut)
async def get_client_payments(
    client_id: UUID,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    def normalize_uuid(uuid_str):
        return str(uuid_str).lower().replace('-', '')
    
    payment = await conn.fetchrow(
        "SELECT * FROM payment WHERE client_id = $1",
        client_id
    )
    
    ##client_id = normalize_uuid(payment["client_id"])
    ##c_current_user = normalize_uuid(current_user["id"])
    # Authorization check
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if current_user["type"] == "client" and payment["client_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your payment")
    
    return [PaymentOut(**p) for p in payment]


async def get_client_payments(client_id: str, conn: asyncpg.Connection) -> PaymentOut:
    payment = await conn.fetchrow(
        "SELECT * FROM payment WHERE client_id = $1",
        client_id
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

__all__ = ["payments_router"]