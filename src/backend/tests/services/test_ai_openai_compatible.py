"""Tests for services.ai.openai_compatible — OpenAICompatibleProvider."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from backend.services.ai.openai_compatible import (
    AI_CACHE_TTL,
    STYLE_PROMPTS,
    OpenAICompatibleProvider,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_provider(**kwargs) -> OpenAICompatibleProvider:
    """Create an OpenAICompatibleProvider with sensible defaults."""
    return OpenAICompatibleProvider(
        api_key=kwargs.get("api_key", "test-key"),
        base_url=kwargs.get("base_url", "https://api.openai.test/v1"),
        model=kwargs.get("model", "gpt-4o"),
        timeout=kwargs.get("timeout", 10.0),
    )


def _mock_post_response(json_data: dict, status_code: int = 200) -> MagicMock:
    """Build a mock httpx.Response for non-streaming calls."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(),
            response=resp,
        )
    return resp


def _mock_stream_response(lines: list[str], status_code: int = 200) -> MagicMock:
    """Build a mock httpx.Response for streaming calls."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.raise_for_status = MagicMock()

    async def _aiter_lines():
        for line in lines:
            yield line

    resp.aiter_lines = _aiter_lines
    return resp


class _AsyncContextManager:
    """Wrap a value so it can be used with `async with`."""

    def __init__(self, value):
        self._value = value

    async def __aenter__(self):
        return self._value

    async def __aexit__(self, *args):
        return False


def _openai_chat_response(content: str = "generated text") -> dict:
    """Build a minimal OpenAI-style chat completion response."""
    return {
        "choices": [
            {
                "message": {"content": content},
                "index": 0,
            }
        ],
    }


def _sse_lines(*chunks: str) -> list[str]:
    """Build SSE lines from content chunks."""
    lines = []
    for chunk in chunks:
        data = json.dumps({
            "choices": [{"delta": {"content": chunk}, "index": 0}]
        })
        lines.append(f"data: {data}")
    lines.append("data: [DONE]")
    return lines


# ===========================================================================
# Provider metadata
# ===========================================================================

class TestOpenAICompatibleMetadata:
    def test_name(self):
        assert _make_provider().name == "openai_compatible"

    def test_supports_streaming(self):
        assert _make_provider().supports_streaming is True

    def test_max_tokens(self):
        assert _make_provider().max_tokens == 8192


# ===========================================================================
# Constructor
# ===========================================================================

class TestOpenAICompatibleConstructor:
    def test_strips_trailing_slash(self):
        p = OpenAICompatibleProvider(api_key="k", base_url="https://example.com/v1/")
        assert p._base_url == "https://example.com/v1"

    def test_defaults(self):
        p = OpenAICompatibleProvider(api_key="k")
        assert p._base_url == "https://api.openai.com/v1"
        assert p._model == "gpt-4o"
        assert p._timeout == 60.0

    def test_custom_values(self):
        p = OpenAICompatibleProvider(
            api_key="sk-123",
            base_url="https://deepseek.api/v1",
            model="deepseek-chat",
            timeout=30.0,
        )
        assert p._api_key == "sk-123"
        assert p._base_url == "https://deepseek.api/v1"
        assert p._model == "deepseek-chat"
        assert p._timeout == 30.0


# ===========================================================================
# Internal helpers
# ===========================================================================

class TestOpenAICompatibleHelpers:
    def test_get_system_prompt_known_styles(self):
        p = _make_provider()
        for style in STYLE_PROMPTS:
            result = p._get_system_prompt(style)
            assert isinstance(result, str)
            assert len(result) > 0

    def test_get_system_prompt_unknown_falls_back_to_default(self):
        p = _make_provider()
        result = p._get_system_prompt("unknown_style")
        assert result == STYLE_PROMPTS["default"]

    def test_get_operation_instruction_all_operations(self):
        p = _make_provider()
        for op in ["continue", "expand", "condense", "rewrite", "polish", "optimize"]:
            result = p._get_operation_instruction(op)
            assert isinstance(result, str)
            assert len(result) > 0

    def test_get_operation_instruction_unknown(self):
        p = _make_provider()
        result = p._get_operation_instruction("unknown_op")
        assert result == "继续写作。"

    def test_build_messages_has_system_and_user(self):
        p = _make_provider()
        msgs = p._build_messages("hello", "default", "continue")
        assert len(msgs) == 2
        assert msgs[0]["role"] == "system"
        assert msgs[1]["role"] == "user"
        assert "hello" in msgs[1]["content"]

    def test_build_messages_includes_style_and_operation(self):
        p = _make_provider()
        msgs = p._build_messages("test", "卡夫卡", "expand")
        assert "表现主义" in msgs[0]["content"]
        assert "扩写" in msgs[1]["content"]

    def test_headers_contains_bearer_token(self):
        p = OpenAICompatibleProvider(api_key="my-secret-key")
        h = p._headers()
        assert h["Authorization"] == "Bearer my-secret-key"
        assert h["Content-Type"] == "application/json"

    def test_build_messages_different_from_minimax(self):
        """OpenAI-compatible uses system+user messages, MiniMax uses single user message."""
        p = _make_provider()
        msgs = p._build_messages("test", "default", "continue")
        roles = [m["role"] for m in msgs]
        assert "system" in roles
        assert "user" in roles


# ===========================================================================
# _parse_sse_chunk
# ===========================================================================

class TestOpenAICompatibleSSEParsing:
    def test_parse_valid_chunk(self):
        p = _make_provider()
        line = 'data: {"choices":[{"delta":{"content":"hello"}}]}'
        assert p._parse_sse_chunk(line) == "hello"

    def test_parse_done_marker(self):
        p = _make_provider()
        assert p._parse_sse_chunk("data: [DONE]") is None

    def test_parse_non_data_line(self):
        p = _make_provider()
        assert p._parse_sse_chunk("event: ping") is None

    def test_parse_empty_data(self):
        p = _make_provider()
        assert p._parse_sse_chunk("data: ") is None

    def test_parse_malformed_json(self):
        p = _make_provider()
        assert p._parse_sse_chunk("data: {invalid json}") is None

    def test_parse_no_choices(self):
        p = _make_provider()
        assert p._parse_sse_chunk('data: {"choices":[]}}') is None

    def test_parse_no_delta_content(self):
        p = _make_provider()
        line = 'data: {"choices":[{"delta":{}}]}'
        assert p._parse_sse_chunk(line) is None


# ===========================================================================
# generate (non-streaming)
# ===========================================================================

class TestOpenAICompatibleGenerate:
    @pytest.mark.asyncio
    async def test_generate_success(self):
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response("generated text"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            result = await p.generate("write a story")
            assert result == "generated text"

    @pytest.mark.asyncio
    async def test_generate_empty_choices_raises(self):
        p = _make_provider()
        resp = _mock_post_response({"choices": []})

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            with pytest.raises(IndexError):
                await p.generate("prompt")

    @pytest.mark.asyncio
    async def test_generate_http_error(self):
        p = _make_provider()
        resp = _mock_post_response({}, status_code=500)

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            with pytest.raises(httpx.HTTPStatusError):
                await p.generate("prompt")

    @pytest.mark.asyncio
    async def test_generate_passes_model(self):
        p = _make_provider(model="deepseek-chat")
        resp = _mock_post_response(_openai_chat_response("ok"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            await p.generate("prompt")

            call_kwargs = mock_instance.post.call_args
            body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            assert body["model"] == "deepseek-chat"
            assert body["stream"] is False

    @pytest.mark.asyncio
    async def test_generate_uses_correct_url(self):
        p = _make_provider(base_url="https://ollama.local/v1")
        resp = _mock_post_response(_openai_chat_response("ok"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            await p.generate("prompt")
            url = mock_instance.post.call_args[0][0]
            assert url == "https://ollama.local/v1/chat/completions"

    @pytest.mark.asyncio
    async def test_generate_passes_style_and_operation(self):
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response("result"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            result = await p.generate("text", style="加缪", operation="condense")
            assert result == "result"


# ===========================================================================
# generate_stream
# ===========================================================================

class TestOpenAICompatibleGenerateStream:
    @pytest.mark.asyncio
    async def test_stream_success(self):
        p = _make_provider()
        lines = _sse_lines("chunk1", "chunk2", "chunk3")
        resp = _mock_stream_response(lines)

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = MagicMock()
            mock_instance.stream.return_value = _AsyncContextManager(resp)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            chunks = []
            async for chunk in p.generate_stream("prompt"):
                chunks.append(chunk)
            assert chunks == ["chunk1", "chunk2", "chunk3"]

    @pytest.mark.asyncio
    async def test_stream_empty(self):
        p = _make_provider()
        resp = _mock_stream_response(["data: [DONE]"])

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = MagicMock()
            mock_instance.stream.return_value = _AsyncContextManager(resp)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            chunks = []
            async for chunk in p.generate_stream("prompt"):
                chunks.append(chunk)
            assert chunks == []

    @pytest.mark.asyncio
    async def test_stream_with_mixed_lines(self):
        """SSE parsing skips non-data lines and malformed chunks."""
        p = _make_provider()
        lines = [
            "event: message",
            'data: {"choices":[{"delta":{"content":"hello"}}]}',
            "",
            'data: {"choices":[{"delta":{"content":" world"}}]}',
            "data: [DONE]",
        ]
        resp = _mock_stream_response(lines)

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = MagicMock()
            mock_instance.stream.return_value = _AsyncContextManager(resp)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            chunks = []
            async for chunk in p.generate_stream("prompt"):
                chunks.append(chunk)
            assert chunks == ["hello", " world"]

    @pytest.mark.asyncio
    async def test_stream_passes_stream_true(self):
        p = _make_provider()
        resp = _mock_stream_response(_sse_lines("x"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = MagicMock()
            mock_instance.stream.return_value = _AsyncContextManager(resp)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            async for _ in p.generate_stream("prompt"):
                pass

            call_kwargs = mock_instance.stream.call_args
            body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            assert body["stream"] is True

    @pytest.mark.asyncio
    async def test_stream_single_chunk(self):
        p = _make_provider()
        resp = _mock_stream_response(_sse_lines("only"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = MagicMock()
            mock_instance.stream.return_value = _AsyncContextManager(resp)
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            chunks = []
            async for chunk in p.generate_stream("prompt"):
                chunks.append(chunk)
            assert chunks == ["only"]


# ===========================================================================
# review
# ===========================================================================

class TestOpenAICompatibleReview:
    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_review_success(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response("review result"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            result = await p.review({"world": "fantasy"}, settings={"strict": True})
            assert result["review_content"] == "review result"
            assert "raw_response" in result
            mock_set_cache.assert_called_once()

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result")
    async def test_review_returns_cache(self, mock_get_cache):
        mock_get_cache.return_value = {"review_content": "cached"}
        p = _make_provider()

        result = await p.review({"world": "fantasy"})
        assert result == {"review_content": "cached"}

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_review_http_error(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        resp = _mock_post_response({}, status_code=429)

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            with pytest.raises(httpx.HTTPStatusError):
                await p.review({"content": "test"})

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_review_uses_system_prompt(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response("ok"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            await p.review({"data": "test"})

            call_kwargs = mock_instance.post.call_args
            body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            messages = body["messages"]
            assert messages[0]["role"] == "system"
            assert "审核" in messages[0]["content"]

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_review_uses_temperature(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response("ok"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            await p.review({"data": "test"})

            call_kwargs = mock_instance.post.call_args
            body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            assert body["temperature"] == 0.5

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_review_uses_correct_url(self, mock_set_cache, mock_get_cache):
        p = _make_provider(base_url="https://custom.api/v1")
        resp = _mock_post_response(_openai_chat_response("ok"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            await p.review({"data": "test"})
            url = mock_instance.post.call_args[0][0]
            assert url == "https://custom.api/v1/chat/completions"


# ===========================================================================
# extract_entities
# ===========================================================================

class TestOpenAICompatibleExtractEntities:
    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_extract_entities_success(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        entities = [{"name": "Alice", "type": "character"}]
        resp = _mock_post_response(_openai_chat_response(json.dumps(entities)))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            result = await p.extract_entities("Alice walked into the tavern.")
            assert result == entities
            mock_set_cache.assert_called_once()

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result")
    async def test_extract_entities_returns_cache(self, mock_get_cache):
        mock_get_cache.return_value = {"entities": [{"name": "Bob"}]}
        p = _make_provider()

        result = await p.extract_entities("text")
        assert result == [{"name": "Bob"}]

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_extract_entities_non_json_response(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response("not valid json"))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            result = await p.extract_entities("text")
            assert result == [{"raw_content": "not valid json"}]

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_extract_entities_dict_not_list(self, mock_set_cache, mock_get_cache):
        """If AI returns a dict instead of list, treat as empty list."""
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response(json.dumps({"key": "value"})))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            result = await p.extract_entities("text")
            assert result == []

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_extract_entities_list_input(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response(json.dumps([])))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            result = await p.extract_entities(["msg1", "msg2"])
            assert result == []

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_extract_entities_http_error(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        resp = _mock_post_response({}, status_code=500)

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            with pytest.raises(httpx.HTTPStatusError):
                await p.extract_entities("text")

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_extract_entities_uses_temperature(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response(json.dumps([])))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            await p.extract_entities("text")

            call_kwargs = mock_instance.post.call_args
            body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            assert body["temperature"] == 0.3

    @pytest.mark.asyncio
    @patch("backend.services.ai.openai_compatible.get_cached_ai_result", return_value=None)
    @patch("backend.services.ai.openai_compatible.set_cached_ai_result")
    async def test_extract_entities_uses_system_prompt(self, mock_set_cache, mock_get_cache):
        p = _make_provider()
        resp = _mock_post_response(_openai_chat_response(json.dumps([])))

        with patch("backend.services.ai.openai_compatible.httpx.AsyncClient") as MockClient:
            mock_instance = AsyncMock()
            mock_instance.post.return_value = resp
            mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
            mock_instance.__aexit__ = AsyncMock(return_value=False)
            MockClient.return_value = mock_instance

            await p.extract_entities("text")

            call_kwargs = mock_instance.post.call_args
            body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            messages = body["messages"]
            assert messages[0]["role"] == "system"
            assert "实体提取" in messages[0]["content"]
