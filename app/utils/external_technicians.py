# app/utils/external_technicians.py
from typing import List, Dict, Any
from fastapi import HTTPException
import logging
from ..services.google_maps import google_maps_service
from .haversine import haversine

logger = logging.getLogger(__name__)

async def get_external_technicians(
    service_type: str,
    latitude: float,
    longitude: float,
    radius_km: int
) -> List[Dict[str, Any]]:
    """
    Get external technicians from Google Maps API
    Args:
        service_type: Type of service to search for
        latitude: Center point latitude
        longitude: Center point longitude
        radius_km: Search radius in kilometers
    Returns:
        List of formatted technician dictionaries
    """
    try:
        location = {"lat": latitude, "lng": longitude}
        radius_meters = radius_km * 1000
        
        businesses = google_maps_service.search_nearby_businesses(
            search_string=service_type,
            location=location,
            radius=radius_meters
        )
        
        return [
            _format_technician(biz, latitude, longitude)
            for biz in businesses
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"External technician search failed: {str(e)}")
        return []

def _format_technician(
    business: Dict[str, Any], 
    user_lat: float, 
    user_lon: float
) -> Dict[str, Any]:
    """Format Google Maps business data into technician format"""
    biz_location = business["geometry"]["location"]
    distance_km = haversine(
        user_lat, user_lon,
        biz_location["lat"], biz_location["lng"]
    )
    
    return {
        "id": f"ext_{business['place_id']}",
        "place_id": business["place_id"],
        "name": business.get("name", "Unknown Business"),
        "location_name": business.get("vicinity", "Location not available"),
        "latitude": biz_location["lat"],
        "longitude": biz_location["lng"],
        "rating": str(business.get("rating", "N/A")),
        "distance_km": round(distance_km, 2),
        "is_external": True,
        "external_source": "google_maps"
    }