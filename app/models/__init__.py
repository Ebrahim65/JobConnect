# app/models/__init__.py
from .auth import Token, TokenData, UserLogin, ClientCreate, TechnicianCreate, AdminCreate
from .technician import (
    BaseTechnician,
    InAppTechnician,
    ExternalTechnician,
    TechnicianSearchResults,
    TechnicianAvailability,
    TechnicianVerification
)
from .booking import (
    BookingStatus,
    BookingCreate,
    BookingOut,
    BookingStatusUpdate,
    BookingQueryParams
)
from .client import ClientOut, ClientUpdate, FavoriteTechnician, ClientDashboard
from .payment import (
    PaymentStatus,
    PaymentMethod,
    PaymentCreate,
    PaymentOut,
    PaymentUpdate
)
from .review import ReviewCreate, ReviewOut, TechnicianReviews

__all__ = [
    'Token', 'TokenData', 'UserLogin', 'ClientCreate', 'TechnicianCreate', 'AdminCreate',
    'BaseTechnician', 'InAppTechnician', 'ExternalTechnician', 'TechnicianSearchResults',
    'TechnicianAvailability', 'TechnicianVerification',
    'BookingStatus', 'BookingCreate', 'BookingOut', 'BookingStatusUpdate', 'BookingQueryParams',
    'ClientOut', 'ClientUpdate', 'FavoriteTechnician', 'ClientDashboard',
    'PaymentStatus', 'PaymentMethod', 'PaymentCreate', 'PaymentOut', 'PaymentUpdate',
    'ReviewCreate', 'ReviewOut', 'TechnicianReviews'
]