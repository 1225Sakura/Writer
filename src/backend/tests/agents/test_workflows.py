"""Tests for workflow configuration definitions.

Covers:
- Workflow registry: all three workflows exist
- Workflow structure: correct stages, dependencies, agents
- get_workflow_config: valid names, invalid names
- list_workflow_names: returns all names
"""

from __future__ import annotations

import pytest

from backend.agents.workflows import (
    INITIALIZATION_WORKFLOW,
    WRITING_WORKFLOW,
    REVIEW_WORKFLOW,
    WORKFLOW_REGISTRY,
    get_workflow_config,
    list_workflow_names,
)
from backend.agents.orchestrator import StageConfig


# ===========================================================================
# Workflow Registry Tests
# ===========================================================================

class TestWorkflowRegistry:
    """Test WORKFLOW_REGISTRY."""

    def test_registry_has_three_workflows(self):
        assert len(WORKFLOW_REGISTRY) == 3

    def test_registry_keys(self):
        assert "initialization" in WORKFLOW_REGISTRY
        assert "writing" in WORKFLOW_REGISTRY
        assert "review" in WORKFLOW_REGISTRY

    def test_registry_values_are_stage_lists(self):
        for name, stages in WORKFLOW_REGISTRY.items():
            assert isinstance(stages, list)
            assert len(stages) > 0
            for stage in stages:
                assert isinstance(stage, StageConfig)


# ===========================================================================
# Initialization Workflow Tests
# ===========================================================================

class TestInitializationWorkflow:
    """Test initialization workflow structure."""

    def test_has_three_stages(self):
        assert len(INITIALIZATION_WORKFLOW) == 3

    def test_stage_names(self):
        names = [s.name for s in INITIALIZATION_WORKFLOW]
        assert "chat_collection" in names
        assert "context_synthesis" in names
        assert "data_extraction" in names

    def test_dependencies(self):
        stages = {s.name: s for s in INITIALIZATION_WORKFLOW}
        assert stages["context_synthesis"].depends_on == ["chat_collection"]
        assert stages["data_extraction"].depends_on == ["context_synthesis"]

    def test_agents(self):
        stages = {s.name: s for s in INITIALIZATION_WORKFLOW}
        assert "chat_agent" in stages["chat_collection"].agents
        assert "context_agent" in stages["context_synthesis"].agents
        assert "data_agent" in stages["data_extraction"].agents


# ===========================================================================
# Writing Workflow Tests
# ===========================================================================

class TestWritingWorkflow:
    """Test writing workflow structure."""

    def test_has_four_stages(self):
        assert len(WRITING_WORKFLOW) == 4

    def test_stage_names(self):
        names = [s.name for s in WRITING_WORKFLOW]
        assert "context_building" in names
        assert "plot_planning" in names
        assert "style_application" in names
        assert "quality_review" in names

    def test_dependencies_chain(self):
        stages = {s.name: s for s in WRITING_WORKFLOW}
        assert stages["plot_planning"].depends_on == ["context_building"]
        assert stages["style_application"].depends_on == ["plot_planning"]
        assert stages["quality_review"].depends_on == ["style_application"]


# ===========================================================================
# Review Workflow Tests
# ===========================================================================

class TestReviewWorkflow:
    """Test review workflow structure."""

    def test_has_one_stage(self):
        assert len(REVIEW_WORKFLOW) == 1

    def test_stage_is_parallel(self):
        stage = REVIEW_WORKFLOW[0]
        assert stage.name == "comprehensive_review"
        assert stage.mode == "parallel"

    def test_agents_include_review_and_checker(self):
        stage = REVIEW_WORKFLOW[0]
        assert "review_agent" in stage.agents
        assert "consistency_checker" in stage.agents


# ===========================================================================
# get_workflow_config Tests
# ===========================================================================

class TestGetWorkflowConfig:
    """Test get_workflow_config function."""

    def test_get_initialization(self):
        config = get_workflow_config("initialization")
        assert config == INITIALIZATION_WORKFLOW

    def test_get_writing(self):
        config = get_workflow_config("writing")
        assert config == WRITING_WORKFLOW

    def test_get_review(self):
        config = get_workflow_config("review")
        assert config == REVIEW_WORKFLOW

    def test_get_unknown_raises(self):
        with pytest.raises(KeyError, match="Unknown workflow"):
            get_workflow_config("nonexistent")


# ===========================================================================
# list_workflow_names Tests
# ===========================================================================

class TestListWorkflowNames:
    """Test list_workflow_names function."""

    def test_returns_all_names(self):
        names = list_workflow_names()
        assert set(names) == {"initialization", "writing", "review"}

    def test_returns_list(self):
        names = list_workflow_names()
        assert isinstance(names, list)
