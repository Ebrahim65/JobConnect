# app/routes/recommendation.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..utils.auth import get_current_user
from ..services.classifier import TechnicianClassifier

recommendation_router = APIRouter(prefix="/recommendation", tags=["Recommendation"])

class IssueDescription(BaseModel):
    description: str

class RecommendationOut(BaseModel):
    service_type: str

@recommendation_router.post("/recommend", response_model=RecommendationOut)
async def recommend_service(
    issue: IssueDescription,
    current_user: dict = Depends(get_current_user)
):
    try:
        classification = TechnicianClassifier.classify(issue.description)
        return {"service_type": classification}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")