# app/utils/geo.py
from typing import Tuple
from geoalchemy2 import WKTElement
from geoalchemy2.functions import ST_Distance, ST_GeomFromText

def create_point(latitude: float, longitude: float) -> WKTElement:
    """Create a PostGIS point from lat/long coordinates"""
    return WKTElement(f'POINT({longitude} {latitude})', srid=4326)

def calculate_distance(
    conn,
    point1: Tuple[float, float],
    point2: Tuple[float, float]
) -> float:
    """Calculate distance between two points in kilometers"""
    lat1, lon1 = point1
    lat2, lon2 = point2
    point1_wkt = f'POINT({lon1} {lat1})'
    point2_wkt = f'POINT({lon2} {lat2})'
    
    distance = conn.scalar(
        ST_Distance(
            ST_GeomFromText(point1_wkt, 4326),
            ST_GeomFromText(point2_wkt, 4326)
        )
    )
    return distance / 1000  # Convert meters to kilometers