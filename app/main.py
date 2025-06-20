# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import (auth, public, recommendations, 
                     clients, technicians, bookings, 
                     reviews, payments, notifications, 
                     admin_reports, admin, schedule,
                     income, technician_distance)
from .config import settings
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="JobConnect API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://job-connect-app.netlify.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.auth_router)
app.include_router(clients.clients_router)
app.include_router(technicians.technicians_router)
app.include_router(bookings.bookings_router)
app.include_router(reviews.reviews_router)
app.include_router(payments.payments_router)
app.include_router(recommendations.recommendation_router)
app.include_router(public.public_router)
app.include_router(notifications.notifications_router)
app.include_router(admin_reports.admin_router)
app.include_router(admin.admin_router)
app.include_router(schedule.schedule_router)
app.include_router(income.income_router)
app.include_router(technician_distance.distance_router)
app.mount("/uploads", StaticFiles(directory="/uploads"), name="uploads")


@app.get("/")
def health_check():
    return {"status": "healthy", "version": app.version}