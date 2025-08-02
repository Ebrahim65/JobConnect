# app/services/classifier.py

from typing import Optional

# Simple keyword-based mapping from description to technician types
class TechnicianClassifier:
    keyword_map = {
        "plumber": ["leak", "pipe", "toilet", "sink", "bathroom", "water"],
        "electrician": ["light", "power", "outlet", "wiring", "electric", "breaker"],
        "carpenter": ["wood", "door", "cabinet", "furniture", "repair frame", "floorboard"],
        "mechanic": ["car", "engine", "brakes", "vehicle", "transmission"],
        "painter": ["paint", "wall", "coating", "color", "repaint"],
        "gardener": ["garden", "plants", "lawn", "landscaping", "weeds", "flowers"],
        "cleaner": ["clean", "dirt", "stain", "dust", "vacuum", "maid"],
        "technician": ["appliance", "tv", "fridge", "microwave", "device", "repair"],
    }

    @classmethod
    def classify(cls, description: str) -> Optional[str]:
        desc_lower = description.lower()
        for service_type, keywords in cls.keyword_map.items():
            for keyword in keywords:
                if keyword in desc_lower:
                    return service_type
        return "general technician"  # fallback generic type
