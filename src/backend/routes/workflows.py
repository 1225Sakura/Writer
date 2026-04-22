# Proxy module - routes.workflows now lives at backend.api.v1.endpoints.workflows
from backend.api.v1.endpoints.workflows import (
    router,
    set_orchestrator,
    get_orchestrator,
    ExecuteWorkflowRequest,
    ExecuteWorkflowResponse,
    WorkflowStatusResponse,
    WorkflowListResponse,
    ExecutionSummary,
    ExecutionListResponse,
    AgentLogEntry,
    ExecutionLogsResponse,
)
from backend.api.v1.endpoints.workflows import *
