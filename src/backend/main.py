# Auto Novel Writer - FastAPI Main Application
# Python 3.11+

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import api_router

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)


@app.get("/")
async def root():
    return {"message": "Writer API", "version": settings.app_version}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
