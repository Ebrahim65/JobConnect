# app/queries/__init__.py
from .client_queries import (
    create_client,
    get_client_by_id,
    update_client,
    get_client_favorites
)
from .technician_queries import (
    create_technician,
    get_technician_by_id,
    search_technicians,
    update_technician_availability
)
from .booking_queries import (
    create_booking,
    get_booking_by_id,
    update_booking_status,
    get_client_bookings
)
from .review_queries import (
    create_review,
    get_review_by_id,
    get_technician_reviews
)
from .payment_queries import (
    create_payment,
    get_payment_by_id,
    update_payment_status,
    get_client_payments
)

__all__ = [
    # Client queries
    'create_client',
    'get_client_by_id',
    'update_client',
    'get_client_favorites',
    
    # Technician queries
    'create_technician',
    'get_technician_by_id',
    'search_technicians',
    'update_technician_availability',
    
    # Booking queries
    'create_booking',
    'get_booking_by_id',
    'update_booking_status',
    'get_client_bookings',
    
    # Review queries
    'create_review',
    'get_review_by_id',
    'get_technician_reviews',
    
    # Payment queries
    'create_payment',
    'get_payment_by_id',
    'update_payment_status',
    'get_client_payments'
]