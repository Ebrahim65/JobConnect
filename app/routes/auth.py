# app/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from typing import Annotated
from typing import Optional
from ..models.auth import ClientCreate, ChangePasswordRequest, TechnicianCreate
from ..models.auth import AdminCreate, AdminOut
import asyncpg

from ..utils.auth import (
    authenticate_user,
    create_access_token,
    get_password_hash,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from ..database import get_db
from ..models.auth import Token

# Create the router instance at the top level
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])

@auth_router.post("/token")
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    conn: asyncpg.Connection = Depends(get_db)
):
    user = await authenticate_user(form_data.username, form_data.password, conn)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    await conn.execute(
        "INSERT INTO login_history (email, type) VALUES ($1, $2)",
        form_data.username, user["type"]
    )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["id"]), "type": user["type"]},
        expires_delta=access_token_expires
    )

    # 👇 Add user type to the response
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_type": user["type"]  # 'client' or 'technician'
    }

@auth_router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: ChangePasswordRequest,
    conn: asyncpg.Connection = Depends(get_db)
):
    # Get user from token
    user = await authenticate_user(payload.email, payload.current_password, conn)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )
    
    # Verify new passwords match
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match",
        )
    
    # Hash new password
    hashed_password = get_password_hash(payload.new_password)
    
    # Update password in database
    table = "technician" if user["type"] == "technician" else "client"
    id_field = "technician_id" if user["type"] == "technician" else "client_id"
    
    await conn.execute(
        f"UPDATE {table} SET password_hash = $1 WHERE {id_field} = $2",
        hashed_password, user["id"]
    )
    
    return {"message": "Password updated successfully"}

@auth_router.post("/register/client")
async def register_client(
    payload: ClientCreate,
    conn: asyncpg.Connection = Depends(get_db)
):
    name = payload.name
    surname = payload.surname
    email = payload.email
    phone_number = payload.phone_number
    password = payload.password
    location_name = payload.location_name
    
    # Check if email already exists
    existing = await conn.fetchrow(
        "SELECT 1 FROM client WHERE email = $1", email
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if phone number exists
    existing = await conn.fetchrow(
        "SELECT 1 FROM client WHERE phone_number = $1", phone_number
    )
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    hashed_password = get_password_hash(password)
    
    
    try:
        client_id = await conn.fetchval(
            """
            INSERT INTO client (name, surname, email, phone_number, password_hash, location_name)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING client_id
            """,
            name, surname, email, phone_number, hashed_password, location_name
        )
        return {"client_id": client_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@auth_router.post("/register/technician")
async def register_technician(
    payload: TechnicianCreate,
    conn: asyncpg.Connection = Depends(get_db)
):
    # Check if email exists
    existing = await conn.fetchrow(
        """
        SELECT 1 FROM (
            SELECT email FROM client
            UNION ALL
            SELECT email FROM technician
        ) combined WHERE email = $1
        """,
        payload.email
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check if phone number exists
    existing = await conn.fetchrow(
        """
        SELECT 1 FROM (
            SELECT phone_number FROM client
            UNION ALL
            SELECT phone_number FROM technician
        ) combined WHERE phone_number = $1
        """,
        payload.phone_number
    )
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    hashed_password = get_password_hash(payload.password)
    
    try:
        technician_id = await conn.fetchval(
            """
            INSERT INTO technician (
                name, surname, email, phone_number, password_hash,
                location_name, latitude, longitude,
                service_types, experience_years, is_verified, is_available
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, TRUE)
            RETURNING technician_id
            """,
            payload.name, payload.surname, payload.email, payload.phone_number, hashed_password,
            payload.location_name, payload.latitude, payload.longitude,
            payload.service_types, payload.experience_years
        )
        
        return {
            "technician_id": technician_id,
            "message": "Technician registered successfully. Awaiting verification."
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Registration failed: {str(e)}"
        )

@auth_router.post("/register/admin", response_model=AdminOut)
async def register_admin(
    data: AdminCreate,
    conn: asyncpg.Connection = Depends(get_db)
):
    # Check if email or phone already exists
    existing = await conn.fetchrow(
        "SELECT 1 FROM admin WHERE email = $1 OR phone_number = $2",
        data.email, data.phone_number
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already registered")

    hashed_password = get_password_hash(data.password)

    row = await conn.fetchrow(
        """
        INSERT INTO admin (name, surname, email, phone_number, password_hash, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING admin_id, name, surname, email, phone_number, role
        """,
        data.name, data.surname, data.email, data.phone_number, hashed_password, data.role
    )

    return AdminOut(**dict(row))

__all__ = ["auth_router"]
