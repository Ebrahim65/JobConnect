# app/services/google_maps.py
import googlemaps
import os
from typing import Dict, List, Any
from fastapi import HTTPException, status
from ..config import settings

class GoogleMapsService:
    def __init__(self):
        self.client = googlemaps.Client(key=settings.google_maps_api_key)
    
    def search_nearby_businesses(
        self,
        search_string: str,
        location: Dict[str, float],
        radius: int
    ) -> List[Dict[str, Any]]:
        try:
            results = self.client.places_nearby(
                location=location,
                keyword=search_string,
                radius=radius,
                language='en'
            )
            return results.get("results", [])
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_424_FAILED_DEPENDENCY,
                detail=f"Google Maps API error: {str(e)}"
            )

google_maps_service = GoogleMapsService()