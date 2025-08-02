# app/config.py
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Database
    database_username: str
    database_password: str
    database_hostname: str
    database_port: str
    database_name: str
    
    # Auth
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # External APIs
    google_maps_api_key: str
    google_geolocation_api_key: str
   
    
    # CORS
    allowed_origins: List[str] = ["*"]
    
    class Config:
        env_file = ".env"
        extra = "ignore"

upload_dir = "uploads"
allowed_profile_picture_types = ["image/jpeg", "image/png", "image/gif"]

settings = Settings()
