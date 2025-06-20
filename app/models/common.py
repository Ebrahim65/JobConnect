from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# models/common.py
class UserStrike(BaseModel):
    user_id: str
    user_type: str  # "client" or "technician"
    reason: str
    admin_id: str