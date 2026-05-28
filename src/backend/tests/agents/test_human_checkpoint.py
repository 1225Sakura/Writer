"""Tests for HumanCheckpoint in AgentOrchestrator."""

from __future__ import annotations

import asyncio

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock

from backend.agents.base import AgentContext, AgentResult, BaseAgent
from backend.agents.orchestrator import (
    AgentOrchestrator,
    HumanCheckpoint,
    StageConfig,
    WORKFLOW_CHECKPOINT_REACHED,
    WORKFLOW_CHECKPOINT_RESOLVED,
)
from backend.utils.event_bus import AsyncEventBus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class StubAgent(BaseAgent):
    """Minimal agent for testing."""

    def __init__(self) -> None:
        super().__init__(provider=MagicMock(), event_bus=AsyncMock())

    async def execute(self, context: AgentContext) -> AgentResult:
        return AgentResult(content="done", confidence=1.0)


def _make_orchestrator() -> tuple[AgentOrchestrator, AsyncEventBus]:
    bus = AsyncEventBus()
    orch = AgentOrchestrator(event_bus=bus, agent_timeout=5.0)
    return orch, bus


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestHumanCheckpointDataclass:
    """Test HumanCheckpoint dataclass construction."""

    def test_create_checkpoint(self):
        """HumanCheckpoint stores all fields correctly."""
        cp = HumanCheckpoint(
            stage_name="review",
            prompt="Approve the draft?",
            auto_approve_timeout=30,
        )
        assert cp.stage_name == "review"
        assert cp.prompt == "Approve the draft?"
        assert cp.auto_approve_timeout == 30

    def test_checkpoint_no_timeout(self):
        """HumanCheckpoint defaults auto_approve_timeout to None."""
        cp = HumanCheckpoint(stage_name="gate", prompt="Continue?")
        assert cp.auto_approve_timeout is None


class TestCheckpointEventEmission:
    """Test that checkpoints emit the correct events."""

    @pytest.mark.asyncio
    async def test_checkpoint_emits_reached_event(self):
        """_wait_for_checkpoint publishes workflow.checkpoint.reached."""
        orch, bus = _make_orchestrator()

        received_events: list[dict] = []

        async def capture(payload: dict) -> None:
            received_events.append(payload)

        bus.subscribe(WORKFLOW_CHECKPOINT_REACHED, capture)

        cp = HumanCheckpoint(
            stage_name="review",
            prompt="Approve?",
            auto_approve_timeout=1,  # auto-approve after 1s
        )

        approved = await orch._wait_for_checkpoint(
            cp, context={"execution_id": "test_123"}
        )

        assert approved is True
        assert len(received_events) == 1
        assert received_events[0]["stage"] == "review"
        assert received_events[0]["prompt"] == "Approve?"

    @pytest.mark.asyncio
    async def test_checkpoint_emits_resolved_event(self):
        """_wait_for_checkpoint publishes workflow.checkpoint.resolved after approval."""
        orch, bus = _make_orchestrator()

        resolved_events: list[dict] = []
        bus.subscribe(
            WORKFLOW_CHECKPOINT_RESOLVED,
            lambda payload: resolved_events.append(payload),
        )

        cp = HumanCheckpoint(stage_name="gate", prompt="Go?", auto_approve_timeout=1)
        await orch._wait_for_checkpoint(cp, context={"execution_id": "e1"})

        assert len(resolved_events) == 1
        assert resolved_events[0]["approved"] is True
        assert resolved_events[0]["stage"] == "gate"


class TestCheckpointAutoApprove:
    """Test auto-approve timeout behavior."""

    @pytest.mark.asyncio
    async def test_auto_approve_after_timeout(self):
        """Checkpoint auto-approves when timeout expires."""
        orch, _ = _make_orchestrator()

        cp = HumanCheckpoint(
            stage_name="slow_gate",
            prompt="Waiting...",
            auto_approve_timeout=1,  # 1 second
        )

        approved = await orch._wait_for_checkpoint(
            cp, context={"execution_id": "auto_test"}
        )
        assert approved is True


class TestCheckpointManualResolve:
    """Test manual checkpoint resolution via resolve_checkpoint."""

    @pytest.mark.asyncio
    async def test_resolve_checkpoint_approve(self):
        """resolve_checkpoint with approved=True resolves the future."""
        orch, _ = _make_orchestrator()

        cp = HumanCheckpoint(stage_name="manual", prompt="Yes?")

        # Start checkpoint in background (no auto_approve, so it blocks)
        task = asyncio.create_task(
            orch._wait_for_checkpoint(cp, context={"execution_id": "m1"})
        )

        # Give the task time to set up the future
        await asyncio.sleep(0.05)

        # Find the checkpoint_id
        checkpoint_id = "m1_manual"
        resolved = await orch.resolve_checkpoint(checkpoint_id, approved=True)
        assert resolved is True

        approved = await task
        assert approved is True

    @pytest.mark.asyncio
    async def test_resolve_checkpoint_reject(self):
        """resolve_checkpoint with approved=False returns False from checkpoint."""
        orch, _ = _make_orchestrator()

        cp = HumanCheckpoint(stage_name="gate", prompt="Proceed?")

        task = asyncio.create_task(
            orch._wait_for_checkpoint(cp, context={"execution_id": "m2"})
        )
        await asyncio.sleep(0.05)

        checkpoint_id = "m2_gate"
        resolved = await orch.resolve_checkpoint(checkpoint_id, approved=False)
        assert resolved is True

        approved = await task
        assert approved is False

    @pytest.mark.asyncio
    async def test_resolve_nonexistent_checkpoint(self):
        """resolve_checkpoint returns False for unknown checkpoint_id."""
        orch, _ = _make_orchestrator()
        result = await orch.resolve_checkpoint("nonexistent_id", approved=True)
        assert result is False

    @pytest.mark.asyncio
    async def test_resolve_already_resolved_checkpoint(self):
        """resolve_checkpoint returns False if already resolved."""
        orch, _ = _make_orchestrator()

        cp = HumanCheckpoint(stage_name="dup", prompt="?")
        task = asyncio.create_task(
            orch._wait_for_checkpoint(cp, context={"execution_id": "d1"})
        )
        await asyncio.sleep(0.05)

        cid = "d1_dup"
        await orch.resolve_checkpoint(cid, approved=True)
        await task

        # Second resolve should return False
        result = await orch.resolve_checkpoint(cid, approved=True)
        assert result is False
