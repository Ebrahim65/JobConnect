from fastapi import APIRouter, Depends, HTTPException, status
from ..models.strike import StrikeCreate, StrikeOut
from ..models.common import UserStrike
from ..models.admin import AdminOut, AdminUpdate
from ..models.technician_verification import VerificationStatusUpdate
from ..utils.auth import get_current_user
from ..database import get_db
import asyncpg

admin_router = APIRouter(prefix="/admin", tags=["Admin"])

@admin_router.post("/strikes", response_model=StrikeOut, status_code=status.HTTP_201_CREATED)
async def add_strike(
    strike: StrikeCreate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Add strike and update user's strike count
    async with conn.transaction():
        strike_id = await conn.fetchval(
            """
            INSERT INTO user_strike (user_id, user_type, admin_id, reason)
            VALUES ($1, $2, $3, $4)
            RETURNING strike_id
            """,
            strike.user_id, strike.user_type, current_user["id"], strike.reason
        )
        
        table = "client" if strike.user_type == "client" else "technician"
        await conn.execute(
            f"""
            UPDATE {table} 
            SET strikes = strikes + 1 
            WHERE {table}_id = $1
            """,
            strike.user_id
        )
    
    return await add_strike(strike_id, conn)

@admin_router.put("/verification/{technician_id}", status_code=status.HTTP_200_OK)
async def update_verification_status(
    technician_id: str,
    status_update: VerificationStatusUpdate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    await conn.execute(
        """
        UPDATE technician
        SET is_verified = $1, verification_notes = $2
        WHERE technician_id = $3
        """,
        status_update.status == "approved",
        status_update.notes,
        technician_id
    )
    return {"message": "Verification status updated"}

@admin_router.post("/strikes")
async def add_strike(strike: UserStrike, current_user=Depends(get_current_user), conn=Depends(get_db)):
    if current_user["type"] != "admin":
        raise HTTPException(403)
    
    # Add strike
    await conn.execute("""
        INSERT INTO user_strike (user_id, user_type, reason, admin_id)
        VALUES ($1, $2, $3, $4)
    """, strike.user_id, strike.user_type, strike.reason, strike.admin_id)

    # Increment count and deactivate if 5+
    await conn.execute(f"""
        UPDATE {strike.user_type}
        SET strikes = strikes + 1
        WHERE {strike.user_type}_id = $1
    """, strike.user_id)

    count = await conn.fetchval(f"""
        SELECT strikes FROM {strike.user_type}
        WHERE {strike.user_type}_id = $1
    """, strike.user_id)

    if count >= 5:
        await conn.execute(f"""
            UPDATE {strike.user_type}
            SET is_active = false
            WHERE {strike.user_type}_id = $1
        """, strike.user_id)

    return {"message": f"Strike added. Current count: {count}"}
@admin_router.get("/me", response_model=AdminOut)
async def get_admin_profile(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this endpoint")

    admin = await conn.fetchrow("SELECT * FROM admin WHERE admin_id = $1", current_user["id"])

    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    return dict(admin)

@admin_router.put("/me", response_model=AdminOut)
async def update_admin_profile(
    update: AdminUpdate,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update profile")

    await conn.execute("""
        UPDATE admin
        SET name = COALESCE($1, name),
            surname = COALESCE($2, surname),
            phone_number = COALESCE($3, phone_number),
            role = COALESCE($4, role)
        WHERE admin_id = $5
    """, update.name, update.surname, update.phone_number, update.role, current_user["id"])

    return await get_admin_profile(current_user, conn)
