"""Anthropic SSE generation tests."""
import asyncio
from unittest.mock import MagicMock, patch


def _collect_chunks(prompt: str = "test") -> list[str]:
    from app.services.ai_generate import stream_chunks

    chunks: list[str] = []

    async def collect() -> None:
        async for chunk in stream_chunks(prompt):
            chunks.append(chunk)

    asyncio.run(collect())
    return chunks


def _mock_stream(text_stream: list[str]) -> MagicMock:
    stream = MagicMock()
    stream.text_stream = text_stream
    stream.__enter__ = MagicMock(return_value=stream)
    stream.__exit__ = MagicMock(return_value=False)
    return stream


def test_stream_chunks_emits_sse_envelope():
    stream = _mock_stream(["Hello", " world"])

    with patch("app.services.ai_generate.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.stream.return_value = stream
        chunks = _collect_chunks()

    assert chunks[0] == 'event: chunk\ndata: {"text": "Hello"}\n\n'
    assert chunks[1] == 'event: chunk\ndata: {"text": " world"}\n\n'


def test_stream_chunks_skips_empty_text_deltas():
    stream = _mock_stream(["", "hello", ""])

    with patch("app.services.ai_generate.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.stream.return_value = stream
        chunks = _collect_chunks()

    chunk_events = [chunk for chunk in chunks if chunk.startswith("event: chunk")]
    assert chunk_events == ['event: chunk\ndata: {"text": "hello"}\n\n']


def test_stream_chunks_emits_done_event():
    stream = _mock_stream([])

    with patch("app.services.ai_generate.Anthropic") as mock_anthropic:
        mock_anthropic.return_value.messages.stream.return_value = stream
        chunks = _collect_chunks()

    assert chunks == ["event: done\ndata: {}\n\n"]
