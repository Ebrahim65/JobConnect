from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from ..models.technician_verification import VerificationRequest
from ..utils.auth import get_current_user
from ..utils.file_upload import upload_file_to_storage
from ..database import get_db
import asyncpg

verification_router = APIRouter(prefix="/verification", tags=["Verification"])

@verification_router.post("/request", status_code=status.HTTP_201_CREATED)
async def submit_verification(
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db)
):
    if current_user["type"] != "technician":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    document_urls = []
    for file in files:
        url = await upload_file_to_storage(file, "verification_docs")
        document_urls.append(url)
    
    await conn.execute(
        """
        UPDATE technician
        SET verification_status = 'pending',
            verification_documents = $1
        WHERE technician_id = $2
        """,
        document_urls,
        current_user["id"]
    )
    return {"message": "Verification submitted"}