"""AgentOrchestrator - Workflow orchestration for AI agent execution.

Provides workflow registration, execution with parallel/sequential stages,
state management, and event bus integration.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.event_bus import AsyncEventBus
from ..utils.exceptions import (
    AgentError,
    AgentTimeoutError,
    AIServiceError,
    CheckerAnalysisError,
    DatabaseError,
)
from .base import AgentContext, AgentResult, BaseAgent, CheckerFeedback

# Optional workflow persistence service
try:
    from backend.services.workflow_service import WorkflowExecutionService
except ImportError:
    WorkflowExecutionService = None  # type: ignore[misc, assignment]

# Optional checker pipeline for checker-agent integration
try:
    from .checkers.pipeline import CheckerPipeline
except ImportError:
    CheckerPipeline = None  # type: ignore[misc, assignment]

logger = logging.getLogger(__name__)

# Event type constants
WORKFLOW_STARTED = "workflow.started"
STAGE_COMPLETED = "workflow.stage.completed"
AGENT_EXECUTED = "workflow.agent.executed"
WORKFLOW_COMPLETED = "workflow.completed"
WORKFLOW_FAILED = "workflow.failed"


class WorkflowStatus(str, Enum):
    """Workflow execution status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AgentExecutionStatus(str, Enum):
    """Agent execution status within a workflow."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class StageConfig:
    """Configuration for a workflow stage.

    Attributes:
        name: Unique stage identifier
        agents: List of agent names to execute in this stage
        mode: Execution mode - "parallel" or "sequential"
        depends_on: Optional list of stage names this stage depends on
    """

    name: str
    agents: list[str]
    mode: str = "sequential"  # "parallel" or "sequential"
    depends_on: list[str] = field(default_factory=list)
    description: str = ""

    def __post_init__(self) -> None:
        if self.mode not in ("parallel", "sequential"):
            raise ValueError(f"mode must be 'parallel' or 'sequential', got '{self.mode}'")


@dataclass
class WorkflowConfig:
    """Configuration for a complete workflow.

    Attributes:
        name: Unique workflow identifier
        stages: Ordered list of stage configurations
        description: Optional workflow description
    """

    name: str
    stages: list[StageConfig]
    description: str = ""


@dataclass
class AgentTimingRecord:
    """Timing record for a single agent execution.

    Attributes:
        agent_name: Name of the agent
        stage_name: Name of the stage
        started_at: ISO timestamp when execution started
        completed_at: ISO timestamp when execution completed
        duration_ms: Execution duration in milliseconds
        status: Execution status (completed/failed)
        error: Error message if execution failed
    """

    agent_name: str
    stage_name: str
    started_at: str = ""
    completed_at: str = ""
    duration_ms: float = 0.0
    status: str = ""
    error: Optional[str] = None


@dataclass
class WorkflowContext:
    """Runtime context for workflow execution.

    Attributes:
        execution_id: Unique execution identifier
        workflow_name: Name of the workflow being executed
        input_data: Initial input data for the workflow
        stage_results: Accumulated results from completed stages
        metadata: Additional execution metadata
        agent_timings: Per-agent execution timing records
        error_history: History of errors encountered during execution
        cancelled: Flag indicating whether the workflow has been cancelled
    """

    execution_id: str
    workflow_name: str
    input_data: dict[str, Any] = field(default_factory=dict)
    stage_results: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    agent_timings: list[AgentTimingRecord] = field(default_factory=list)
    error_history: list[dict[str, Any]] = field(default_factory=list)
    cancelled: bool = False


# ------------------------------------------------------------------
# Conditional Edge & Human Checkpoint (Phase 4)
# ------------------------------------------------------------------

@dataclass
class ConditionalEdge:
    """Route to different next-stages based on agent output.

    Attributes:
        source_agent: The agent whose output is evaluated.
        condition: Callable that receives the agent result and returns bool.
        true_target: Stage to run if condition is met.
        false_target: Stage to run if condition is not met.
    """

    source_agent: str
    condition: Callable[[Any], bool]
    true_target: str
    false_target: str


@dataclass
class HumanCheckpoint:
    """Pause workflow for human approval before proceeding.

    Attributes:
        stage_name: The stage after which the checkpoint is triggered.
        prompt: Message shown to the user for approval.
        auto_approve_timeout: Seconds to wait before auto-approving.
            None means wait forever.
    """

    stage_name: str
    prompt: str
    auto_approve_timeout: Optional[int] = None


# Event constant for checkpoint events
WORKFLOW_CHECKPOINT_REACHED = "workflow.checkpoint.reached"
WORKFLOW_CHECKPOINT_RESOLVED = "workflow.checkpoint.resolved"


class AgentOrchestrator:
    """Orchestrates multi-agent workflow execution.

    Supports:
    - Workflow registration with stage-based configuration
    - Parallel and sequential stage execution
    - DAG-based dependency resolution with topological sorting
    - Workflow state management and persistence
    - Event bus integration for decoupled monitoring
    """

    def __init__(
        self,
        event_bus: AsyncEventBus,
        workflow_service: Optional[Any] = None,
        checker_pipeline: Optional[Any] = None,
        checker_threshold: float = 70.0,
        max_checker_retries: int = 2,
        agent_timeout: float = 120.0,
    ) -> None:
        """Initialize the orchestrator.

        Args:
            event_bus: Async event bus for publishing workflow events
            workflow_service: Optional WorkflowExecutionService for persistence
            checker_pipeline: Optional CheckerPipeline for post-execution quality checks
            checker_threshold: Minimum overall_score to pass (default 70)
            max_checker_retries: Max re-execution attempts when score < threshold (default 2)
            agent_timeout: Default per-agent timeout in seconds (default 120)
        """
        self._event_bus = event_bus
        self._workflow_service = workflow_service
        self._checker_pipeline = checker_pipeline
        self._checker_threshold = checker_threshold
        self._max_checker_retries = max_checker_retries
        self._agent_timeout = agent_timeout
        self._workflows: dict[str, WorkflowConfig] = {}
        self._agent_registry: dict[str, BaseAgent] = {}
        self._executions: dict[str, WorkflowContext] = {}
        self._execution_status: dict[str, WorkflowStatus] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register_workflow(self, name: str, stages: list[StageConfig], description: str = "") -> None:
        """Register a workflow configuration.

        Args:
            name: Unique workflow identifier
            stages: List of stage configurations defining the workflow
            description: Optional workflow description

        Raises:
            ValueError: If workflow name already registered or stages invalid
        """
        if name in self._workflows:
            raise ValueError(f"Workflow '{name}' is already registered")

        if not stages:
            raise ValueError("Workflow must have at least one stage")

        # Validate stage dependencies exist
        stage_names = {s.name for s in stages}
        for stage in stages:
            for dep in stage.depends_on:
                if dep not in stage_names:
                    raise ValueError(
                        f"Stage '{stage.name}' depends on unknown stage '{dep}'"
                    )

        self._workflows[name] = WorkflowConfig(
            name=name, stages=stages, description=description
        )
        logger.info("Registered workflow '%s' with %d stages", name, len(stages))

    def unregister_workflow(self, name: str) -> bool:
        """Remove a registered workflow.

        Args:
            name: Workflow name to unregister

        Returns:
            True if removed, False if not found
        """
        if name in self._workflows:
            del self._workflows[name]
            logger.info("Unregistered workflow '%s'", name)
            return True
        return False

    def register_agent(self, name: str, agent: BaseAgent) -> None:
        """Register an agent instance for workflow execution.

        Args:
            name: Unique agent identifier
            agent: BaseAgent instance

        Raises:
            ValueError: If agent name already registered
        """
        if name in self._agent_registry:
            raise ValueError(f"Agent '{name}' is already registered")
        self._agent_registry[name] = agent
        logger.info("Registered agent '%s' (%s)", name, type(agent).__name__)

    def get_workflow(self, name: str) -> Optional[WorkflowConfig]:
        """Get a registered workflow configuration.

        Args:
            name: Workflow name

        Returns:
            WorkflowConfig or None if not found
        """
        return self._workflows.get(name)

    def list_workflows(self) -> list[dict[str, Any]]:
        """List all registered workflows.

        Returns:
            List of workflow metadata dicts
        """
        return [
            {
                "name": wf.name,
                "description": wf.description,
                "stage_count": len(wf.stages),
                "stages": [
                    {
                        "name": s.name,
                        "agents": s.agents,
                        "mode": s.mode,
                        "depends_on": s.depends_on,
                    }
                    for s in wf.stages
                ],
            }
            for wf in self._workflows.values()
        ]

    # ------------------------------------------------------------------
    # Cancellation
    # ------------------------------------------------------------------

    async def cancel_execution(self, execution_id: str) -> bool:
        """Request cancellation of a running workflow execution.

        Sets the cancelled flag on the WorkflowContext. The orchestrator
        checks this flag between stage/agent executions and will stop
        gracefully when it is set.

        Args:
            execution_id: The execution to cancel.

        Returns:
            True if the execution was found and marked for cancellation.
        """
        async with self._lock:
            wf_context = self._executions.get(execution_id)
            if wf_context is None:
                return False
            wf_context.cancelled = True
            self._execution_status[execution_id] = WorkflowStatus.CANCELLED
        logger.info("Cancellation requested for execution '%s'", execution_id)
        return True

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------

    async def execute_workflow(
        self,
        name: str,
        context: dict[str, Any],
        db: Optional[AsyncSession] = None,
    ) -> dict[str, Any]:
        """Execute a registered workflow.

        Args:
            name: Workflow name to execute
            context: Input data for the workflow
            db: Optional database session for persistence

        Returns:
            Execution results dict

        Raises:
            ValueError: If workflow not found
        """
        workflow = self._workflows.get(name)
        if not workflow:
            raise ValueError(f"Workflow '{name}' not found")

        execution_id = f"{name}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S_%f')}"
        wf_context = WorkflowContext(
            execution_id=execution_id,
            workflow_name=name,
            input_data=context,
        )

        async with self._lock:
            self._executions[execution_id] = wf_context
            self._execution_status[execution_id] = WorkflowStatus.RUNNING

        # Optional: persist workflow execution start
        db_execution = None
        if self._workflow_service is not None:
            try:
                db_execution = await self._workflow_service.create_execution(name)
            except DatabaseError as persist_exc:
                logger.warning("Failed to persist workflow start: %s", persist_exc)

        logger.info("Starting workflow '%s' (execution_id=%s)", name, execution_id)

        # Publish workflow started event
        await self._event_bus.publish(
            WORKFLOW_STARTED,
            {
                "execution_id": execution_id,
                "workflow_name": name,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        try:
            # Build DAG and execute stages in topological order
            stage_order = self._topological_sort(workflow.stages)
            completed_stages: set[str] = set()

            for stage in stage_order:
                # Check cancellation between stages
                if wf_context.cancelled:
                    logger.info(
                        "Workflow '%s' cancelled before stage '%s'",
                        name,
                        stage.name,
                    )
                    return {
                        "execution_id": execution_id,
                        "workflow_name": name,
                        "status": WorkflowStatus.CANCELLED.value,
                        "stage_results": wf_context.stage_results,
                    }

                # Wait for dependencies
                for dep in stage.depends_on:
                    if dep not in completed_stages:
                        raise ValueError(
                            f"Dependency '{dep}' not completed for stage '{stage.name}'"
                        )

                # Execute stage
                stage_result = await self._execute_stage(
                    workflow_name=name,
                    stage=stage,
                    wf_context=wf_context,
                    db=db,
                    db_execution_id=db_execution.id if db_execution else None,
                )

                wf_context.stage_results[stage.name] = stage_result
                completed_stages.add(stage.name)

                # Publish stage completed event
                await self._event_bus.publish(
                    STAGE_COMPLETED,
                    {
                        "execution_id": execution_id,
                        "workflow_name": name,
                        "stage_name": stage.name,
                        "status": "completed",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

            # Mark completed
            async with self._lock:
                self._execution_status[execution_id] = WorkflowStatus.COMPLETED

            # Persist completion
            if db_execution is not None and self._workflow_service is not None:
                try:
                    await self._workflow_service.complete_execution(
                        db_execution.id,
                        results=wf_context.stage_results,
                    )
                except DatabaseError as persist_exc:
                    logger.warning("Failed to persist workflow completion: %s", persist_exc)

            # Publish workflow completed event
            await self._event_bus.publish(
                WORKFLOW_COMPLETED,
                {
                    "execution_id": execution_id,
                    "workflow_name": name,
                    "results": wf_context.stage_results,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

            logger.info("Workflow '%s' completed (execution_id=%s)", name, execution_id)

            return {
                "execution_id": execution_id,
                "workflow_name": name,
                "status": WorkflowStatus.COMPLETED.value,
                "stage_results": wf_context.stage_results,
            }

        except (AgentError, DatabaseError, AIServiceError) as exc:
            logger.exception("Workflow '%s' failed (execution_id=%s)", name, execution_id)

            async with self._lock:
                self._execution_status[execution_id] = WorkflowStatus.FAILED

            # Persist failure
            if db_execution is not None and self._workflow_service is not None:
                try:
                    await self._workflow_service.complete_execution(
                        db_execution.id,
                        results=wf_context.stage_results,
                        error=str(exc),
                    )
                except DatabaseError as persist_exc:
                    logger.warning("Failed to persist workflow failure: %s", persist_exc)

            # Publish workflow failed event
            await self._event_bus.publish(
                WORKFLOW_FAILED,
                {
                    "execution_id": execution_id,
                    "workflow_name": name,
                    "error": str(exc),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            )

            return {
                "execution_id": execution_id,
                "workflow_name": name,
                "status": WorkflowStatus.FAILED.value,
                "error": str(exc),
                "stage_results": wf_context.stage_results,
            }

    async def _execute_stage(
        self,
        workflow_name: str,
        stage: StageConfig,
        wf_context: WorkflowContext,
        db: Optional[AsyncSession] = None,
        db_execution_id: Optional[int] = None,
    ) -> dict[str, Any]:
        """Execute a single workflow stage.

        Args:
            workflow_name: Parent workflow name
            stage: Stage configuration
            wf_context: Workflow execution context
            db: Optional database session

        Returns:
            Stage execution results
        """
        execution_id = wf_context.execution_id
        logger.info(
            "Executing stage '%s' (mode=%s, agents=%s)",
            stage.name,
            stage.mode,
            stage.agents,
        )

        # Validate all agents are registered before executing (fail-fast)
        for agent_name in stage.agents:
            if agent_name not in self._agent_registry:
                raise ValueError(f"Agent '{agent_name}' not registered")

        agent_results: dict[str, Any] = {}

        if stage.mode == "parallel":
            # Execute all agents concurrently
            tasks = [
                self._execute_agent(
                    workflow_name=workflow_name,
                    stage_name=stage.name,
                    agent_name=agent_name,
                    wf_context=wf_context,
                    db=db,
                    db_execution_id=db_execution_id,
                )
                for agent_name in stage.agents
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for agent_name, result in zip(stage.agents, results):
                if isinstance(result, Exception):
                    agent_results[agent_name] = {
                        "status": AgentExecutionStatus.FAILED.value,
                        "error": str(result),
                    }
                    logger.warning(
                        "Agent '%s' in stage '%s' failed: %s",
                        agent_name,
                        stage.name,
                        result,
                    )
                else:
                    agent_results[agent_name] = result

        else:
            # Execute agents sequentially
            for agent_name in stage.agents:
                # Check cancellation between sequential agent executions
                if wf_context.cancelled:
                    logger.info(
                        "Stage '%s' cancelled before agent '%s'",
                        stage.name,
                        agent_name,
                    )
                    agent_results[agent_name] = {
                        "status": AgentExecutionStatus.SKIPPED.value,
                        "error": "Workflow cancelled",
                    }
                    continue

                try:
                    result = await self._execute_agent(
                        workflow_name=workflow_name,
                        stage_name=stage.name,
                        agent_name=agent_name,
                        wf_context=wf_context,
                        db=db,
                        db_execution_id=db_execution_id,
                    )
                    agent_results[agent_name] = result
                except (AgentError, DatabaseError, AIServiceError) as exc:
                    agent_results[agent_name] = {
                        "status": AgentExecutionStatus.FAILED.value,
                        "error": str(exc),
                    }
                    logger.warning(
                        "Agent '%s' in stage '%s' failed: %s",
                        agent_name,
                        stage.name,
                        exc,
                    )
                    # In sequential mode, continue with next agent even if one fails

        return {
            "stage_name": stage.name,
            "mode": stage.mode,
            "agent_results": agent_results,
        }

    async def _execute_agent(
        self,
        workflow_name: str,
        stage_name: str,
        agent_name: str,
        wf_context: WorkflowContext,
        db: Optional[AsyncSession] = None,
        db_execution_id: Optional[int] = None,
    ) -> dict[str, Any]:
        """Execute a single agent within a workflow stage.

        Uses execute_with_hooks (lifecycle hooks) and optionally runs the
        checker pipeline after execution. If the checker overall_score falls
        below the configured threshold, the agent is re-executed with checker
        feedback injected into AgentContext.checker_results (up to max retries).

        Enforces a per-agent timeout via asyncio.wait_for. Tracks execution
        timing and records errors in the WorkflowContext.

        Args:
            workflow_name: Parent workflow name
            stage_name: Current stage name
            agent_name: Agent to execute
            wf_context: Workflow execution context
            db: Optional database session
            db_execution_id: Optional persisted workflow execution ID for logging

        Returns:
            Agent execution result dict

        Raises:
            AgentTimeoutError: If the agent exceeds the configured timeout
            AgentError: If the agent execution fails
        """
        agent = self._agent_registry.get(agent_name)
        if not agent:
            raise AgentError(
                message=f"Agent '{agent_name}' not registered",
                agent_name=agent_name,
            )

        # Build agent context from workflow context
        agent_context = self._build_agent_context(wf_context, workflow_name, stage_name)

        started_at = datetime.now(timezone.utc)
        monotonic_start = time.monotonic()

        try:
            # Use execute_with_hooks for lifecycle hook support (US-021)
            result: AgentResult = await asyncio.wait_for(
                agent.execute_with_hooks(agent_context),
                timeout=self._agent_timeout,
            )

            # Checker-Agent Integration (US-020)
            result = await self._run_checker_feedback_loop(
                agent=agent,
                agent_context=agent_context,
                result=result,
                workflow_name=workflow_name,
                stage_name=stage_name,
                agent_name=agent_name,
                wf_context=wf_context,
            )

            completed_at = datetime.now(timezone.utc)
            duration_ms = (time.monotonic() - monotonic_start) * 1000

            # Record timing
            timing = AgentTimingRecord(
                agent_name=agent_name,
                stage_name=stage_name,
                started_at=started_at.isoformat(),
                completed_at=completed_at.isoformat(),
                duration_ms=duration_ms,
                status=AgentExecutionStatus.COMPLETED.value,
            )
            wf_context.agent_timings.append(timing)

            result_dict = {
                "status": AgentExecutionStatus.COMPLETED.value,
                "content": result.content if hasattr(result, "content") else str(result),
                "confidence": result.confidence if hasattr(result, "confidence") else 0.0,
                "metadata": result.metadata if hasattr(result, "metadata") else {},
                "warnings": result.warnings if hasattr(result, "warnings") else [],
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
                "duration_ms": duration_ms,
            }

            # Persist agent execution log
            if db_execution_id is not None and self._workflow_service is not None:
                try:
                    await self._workflow_service.log_agent_execution(
                        workflow_execution_id=db_execution_id,
                        agent_name=agent_name,
                        stage_name=stage_name,
                        result=result_dict,
                    )
                except DatabaseError as persist_exc:
                    logger.warning("Failed to persist agent execution log: %s", persist_exc)

            # Publish agent executed event
            await self._event_bus.publish(
                AGENT_EXECUTED,
                {
                    "execution_id": wf_context.execution_id,
                    "workflow_name": workflow_name,
                    "stage_name": stage_name,
                    "agent_name": agent_name,
                    "status": AgentExecutionStatus.COMPLETED.value,
                    "timestamp": completed_at.isoformat(),
                },
            )

            return result_dict

        except asyncio.TimeoutError:
            completed_at = datetime.now(timezone.utc)
            duration_ms = (time.monotonic() - monotonic_start) * 1000

            timeout_exc = AgentTimeoutError(
                message=f"Agent '{agent_name}' timed out after {self._agent_timeout}s",
                agent_name=agent_name,
            )

            # Record timing and error
            timing = AgentTimingRecord(
                agent_name=agent_name,
                stage_name=stage_name,
                started_at=started_at.isoformat(),
                completed_at=completed_at.isoformat(),
                duration_ms=duration_ms,
                status=AgentExecutionStatus.FAILED.value,
                error=str(timeout_exc),
            )
            wf_context.agent_timings.append(timing)
            wf_context.error_history.append({
                "agent_name": agent_name,
                "stage_name": stage_name,
                "error_type": "AgentTimeoutError",
                "message": str(timeout_exc),
                "timestamp": completed_at.isoformat(),
            })

            # Persist failed agent execution log
            if db_execution_id is not None and self._workflow_service is not None:
                try:
                    await self._workflow_service.log_agent_execution(
                        workflow_execution_id=db_execution_id,
                        agent_name=agent_name,
                        stage_name=stage_name,
                        result={
                            "status": AgentExecutionStatus.FAILED.value,
                            "error": str(timeout_exc),
                            "started_at": started_at.isoformat(),
                            "completed_at": completed_at.isoformat(),
                        },
                    )
                except DatabaseError as persist_exc:
                    logger.warning("Failed to persist agent execution log: %s", persist_exc)

            # Publish agent failed event
            await self._event_bus.publish(
                AGENT_EXECUTED,
                {
                    "execution_id": wf_context.execution_id,
                    "workflow_name": workflow_name,
                    "stage_name": stage_name,
                    "agent_name": agent_name,
                    "status": AgentExecutionStatus.FAILED.value,
                    "error": str(timeout_exc),
                    "timestamp": completed_at.isoformat(),
                },
            )

            raise timeout_exc from None

        except asyncio.CancelledError:
            completed_at = datetime.now(timezone.utc)
            duration_ms = (time.monotonic() - monotonic_start) * 1000

            cancel_exc = AgentError(
                message=f"Agent '{agent_name}' execution was cancelled",
                agent_name=agent_name,
            )

            # Record timing and error
            timing = AgentTimingRecord(
                agent_name=agent_name,
                stage_name=stage_name,
                started_at=started_at.isoformat(),
                completed_at=completed_at.isoformat(),
                duration_ms=duration_ms,
                status=AgentExecutionStatus.FAILED.value,
                error=str(cancel_exc),
            )
            wf_context.agent_timings.append(timing)
            wf_context.error_history.append({
                "agent_name": agent_name,
                "stage_name": stage_name,
                "error_type": "CancelledError",
                "message": str(cancel_exc),
                "timestamp": completed_at.isoformat(),
            })

            raise cancel_exc from None

        except (AgentError, AIServiceError) as exc:
            completed_at = datetime.now(timezone.utc)
            duration_ms = (time.monotonic() - monotonic_start) * 1000

            # Record timing and error
            timing = AgentTimingRecord(
                agent_name=agent_name,
                stage_name=stage_name,
                started_at=started_at.isoformat(),
                completed_at=completed_at.isoformat(),
                duration_ms=duration_ms,
                status=AgentExecutionStatus.FAILED.value,
                error=str(exc),
            )
            wf_context.agent_timings.append(timing)
            wf_context.error_history.append({
                "agent_name": agent_name,
                "stage_name": stage_name,
                "error_type": type(exc).__name__,
                "message": str(exc),
                "timestamp": completed_at.isoformat(),
            })

            # Persist failed agent execution log
            if db_execution_id is not None and self._workflow_service is not None:
                try:
                    await self._workflow_service.log_agent_execution(
                        workflow_execution_id=db_execution_id,
                        agent_name=agent_name,
                        stage_name=stage_name,
                        result={
                            "status": AgentExecutionStatus.FAILED.value,
                            "error": str(exc),
                            "started_at": started_at.isoformat(),
                            "completed_at": completed_at.isoformat(),
                        },
                    )
                except DatabaseError as persist_exc:
                    logger.warning("Failed to persist agent execution log: %s", persist_exc)

            # Publish agent failed event
            await self._event_bus.publish(
                AGENT_EXECUTED,
                {
                    "execution_id": wf_context.execution_id,
                    "workflow_name": workflow_name,
                    "stage_name": stage_name,
                    "agent_name": agent_name,
                    "status": AgentExecutionStatus.FAILED.value,
                    "error": str(exc),
                    "timestamp": completed_at.isoformat(),
                },
            )

            raise

    @staticmethod
    def _build_agent_context(
        wf_context: WorkflowContext,
        workflow_name: str,
        stage_name: str,
    ) -> AgentContext:
        """Build an AgentContext from workflow context data.

        Args:
            wf_context: The workflow execution context.
            workflow_name: Parent workflow name.
            stage_name: Current stage name.

        Returns:
            Populated AgentContext.
        """
        agent_context = AgentContext(
            task=wf_context.input_data.get("task", ""),
            settings=wf_context.input_data.get("settings", {}),
            history=wf_context.input_data.get("history", []),
            constraints=wf_context.input_data.get("constraints", []),
        )
        agent_context.settings["stage_results"] = wf_context.stage_results
        agent_context.settings["workflow_name"] = workflow_name
        agent_context.settings["stage_name"] = stage_name
        return agent_context

    async def _run_checker_feedback_loop(
        self,
        agent: BaseAgent,
        agent_context: AgentContext,
        result: AgentResult,
        workflow_name: str,
        stage_name: str,
        agent_name: str,
        wf_context: WorkflowContext,
    ) -> AgentResult:
        """Run checker pipeline and re-execute agent if score is below threshold.

        After each agent execution, runs the checker pipeline on the result
        content. If overall_score < threshold, re-calls the agent with
        checker feedback in AgentContext.checker_results. Skips re-call for
        checkers that failed with failure_mode == "analysis_failed".

        Args:
            agent: The agent that was executed.
            agent_context: The context used for execution.
            result: The agent's result.
            workflow_name: Parent workflow name.
            stage_name: Current stage name.
            agent_name: Agent name.
            wf_context: Workflow execution context.

        Returns:
            The final AgentResult (possibly from a re-execution).
        """
        if self._checker_pipeline is None:
            return result

        for attempt in range(self._max_checker_retries):
            # Extract text content for checking
            content = self._extract_checkable_content(result)
            if not content:
                return result

            # Run checker pipeline
            try:
                checker_results = await self._checker_pipeline.run_quick_scan(content)
                aggregated = self._checker_pipeline.aggregate_results(checker_results)
            except (CheckerAnalysisError, RuntimeError) as exc:
                logger.warning(
                    "Checker pipeline failed for agent '%s' (attempt %d), skipping feedback loop: %s",
                    agent_name,
                    attempt + 1,
                    exc,
                )
                return result

            overall_score = aggregated.get("overall_score", 100)

            if overall_score >= self._checker_threshold:
                logger.info(
                    "Agent '%s' passed checker threshold (%.1f >= %.1f)",
                    agent_name,
                    overall_score,
                    self._checker_threshold,
                )
                return result

            # Below threshold -- prepare feedback for re-execution
            failed_checkers = aggregated.get("failed_checkers", [])

            # Filter out issues from failed checkers (failure_mode == "analysis_failed")
            filtered_suggestions = [
                s for s in aggregated.get("all_suggestions", [])
                if not self._is_suggestion_from_failed_checker(s, failed_checkers)
            ]

            feedback = CheckerFeedback(
                overall_score=overall_score,
                issues=[
                    {"checker": name, "score": score}
                    for name, score in aggregated.get("checker_scores", {}).items()
                ],
                suggestions=filtered_suggestions,
                failed_checkers=failed_checkers,
            )

            logger.info(
                "Agent '%s' scored %.1f < %.1f threshold (attempt %d/%d), re-executing with feedback",
                agent_name,
                overall_score,
                self._checker_threshold,
                attempt + 1,
                self._max_checker_retries,
            )

            # Inject checker feedback into context and re-execute
            retry_context = self._build_agent_context(
                wf_context, workflow_name, stage_name
            )
            retry_context.checker_results = feedback.to_dict()
            # Preserve original constraints and add checker guidance
            retry_context.constraints = list(agent_context.constraints)
            retry_context.constraints.append(
                f"Previous attempt scored {overall_score:.0f}/100 on quality checks. "
                f"Issues: {', '.join(filtered_suggestions[:5])}"
            )

            result = await agent.execute_with_hooks(retry_context)

        return result

    @staticmethod
    def _extract_checkable_content(result: AgentResult) -> str:
        """Extract text content from an AgentResult for checker consumption.

        Args:
            result: The agent result.

        Returns:
            Text content suitable for checker pipeline, or empty string.
        """
        content = result.content
        if isinstance(content, str):
            return content
        if isinstance(content, dict):
            # Try common content keys
            for key in ("text", "content", "adjusted_text", "summary", "output"):
                if key in content and isinstance(content[key], str):
                    return content[key]
            return json.dumps(content, ensure_ascii=False)
        if isinstance(content, list):
            return json.dumps(content, ensure_ascii=False)
        return str(content) if content else ""

    @staticmethod
    def _is_suggestion_from_failed_checker(
        suggestion: str, failed_checkers: list[str]
    ) -> bool:
        """Check if a suggestion string references a failed checker.

        Args:
            suggestion: A suggestion string.
            failed_checkers: List of checker names that failed.

        Returns:
            True if the suggestion is from a failed checker.
        """
        if not failed_checkers:
            return False
        return any(name in suggestion for name in failed_checkers)

    # ------------------------------------------------------------------
    # Conditional Edges & Human Checkpoints (Phase 4)
    # ------------------------------------------------------------------

    async def _evaluate_conditional_edge(
        self, edge: ConditionalEdge, agent_result: Any
    ) -> str:
        """Evaluate a conditional edge against an agent result.

        Runs the edge's condition callable with the agent result and returns
        the appropriate target stage name.

        Args:
            edge: The conditional edge configuration.
            agent_result: The output from the source agent (dict or AgentResult).

        Returns:
            The target stage name (true_target or false_target).
        """
        try:
            condition_met = edge.condition(agent_result)
        except Exception as exc:
            logger.warning(
                "Conditional edge condition for agent '%s' raised %s, defaulting to false_target",
                edge.source_agent,
                exc,
            )
            condition_met = False

        target = edge.true_target if condition_met else edge.false_target
        logger.info(
            "Conditional edge: agent='%s' condition_met=%s -> '%s'",
            edge.source_agent,
            condition_met,
            target,
        )
        return target

    async def _wait_for_checkpoint(
        self,
        checkpoint: HumanCheckpoint,
        context: Dict[str, Any],
    ) -> bool:
        """Emit a checkpoint event and wait for human approval.

        Publishes a ``workflow.checkpoint.reached`` event on the event bus.
        If ``auto_approve_timeout`` is set, automatically approves after the
        timeout expires. Otherwise blocks until ``resolve_checkpoint`` is
        called externally (e.g. via an API endpoint).

        Args:
            checkpoint: The checkpoint configuration.
            context: Workflow context dict to include in the event payload.

        Returns:
            True if approved, False if rejected.
        """
        import asyncio

        checkpoint_id = f"{context.get('execution_id', 'unknown')}_{checkpoint.stage_name}"

        # Store checkpoint state for external resolution
        if not hasattr(self, "_pending_checkpoints"):
            self._pending_checkpoints: dict[str, asyncio.Future[bool]] = {}

        future: asyncio.Future[bool] = asyncio.get_event_loop().create_future()
        self._pending_checkpoints[checkpoint_id] = future

        # Emit event
        await self._event_bus.publish(
            WORKFLOW_CHECKPOINT_REACHED,
            {
                "checkpoint_id": checkpoint_id,
                "stage": checkpoint.stage_name,
                "prompt": checkpoint.prompt,
                "context": context,
                "auto_approve_timeout": checkpoint.auto_approve_timeout,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        logger.info(
            "Human checkpoint reached: stage='%s', prompt='%s'",
            checkpoint.stage_name,
            checkpoint.prompt,
        )

        try:
            if checkpoint.auto_approve_timeout is not None:
                approved = await asyncio.wait_for(
                    future, timeout=checkpoint.auto_approve_timeout
                )
            else:
                approved = await future
        except asyncio.TimeoutError:
            logger.info(
                "Human checkpoint '%s' auto-approved after %ds timeout",
                checkpoint.stage_name,
                checkpoint.auto_approve_timeout,
            )
            approved = True
        finally:
            self._pending_checkpoints.pop(checkpoint_id, None)

        # Emit resolution event
        await self._event_bus.publish(
            WORKFLOW_CHECKPOINT_RESOLVED,
            {
                "checkpoint_id": checkpoint_id,
                "stage": checkpoint.stage_name,
                "approved": approved,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        return approved

    async def resolve_checkpoint(self, checkpoint_id: str, approved: bool) -> bool:
        """Resolve a pending human checkpoint.

        Called externally (e.g. from an API endpoint) when the user responds
        to a checkpoint prompt.

        Args:
            checkpoint_id: The checkpoint identifier from the event payload.
            approved: Whether the user approved or rejected.

        Returns:
            True if the checkpoint was found and resolved, False otherwise.
        """
        if not hasattr(self, "_pending_checkpoints"):
            return False

        future = self._pending_checkpoints.get(checkpoint_id)
        if future is None or future.done():
            return False

        future.set_result(approved)
        logger.info(
            "Checkpoint '%s' resolved: approved=%s", checkpoint_id, approved
        )
        return True

    # ------------------------------------------------------------------
    # DAG / Topological Sort
    # ------------------------------------------------------------------

    @staticmethod
    def _topological_sort(stages: list[StageConfig]) -> list[StageConfig]:
        """Sort stages by dependency order using Kahn's algorithm.

        Args:
            stages: List of stage configurations

        Returns:
            Stages sorted in dependency order

        Raises:
            ValueError: If circular dependency detected
        """
        stage_map = {s.name: s for s in stages}
        in_degree: dict[str, int] = {s.name: 0 for s in stages}
        adjacency: dict[str, list[str]] = {s.name: [] for s in stages}

        for stage in stages:
            for dep in stage.depends_on:
                adjacency[dep].append(stage.name)
                in_degree[stage.name] += 1

        # Start with stages that have no dependencies
        queue = [name for name, deg in in_degree.items() if deg == 0]
        sorted_names: list[str] = []

        while queue:
            current = queue.pop(0)
            sorted_names.append(current)
            for neighbor in adjacency[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(sorted_names) != len(stages):
            raise ValueError("Circular dependency detected in workflow stages")

        return [stage_map[name] for name in sorted_names]

    # ------------------------------------------------------------------
    # Status / Query
    # ------------------------------------------------------------------

    def get_execution_status(self, execution_id: str) -> Optional[dict[str, Any]]:
        """Get the status of a workflow execution.

        Args:
            execution_id: Execution identifier

        Returns:
            Status dict or None if not found
        """
        wf_context = self._executions.get(execution_id)
        if not wf_context:
            return None

        status = self._execution_status.get(execution_id, WorkflowStatus.PENDING)

        return {
            "execution_id": execution_id,
            "workflow_name": wf_context.workflow_name,
            "status": status.value,
            "stage_results": wf_context.stage_results,
            "input_data": wf_context.input_data,
        }

    def list_executions(
        self, workflow_name: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """List workflow executions.

        Args:
            workflow_name: Optional filter by workflow name

        Returns:
            List of execution status dicts
        """
        results = []
        for eid, wf_context in self._executions.items():
            if workflow_name and wf_context.workflow_name != workflow_name:
                continue
            status = self._execution_status.get(eid, WorkflowStatus.PENDING)
            results.append({
                "execution_id": eid,
                "workflow_name": wf_context.workflow_name,
                "status": status.value,
                "stage_count": len(wf_context.stage_results),
            })
        return results
