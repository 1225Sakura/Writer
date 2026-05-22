"""
Smoke tests for all 8 checkers — verify quick_scan runs without exceptions.
Phase 0.5.2: Validates checker executability, not business logic correctness.
"""

import pytest
from backend.agents.checkers import (
    ConsistencyChecker,
    ContinuityChecker,
    PacingChecker,
    OOCChecker,
    HighPointChecker,
    ReaderPullChecker,
    OutlineLawEnforcer,
    SettingPhysicsEnforcer,
)
from backend.agents.checkers.base import CheckerResult

SAMPLE_CONTENT = (
    "第一章 初入江湖\n\n"
    "少年李明站在山门前，望着高耸入云的石阶，心中既紧张又期待。"
    "他知道，从今天起，他将正式成为青云宗的外门弟子。\n\n"
    "「走吧，」身旁的老人拍了拍他的肩膀，「不要害怕。」\n\n"
    "李明深吸一口气，迈出了第一步。"
)


class TestCheckerSmoke:
    """Smoke tests: every checker's quick_scan runs and returns CheckerResult."""

    @pytest.mark.asyncio
    async def test_consistency_quick_scan(self):
        checker = ConsistencyChecker(ai_service=None)
        result = await checker.quick_scan(SAMPLE_CONTENT)
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_continuity_quick_scan(self):
        checker = ContinuityChecker(ai_service=None)
        result = await checker.quick_scan(SAMPLE_CONTENT)
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_pacing_quick_scan(self):
        checker = PacingChecker(ai_service=None)
        result = await checker.quick_scan(SAMPLE_CONTENT)
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_ooc_quick_scan(self):
        checker = OOCChecker(ai_service=None)
        result = await checker.quick_scan(SAMPLE_CONTENT)
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_high_point_quick_scan(self):
        checker = HighPointChecker(ai_service=None)
        result = await checker.quick_scan(SAMPLE_CONTENT)
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_reader_pull_quick_scan(self):
        checker = ReaderPullChecker(ai_service=None)
        result = await checker.quick_scan(SAMPLE_CONTENT)
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_outline_law_quick_scan(self):
        checker = OutlineLawEnforcer(ai_service=None)
        result = await checker.quick_scan(SAMPLE_CONTENT)
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_setting_physics_quick_scan(self):
        checker = SettingPhysicsEnforcer(ai_service=None)
        result = await checker.quick_scan(SAMPLE_CONTENT)
        assert isinstance(result, CheckerResult)
        assert 0 <= result.score <= 100


class TestCheckerProperties:
    """Verify checker metadata is set correctly."""

    def test_all_checkers_have_name(self):
        checkers = [
            ConsistencyChecker(None), ContinuityChecker(None),
            PacingChecker(None), OOCChecker(None),
            HighPointChecker(None), ReaderPullChecker(None),
            OutlineLawEnforcer(None), SettingPhysicsEnforcer(None),
        ]
        for checker in checkers:
            assert checker.name, f"{checker.__class__.__name__} has no name"
            assert checker.description, f"{checker.__class__.__name__} has no description"

    def test_checker_names_unique(self):
        checkers = [
            ConsistencyChecker(None), ContinuityChecker(None),
            PacingChecker(None), OOCChecker(None),
            HighPointChecker(None), ReaderPullChecker(None),
            OutlineLawEnforcer(None), SettingPhysicsEnforcer(None),
        ]
        names = [c.name for c in checkers]
        assert len(names) == len(set(names)), f"Duplicate checker names: {names}"
