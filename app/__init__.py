# app/__init__.py
from fastapi import FastAPI
from .routes import routers
from .database import get_db

def create_app() -> FastAPI:
    app = FastAPI(
        title="JobConnect API",
        description="Backend for JobConnect platform",
        version="1.0.0"
    )
    
    # Include all routers
    for router in routers:
        app.include_router(router)
    
    return app