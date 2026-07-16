"""AI text generation via Anthropic SDK with MiniMax proxy."""
import json
from typing import AsyncGenerator

from anthropic import Anthropic

from app.config import get_settings


async def stream_chunks(
    prompt: str,
    operation: str = "extend",
) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted chunks for AI generation."""
    settings = get_settings()
    client = Anthropic(
        api_key=settings.anthropic_api_key,
        base_url=settings.anthropic_base_url,
    )

    try:
        with client.messages.stream(
            model=settings.anthropic_model,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                if text:
                    yield f"event: chunk\ndata: {json.dumps({'text': text})}\n\n"
            yield "event: done\ndata: {}\n\n"
    except Exception as exc:
        yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"
