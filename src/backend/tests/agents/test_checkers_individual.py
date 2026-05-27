"""Tests for all 8 individual checker classes.

Covers quick_scan and deep_analyze for each checker, plus weight parameter
and exception handling.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from backend.agents.checkers.base import BaseChecker, CheckerResult
from backend.agents.checkers.consistency_checker import ConsistencyChecker
from backend.agents.checkers.continuity_checker import ContinuityChecker
from backend.agents.checkers.pacing_checker import PacingChecker
from backend.agents.checkers.ooc_checker import OOCChecker
from backend.agents.checkers.high_point_checker import HighPointChecker
from backend.agents.checkers.reader_pull_checker import ReaderPullChecker
from backend.agents.checkers.outline_law_enforcer import OutlineLawEnforcer
from backend.agents.checkers.setting_physics_enforcer import SettingPhysicsEnforcer


# =============================================================================
# Helpers
# =============================================================================

def _make_ai_service_mock():
    """Create a mock AIService."""
    svc = MagicMock()
    svc.base_url = "https://api.test.com"
    svc.endpoint_path = "/chat/completions"
    svc.api_key = "test-key"
    return svc


def _make_api_client_mock(return_value: str):
    """Create a mock MiniMaxAPIClient that returns a fixed value."""
    client = AsyncMock()
    client.call = AsyncMock(return_value=return_value)
    return client


AI_SUCCESS_RESPONSE = json.dumps({
    "score": 75,
    "issues": [{"type": "test_issue", "severity": "medium", "message": "test"}],
    "suggestions": ["test suggestion"],
}, ensure_ascii=False)

# A chapter-like content with enough characters for all heuristic checks
LONG_CONTENT = (
    "他站在城门口，望着远处的山脉。突然，一阵风吹过，他感到了危险的气息。\n"
    "战斗即将开始。对手是一名元婴修士，实力远超他的筑基境界。\n"
    "秘密就隐藏在这座古城之中。真相终将被揭露。\n"
    "她微微一笑，温柔地说道：\"你怎么来了？\" \n"
    "他紧张地握紧了拳头，心跳加速。千钧一发之际，他做出了决定。\n"
    "命运的齿轮开始转动。宿命注定他要面对这一切。\n"
    "突然，一道光芒闪过。震惊之余，他发现自己已经来到了另一个地方。\n"
    "难道这就是传说中的秘密基地？没想到竟然在这里。\n"
    "战斗、对决、激战，这些词汇在他脑海中回荡。\n"
    "他爆发出了前所未有的力量。释放了体内积蓄已久的灵力。\n"
    "逆转开始了。反转的剧情让所有人都震惊不已。\n"
    "觉醒的力量让他突破了桎梏。领悟了天道的真谛。\n"
    "危机四伏的环境中，他步步为营。险境环生。\n"
    "多年后，他终于明白了当年的真相。秘密终于被揭开。\n"
    "悬念就在这里。答案将在下一章揭晓。\n"
) * 4  # Repeat to ensure enough length


# =============================================================================
# Weight Parameter Tests
# =============================================================================

class TestWeightParameter:
    """Verify all checkers accept weight parameter."""

    @pytest.mark.parametrize("checker_cls", [
        ConsistencyChecker, ContinuityChecker, PacingChecker, OOCChecker,
        HighPointChecker, ReaderPullChecker, OutlineLawEnforcer, SettingPhysicsEnforcer,
    ])
    def test_default_weight(self, checker_cls):
        """Default weight is 1.0."""
        checker = checker_cls()
        assert checker.weight == 1.0

    @pytest.mark.parametrize("checker_cls", [
        ConsistencyChecker, ContinuityChecker, PacingChecker, OOCChecker,
        HighPointChecker, ReaderPullChecker, OutlineLawEnforcer, SettingPhysicsEnforcer,
    ])
    def test_custom_weight(self, checker_cls):
        """Custom weight is stored correctly."""
        checker = checker_cls(weight=2.5)
        assert checker.weight == 2.5

    @pytest.mark.parametrize("checker_cls", [
        ConsistencyChecker, ContinuityChecker, PacingChecker, OOCChecker,
        HighPointChecker, ReaderPullChecker, OutlineLawEnforcer, SettingPhysicsEnforcer,
    ])
    def test_weight_with_ai_service(self, checker_cls):
        """Weight works alongside ai_service parameter."""
        ai = _make_ai_service_mock()
        checker = checker_cls(ai_service=ai, weight=0.5)
        assert checker.weight == 0.5
        assert checker._ai_service is ai


# =============================================================================
# ConsistencyChecker Tests
# =============================================================================

class TestConsistencyChecker:
    """Test ConsistencyChecker quick_scan and deep_analyze."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        checker = ConsistencyChecker()
        result = await checker.quick_scan("")
        assert result.score == 100
        assert result.issues == []

    @pytest.mark.asyncio
    async def test_quick_scan_timeline_contradiction(self):
        checker = ConsistencyChecker()
        content = "昨天他已经去了那里，今天他又回来了"
        result = await checker.quick_scan(content)
        assert result.score < 100
        assert any(i["type"] == "timeline_contradiction" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_power_level_contradiction(self):
        checker = ConsistencyChecker()
        # Pattern: (?:筑基|金丹|元婴) followed by (?:练气|后天)
        content = "他的元婴修为远超对手，对方不过练气而已"
        result = await checker.quick_scan(content)
        assert any(i["type"] == "power_level_contradiction" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_clean_content(self):
        checker = ConsistencyChecker()
        content = "他在山间小路上漫步，欣赏着风景"
        result = await checker.quick_scan(content)
        assert result.score == 100
        assert result.issues == []

    @pytest.mark.asyncio
    async def test_deep_analyze_no_ai_service(self):
        checker = ConsistencyChecker()
        result = await checker.deep_analyze("text", {})
        assert result.score == 0
        assert result.issues[0]["type"] == "configuration_error"

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self):
        checker = ConsistencyChecker(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock(AI_SUCCESS_RESPONSE)
        result = await checker.deep_analyze(LONG_CONTENT, {"world_settings": {}, "characters": []})
        assert result.score == 75
        assert len(result.issues) == 1

    @pytest.mark.asyncio
    async def test_deep_analyze_json_parse_error(self):
        checker = ConsistencyChecker(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock("not valid json")
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 70
        assert result.issues[0]["type"] == "parse_error"

    @pytest.mark.asyncio
    async def test_deep_analyze_http_error(self):
        checker = ConsistencyChecker(ai_service=_make_ai_service_mock())
        mock_client = AsyncMock()
        mock_client.call = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
        checker._api_client = mock_client
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 0
        assert result.issues[0]["type"] == "analysis_error"

    @pytest.mark.asyncio
    async def test_deep_analyze_timeout_error(self):
        checker = ConsistencyChecker(ai_service=_make_ai_service_mock())
        mock_client = AsyncMock()
        mock_client.call = AsyncMock(side_effect=httpx.TimeoutException("Timed out"))
        checker._api_client = mock_client
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 0
        assert "analysis_error" in result.issues[0]["type"]


# =============================================================================
# ContinuityChecker Tests
# =============================================================================

class TestContinuityChecker:
    """Test ContinuityChecker quick_scan and deep_analyze."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        checker = ContinuityChecker()
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_character_state_contradiction(self):
        checker = ContinuityChecker()
        # Pattern: (?:伤[势病]|受[伤损]) followed by (?:完好无损|完全恢复|好了)
        content = "他受伤之后竟然完好无损地站在那里"
        result = await checker.quick_scan(content)
        assert any(i["type"] == "character_state_inconsistency" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_timeline_contradiction(self):
        checker = ContinuityChecker()
        content = "一会儿天亮了，几天后他又回到了原地"
        result = await checker.quick_scan(content)
        assert any(i["type"] == "timeline_marker_contradiction" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_clean_content(self):
        checker = ContinuityChecker()
        result = await checker.quick_scan("今天天气不错，他走在路上")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_deep_analyze_no_ai_service(self):
        checker = ContinuityChecker()
        result = await checker.deep_analyze("text", {})
        assert result.score == 0
        assert result.issues[0]["type"] == "configuration_error"

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self):
        checker = ContinuityChecker(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock(AI_SUCCESS_RESPONSE)
        result = await checker.deep_analyze(LONG_CONTENT, {"previous_chapters": []})
        assert result.score == 75

    @pytest.mark.asyncio
    async def test_deep_analyze_http_error(self):
        checker = ContinuityChecker(ai_service=_make_ai_service_mock())
        mock_client = AsyncMock()
        mock_client.call = AsyncMock(side_effect=httpx.HTTPStatusError(
            "500", request=MagicMock(), response=MagicMock(status_code=500)
        ))
        checker._api_client = mock_client
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 0


# =============================================================================
# PacingChecker Tests
# =============================================================================

class TestPacingChecker:
    """Test PacingChecker quick_scan and deep_analyze."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        checker = PacingChecker()
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_chapter_too_short(self):
        checker = PacingChecker()
        result = await checker.quick_scan("太短了")
        assert any(i["type"] == "chapter_too_short" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_strand_analysis(self):
        checker = PacingChecker()
        content = "感情" * 100 + "任务" * 10  # Fire-heavy content
        result = await checker.quick_scan(content)
        # Should detect fire_ratio > 0.45
        assert any(i["type"] == "strand_imbalance" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_normal_content(self):
        checker = PacingChecker()
        result = await checker.quick_scan(LONG_CONTENT)
        # LONG_CONTENT should produce a reasonable score
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_deep_analyze_no_ai_service(self):
        checker = PacingChecker()
        result = await checker.deep_analyze("text", {})
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self):
        checker = PacingChecker(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock(AI_SUCCESS_RESPONSE)
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 75

    @pytest.mark.asyncio
    async def test_deep_analyze_value_error(self):
        checker = PacingChecker(ai_service=_make_ai_service_mock())
        mock_client = AsyncMock()
        mock_client.call = AsyncMock(side_effect=ValueError("Empty response"))
        checker._api_client = mock_client
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 0


# =============================================================================
# OOCChecker Tests
# =============================================================================

class TestOOCChecker:
    """Test OOCChecker quick_scan and deep_analyze."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        checker = OOCChecker()
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_personality_shift(self):
        checker = OOCChecker()
        content = "他突然变得沉默起来，不像他平时的作风"
        result = await checker.quick_scan(content)
        assert len(result.issues) >= 1

    @pytest.mark.asyncio
    async def test_quick_scan_emotion_contradiction(self):
        checker = OOCChecker()
        content = "他刚才开心地大笑，立刻悲伤地痛哭起来"
        result = await checker.quick_scan(content)
        assert any(i["type"] == "emotion_flip" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_clean_content(self):
        checker = OOCChecker()
        result = await checker.quick_scan("他平静地走着")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_deep_analyze_no_ai_service(self):
        checker = OOCChecker()
        result = await checker.deep_analyze("text", {})
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self):
        checker = OOCChecker(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock(AI_SUCCESS_RESPONSE)
        result = await checker.deep_analyze(LONG_CONTENT, {"characters": []})
        assert result.score == 75

    @pytest.mark.asyncio
    async def test_deep_analyze_connect_error(self):
        checker = OOCChecker(ai_service=_make_ai_service_mock())
        mock_client = AsyncMock()
        mock_client.call = AsyncMock(side_effect=httpx.ConnectError("refused"))
        checker._api_client = mock_client
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 0


# =============================================================================
# HighPointChecker Tests
# =============================================================================

class TestHighPointChecker:
    """Test HighPointChecker quick_scan and deep_analyze."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        checker = HighPointChecker()
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_no_high_points(self):
        checker = HighPointChecker()
        content = "他走着走着，看到了一棵树。树叶很绿。" * 100
        result = await checker.quick_scan(content)
        # Should detect low excitement density or no high points
        assert result.score < 100

    @pytest.mark.asyncio
    async def test_quick_scan_with_high_points(self):
        checker = HighPointChecker()
        result = await checker.quick_scan(LONG_CONTENT)
        # LONG_CONTENT has many excitement keywords
        assert result.score > 0

    @pytest.mark.asyncio
    async def test_deep_analyze_no_ai_service(self):
        checker = HighPointChecker()
        result = await checker.deep_analyze("text", {})
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self):
        checker = HighPointChecker(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock(AI_SUCCESS_RESPONSE)
        result = await checker.deep_analyze(LONG_CONTENT, {"genre": "玄幻"})
        assert result.score == 75

    @pytest.mark.asyncio
    async def test_deep_analyze_timeout(self):
        checker = HighPointChecker(ai_service=_make_ai_service_mock())
        mock_client = AsyncMock()
        mock_client.call = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        checker._api_client = mock_client
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 0


# =============================================================================
# ReaderPullChecker Tests
# =============================================================================

class TestReaderPullChecker:
    """Test ReaderPullChecker quick_scan and deep_analyze."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        checker = ReaderPullChecker()
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_weak_opening(self):
        checker = ReaderPullChecker()
        content = "天晴了。风停了。" + "普通的文字内容" * 200
        result = await checker.quick_scan(content)
        assert any(i["type"] == "weak_opening_hook" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_with_hooks(self):
        checker = ReaderPullChecker()
        result = await checker.quick_scan(LONG_CONTENT)
        # LONG_CONTENT has hooks at start and end
        assert result.score > 0

    @pytest.mark.asyncio
    async def test_deep_analyze_no_ai_service(self):
        checker = ReaderPullChecker()
        result = await checker.deep_analyze("text", {})
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self):
        checker = ReaderPullChecker(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock(AI_SUCCESS_RESPONSE)
        result = await checker.deep_analyze(LONG_CONTENT, {"genre": "玄幻"})
        assert result.score == 75

    @pytest.mark.asyncio
    async def test_deep_analyze_http_status_error(self):
        checker = ReaderPullChecker(ai_service=_make_ai_service_mock())
        mock_client = AsyncMock()
        mock_client.call = AsyncMock(side_effect=httpx.HTTPStatusError(
            "429", request=MagicMock(), response=MagicMock(status_code=429)
        ))
        checker._api_client = mock_client
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 0


# =============================================================================
# OutlineLawEnforcer Tests
# =============================================================================

class TestOutlineLawEnforcer:
    """Test OutlineLawEnforcer quick_scan and deep_analyze."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        checker = OutlineLawEnforcer()
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_death_detection(self):
        checker = OutlineLawEnforcer()
        content = "张三死了，他的尸体躺在地上"
        result = await checker.quick_scan(content)
        assert any(i["type"] == "potential_death" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_plot_deviation(self):
        checker = OutlineLawEnforcer()
        content = "剧情突然完全变了方向，毫无征兆地推翻了之前的设定"
        result = await checker.quick_scan(content)
        assert any(i["type"] == "plot_deviation_signal" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_tone_inconsistency(self):
        checker = OutlineLawEnforcer()
        content = "黑暗绝望残酷血腥阴郁压抑 搞笑欢乐愉快温馨甜蜜轻松" * 5
        result = await checker.quick_scan(content)
        assert any(i["type"] == "tone_inconsistency" for i in result.issues)

    @pytest.mark.asyncio
    async def test_deep_analyze_no_ai_service(self):
        checker = OutlineLawEnforcer()
        result = await checker.deep_analyze("text", {})
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self):
        checker = OutlineLawEnforcer(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock(AI_SUCCESS_RESPONSE)
        result = await checker.deep_analyze(LONG_CONTENT, {"outline": {}})
        assert result.score == 75

    @pytest.mark.asyncio
    async def test_deep_analyze_json_parse_error(self):
        checker = OutlineLawEnforcer(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock("not json at all")
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 70
        assert result.issues[0]["type"] == "parse_error"


# =============================================================================
# SettingPhysicsEnforcer Tests
# =============================================================================

class TestSettingPhysicsEnforcer:
    """Test SettingPhysicsEnforcer quick_scan and deep_analyze."""

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self):
        checker = SettingPhysicsEnforcer()
        result = await checker.quick_scan("")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_quick_scan_realm_jump(self):
        checker = SettingPhysicsEnforcer()
        content = "他从练气一路飙升到了元婴，实力大增"
        result = await checker.quick_scan(content)
        assert any(i["type"] == "realm_jump_without_explanation" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_magic_violation(self):
        checker = SettingPhysicsEnforcer()
        content = "他没有魔力却轻松施展了禁咒，随意地挥了挥手"
        result = await checker.quick_scan(content)
        assert any(i["type"] == "magic_system_violation" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_power_inconsistency(self):
        checker = SettingPhysicsEnforcer()
        content = "区区练气修士，毫无费力地击败了高境界的元婴强者"
        result = await checker.quick_scan(content)
        assert any(i["type"] == "power_level_inconsistency" for i in result.issues)

    @pytest.mark.asyncio
    async def test_quick_scan_clean_content(self):
        checker = SettingPhysicsEnforcer()
        result = await checker.quick_scan("他在山间散步")
        assert result.score == 100

    @pytest.mark.asyncio
    async def test_deep_analyze_no_ai_service(self):
        checker = SettingPhysicsEnforcer()
        result = await checker.deep_analyze("text", {})
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_deep_analyze_success(self):
        checker = SettingPhysicsEnforcer(ai_service=_make_ai_service_mock())
        checker._api_client = _make_api_client_mock(AI_SUCCESS_RESPONSE)
        result = await checker.deep_analyze(LONG_CONTENT, {"world_settings": {}, "rules": []})
        assert result.score == 75

    @pytest.mark.asyncio
    async def test_deep_analyze_connect_error(self):
        checker = SettingPhysicsEnforcer(ai_service=_make_ai_service_mock())
        mock_client = AsyncMock()
        mock_client.call = AsyncMock(side_effect=httpx.ConnectError("refused"))
        checker._api_client = mock_client
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_deep_analyze_value_error(self):
        checker = SettingPhysicsEnforcer(ai_service=_make_ai_service_mock())
        mock_client = AsyncMock()
        mock_client.call = AsyncMock(side_effect=ValueError("Empty response content from API"))
        checker._api_client = mock_client
        result = await checker.deep_analyze(LONG_CONTENT, {})
        assert result.score == 0


# =============================================================================
# Cross-cutting: No bare except Exception in business logic
# =============================================================================

class TestNoBareExceptException:
    """Verify that checker modules do not use bare 'except Exception'."""

    @pytest.mark.parametrize("module_path", [
        "backend.agents.checkers.consistency_checker",
        "backend.agents.checkers.continuity_checker",
        "backend.agents.checkers.pacing_checker",
        "backend.agents.checkers.ooc_checker",
        "backend.agents.checkers.high_point_checker",
        "backend.agents.checkers.reader_pull_checker",
        "backend.agents.checkers.outline_law_enforcer",
        "backend.agents.checkers.setting_physics_enforcer",
    ])
    def test_no_bare_except_exception(self, module_path):
        """Checker modules should not have bare 'except Exception' blocks."""
        import importlib
        import inspect

        mod = importlib.import_module(module_path)
        source = inspect.getsource(mod)

        # Check that no 'except Exception' appears in the source
        # Allow 'except Exception' only if it's part of a more specific pattern
        lines = source.split("\n")
        for i, line in enumerate(lines):
            stripped = line.strip()
            # Flag bare 'except Exception' that isn't 'except (SpecificError, ..., Exception)'
            if stripped == "except Exception as e:" or stripped == "except Exception:":
                # Check it's not inside a comment
                if not stripped.startswith("#"):
                    # This is a bare except Exception - check context
                    # In checkers, we expect specific exceptions only
                    # The pipeline's _run_checker_safe is allowed to have it
                    # but individual checkers should not
                    if "pipeline" not in module_path:
                        pytest.fail(
                            f"Found bare 'except Exception' at line {i+1} in {module_path}: {stripped}"
                        )
