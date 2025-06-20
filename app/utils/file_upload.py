# app/utils/file_upload.py
import os
import uuid
from fastapi import UploadFile, HTTPException

UPLOAD_DIR = "/uploads"

def save_profile_picture(file: UploadFile, user_type: str, user_id: str) -> str:
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    ext = "jpg" if file.content_type == "image/jpeg" else "png"
    filename = f"{user_type}_{user_id}_{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(file.file.read())

    return f"/uploads/{filename}"
