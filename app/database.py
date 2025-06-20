# app/database.py
import asyncpg
from typing import AsyncGenerator
from .config import settings

async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    conn = await asyncpg.connect(
        user=settings.database_username,
        password=settings.database_password,
        database=settings.database_name,
        host=settings.database_hostname,
        port=settings.database_port
    )
    try:
        yield conn
    finally:
        await conn.close()