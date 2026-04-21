"""Core workflow definitions for the Auto Novel Writer agent system.

This module defines three core workflows as configuration data:
- initialization_workflow: Collect world/character settings via chat
- writing_workflow: Generate and review chapter content
- review_workflow: Quality check with parallel checker agents

Each workflow is a list of StageConfig objects consumed by AgentOrchestrator.
"""

from .orchestrator import StageConfig

# ---------------------------------------------------------------------------
# Workflow 1: Initialization (Chat -> Context -> Data)
# ---------------------------------------------------------------------------
# Used during Interface 1 (Chat Initialization) to collect story settings
# through AI-driven conversation, then structure the extracted information.

INITIALIZATION_WORKFLOW = [
    StageConfig(
        name="chat_collection",
        agents=["chat_agent"],
        mode="sequential",
        description="AI actively asks questions to collect world/character/plot settings",
    ),
    StageConfig(
        name="context_synthesis",
        agents=["context_agent"],
        mode="sequential",
        depends_on=["chat_collection"],
        description="Synthesize collected settings into structured context packages",
    ),
    StageConfig(
        name="data_extraction",
        agents=["data_agent"],
        mode="sequential",
        depends_on=["context_synthesis"],
        description="Extract and persist structured entities from the synthesized context",
    ),
]

# ---------------------------------------------------------------------------
# Workflow 2: Writing (Context -> Plot -> Style -> Review)
# ---------------------------------------------------------------------------
# Used during Interface 3 (Writing Editor) to generate chapter content
# with full context, plot guidance, style application, and quality review.

WRITING_WORKFLOW = [
    StageConfig(
        name="context_building",
        agents=["context_agent"],
        mode="sequential",
        description="Build writing execution package for the target chapter",
    ),
    StageConfig(
        name="plot_planning",
        agents=["plot_agent"],
        mode="sequential",
        depends_on=["context_building"],
        description="Generate plot beats and scene structure based on context",
    ),
    StageConfig(
        name="style_application",
        agents=["style_agent"],
        mode="sequential",
        depends_on=["plot_planning"],
        description="Apply writing style guidance to the plot structure",
    ),
    StageConfig(
        name="quality_review",
        agents=["review_agent"],
        mode="sequential",
        depends_on=["style_application"],
        description="Review generated content for consistency and quality",
    ),
]

# ---------------------------------------------------------------------------
# Workflow 3: Review (Review + CheckerPipeline in parallel)
# ---------------------------------------------------------------------------
# Used for focused quality inspection. The review agent runs alongside
# multiple checker agents in parallel for comprehensive analysis.

REVIEW_WORKFLOW = [
    StageConfig(
        name="comprehensive_review",
        agents=["review_agent", "consistency_checker", "style_checker", "plot_checker"],
        mode="parallel",
        description="Run review agent and multiple checkers in parallel for quality assessment",
    ),
]

# ---------------------------------------------------------------------------
# Workflow registry for easy lookup
# ---------------------------------------------------------------------------

WORKFLOW_REGISTRY = {
    "initialization": INITIALIZATION_WORKFLOW,
    "writing": WRITING_WORKFLOW,
    "review": REVIEW_WORKFLOW,
}


def get_workflow_config(name: str) -> list[StageConfig]:
    """Get a workflow configuration by name.

    Args:
        name: Workflow identifier ("initialization", "writing", "review")

    Returns:
        List of StageConfig objects defining the workflow

    Raises:
        KeyError: If workflow name is not recognized
    """
    if name not in WORKFLOW_REGISTRY:
        raise KeyError(
            f"Unknown workflow '{name}'. Available: {list(WORKFLOW_REGISTRY.keys())}"
        )
    return WORKFLOW_REGISTRY[name]


def list_workflow_names() -> list[str]:
    """List all available workflow names.

    Returns:
        List of workflow identifier strings
    """
    return list(WORKFLOW_REGISTRY.keys())
