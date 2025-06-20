# app/routes/__init__.py
from .auth import auth_router
from .clients import clients_router
from .technicians import technicians_router
from .bookings import bookings_router
from .payments import payments_router
from .reviews import reviews_router

routers = [
    auth_router,
    clients_router,
    technicians_router,
    bookings_router,
    payments_router,
    reviews_router
]

__all__ = ["routers"]