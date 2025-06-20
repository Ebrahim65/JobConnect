from fastapi import APIRouter, Depends, HTTPException
from ..utils.auth import get_current_user
from ..database import get_db
import asyncpg

notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])

@notifications_router.get("/")
async def get_notifications(
    status: str = "all",  # Options: "all", "read", "unread"
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    base_query = """
        SELECT notification_id, message, created_at, is_read
        FROM notification
        WHERE recipient_id = $1
    """
    if status == "read":
        base_query += " AND is_read = true"
    elif status == "unread":
        base_query += " AND is_read = false"
    
    base_query += " ORDER BY created_at DESC"
    
    rows = await conn.fetch(base_query, current_user["id"])
    return [dict(row) for row in rows]


@notifications_router.get("/unread")
async def get_unread_notifications(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    notifications = await conn.fetch(
        """
        SELECT notification_id, message, created_at
        FROM notification
        WHERE recipient_id = $1 AND is_read = false
        ORDER BY created_at DESC
        """,
        current_user["id"]
    )
    return [dict(row) for row in notifications]

@notifications_router.put("/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    result = await conn.execute(
        """
        UPDATE notification
        SET is_read = true
        WHERE notification_id = $1 AND recipient_id = $2
        """,
        notification_id,
        current_user["id"]
    )
    return {"message": "Notification marked as read"}

@notifications_router.put("/mark-all-read")
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    await conn.execute(
        """
        UPDATE notification
        SET is_read = true
        WHERE recipient_id = $1 AND is_read = false
        """,
        current_user["id"]
    )
    return {"message": "All notifications marked as read"}


@notifications_router.get("/unread/count")
async def get_unread_notification_count(
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    count = await conn.fetchval(
        """
        SELECT COUNT(*) FROM notification
        WHERE recipient_id = $1 AND is_read = false
        """,
        current_user["id"]
    )
    return {"count": count}