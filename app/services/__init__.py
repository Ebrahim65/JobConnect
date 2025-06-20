# app/services/__init__.py
from .google_maps import google_maps_service

# Export all service instances
__all__ = [
    "google_maps_service"
]

# Optional: Initialize services when module is imported
def init_services():
    """
    Initialize all service connections when the module is loaded
    """
    try:
        # Test Google Maps service connection
        if google_maps_service.client:
            print("Google Maps service initialized successfully")
    except Exception as e:
        print(f"Service initialization error: {str(e)}")

# Initialize services when module loads
init_services()