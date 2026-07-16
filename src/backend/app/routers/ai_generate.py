"""AI generation SSE route."""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.ai_generate import stream_chunks

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/generate")
def generate_ai(request: dict):
    prompt = request.get("prompt", "")
    operation = request.get("operation", "extend")
    return StreamingResponse(
        stream_chunks(prompt, operation),
        media_type="text/event-stream",
    )
