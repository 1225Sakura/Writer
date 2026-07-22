"""AI text generation via Anthropic SDK with MiniMax proxy.

v0.5 Phase 1 Track A: Uses ProviderResolver for active provider lookup.
The resolver is the SINGLE POINT of decryption for AI flows (ADR §5).
"""
import asyncio as _asyncio
import json
from typing import AsyncGenerator

from anthropic import Anthropic

from app.config import get_settings


async def stream_chunks(
    prompt: str,
    operation: str = "extend",
) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted chunks for AI generation.

    v0.5 Phase 1 Track A: try ProviderResolver first; fall back to legacy
    settings.anthropic_* path if no active provider is configured (for
    bootstrap/dev scenarios where user hasn't set up providers yet).
    """
    settings = get_settings()
    api_key = None
    base_url = settings.anthropic_base_url
    model = settings.anthropic_model

    # Try resolver first
    try:
        from app.services.provider_resolver import (
            NoActiveProviderError,
            get_provider_resolver,
        )
        from app.database import SessionLocal

        resolver = get_provider_resolver()
        with SessionLocal() as session:
            config = _asyncio.run(
                resolver.get_active(session, user_id="default-user")
            )
            api_key = config.key.get()
            base_url = config.base_url or base_url
            model = config.model or model
    except Exception:
        # No active provider OR resolver failure → fall back to legacy
        # settings path (bootstrap scenarios).
        api_key = settings.anthropic_api_key

    if not api_key:
        yield f"event: error\ndata: {json.dumps({'message': 'No active AI provider configured and no fallback API key'})}\n\n"
        return

    client = Anthropic(api_key=api_key, base_url=base_url)
    try:
        with client.messages.stream(
            model=model,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                if text:
                    yield f"event: chunk\ndata: {json.dumps({'text': text})}\n\n"
            yield "event: done\ndata: {}\n\n"
    except Exception as exc:
        yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"
