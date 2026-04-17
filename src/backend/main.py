# Auto Novel Writer - FastAPI Main Application
# Python 3.11+

import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from routes import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger('writer-api')

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


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    method = request.method
    path = request.url.path

    logger.info(f"→ {method} {path}")

    response = await call_next(request)

    duration = time.time() - start_time
    logger.info(f"← {method} {path} {response.status_code} {duration:.3f}s")

    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc) if settings.app_version == "dev" else "An error occurred"},
    )


@app.get("/")
async def root():
    return {"message": "Writer API", "version": settings.app_version}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
