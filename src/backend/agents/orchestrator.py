"""AgentOrchestrator - Workflow orchestration for AI agent execution.

Provides workflow registration, execution with parallel/sequential stages,
state management, and event bus integration.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.event_bus import AsyncEventBus
from .base import AgentContext, AgentResult, BaseAgent

# Optional workflow persistence service
try:
    from backend.services.workflow_service import WorkflowExecutionService
except ImportError:
    WorkflowExecutionService = None  # type: ignore[misc, assignment]

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
class WorkflowContext:
    """Runtime context for workflow execution.

    Attributes:
        execution_id: Unique execution identifier
        workflow_name: Name of the workflow being executed
        input_data: Initial input data for the workflow
        stage_results: Accumulated results from completed stages
        metadata: Additional execution metadata
    """

    execution_id: str
    workflow_name: str
    input_data: dict[str, Any] = field(default_factory=dict)
    stage_results: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)


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
    ) -> None:
        """Initialize the orchestrator.

        Args:
            event_bus: Async event bus for publishing workflow events
            workflow_service: Optional WorkflowExecutionService for persistence
        """
        self._event_bus = event_bus
        self._workflow_service = workflow_service
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

        execution_id = f"{name}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}"
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
            except Exception as persist_exc:
                logger.warning("Failed to persist workflow start: %s", persist_exc)

        logger.info("Starting workflow '%s' (execution_id=%s)", name, execution_id)

        # Publish workflow started event
        await self._event_bus.publish(
            WORKFLOW_STARTED,
            {
                "execution_id": execution_id,
                "workflow_name": name,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

        try:
            # Build DAG and execute stages in topological order
            stage_order = self._topological_sort(workflow.stages)
            completed_stages: set[str] = set()

            for stage in stage_order:
                # Wait for dependencies
                for dep in stage.depends_on:
                    if dep not in completed_stages:
                        raise RuntimeError(
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
                        "timestamp": datetime.utcnow().isoformat(),
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
                except Exception as persist_exc:
                    logger.warning("Failed to persist workflow completion: %s", persist_exc)

            # Publish workflow completed event
            await self._event_bus.publish(
                WORKFLOW_COMPLETED,
                {
                    "execution_id": execution_id,
                    "workflow_name": name,
                    "results": wf_context.stage_results,
                    "timestamp": datetime.utcnow().isoformat(),
                },
            )

            logger.info("Workflow '%s' completed (execution_id=%s)", name, execution_id)

            return {
                "execution_id": execution_id,
                "workflow_name": name,
                "status": WorkflowStatus.COMPLETED.value,
                "stage_results": wf_context.stage_results,
            }

        except Exception as exc:
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
                except Exception as persist_exc:
                    logger.warning("Failed to persist workflow failure: %s", persist_exc)

            # Publish workflow failed event
            await self._event_bus.publish(
                WORKFLOW_FAILED,
                {
                    "execution_id": execution_id,
                    "workflow_name": name,
                    "error": str(exc),
                    "timestamp": datetime.utcnow().isoformat(),
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
                except Exception as exc:
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

        Args:
            workflow_name: Parent workflow name
            stage_name: Current stage name
            agent_name: Agent to execute
            wf_context: Workflow execution context
            db: Optional database session
            db_execution_id: Optional persisted workflow execution ID for logging

        Returns:
            Agent execution result dict
        """
        agent = self._agent_registry.get(agent_name)
        if not agent:
            raise ValueError(f"Agent '{agent_name}' not registered")

        # Build agent context from workflow context
        agent_context = AgentContext(
            task=wf_context.input_data.get("task", ""),
            settings=wf_context.input_data.get("settings", {}),
            history=wf_context.input_data.get("history", []),
            constraints=wf_context.input_data.get("constraints", []),
        )

        # Merge stage results into settings for downstream agents
        agent_context.settings["stage_results"] = wf_context.stage_results
        agent_context.settings["workflow_name"] = workflow_name
        agent_context.settings["stage_name"] = stage_name

        started_at = datetime.utcnow()

        try:
            result: AgentResult = await agent.execute(agent_context)

            completed_at = datetime.utcnow()

            result_dict = {
                "status": AgentExecutionStatus.COMPLETED.value,
                "content": result.content if hasattr(result, "content") else str(result),
                "confidence": result.confidence if hasattr(result, "confidence") else 0.0,
                "metadata": result.metadata if hasattr(result, "metadata") else {},
                "warnings": result.warnings if hasattr(result, "warnings") else [],
                "started_at": started_at.isoformat(),
                "completed_at": completed_at.isoformat(),
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
                except Exception as persist_exc:
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

        except Exception as exc:
            completed_at = datetime.utcnow()

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
                except Exception as persist_exc:
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
