"""Tests for the StoryBlackboard pattern."""

import pytest
from backend.services.blackboard import StoryBlackboard, BlackboardConflict


@pytest.fixture
def blackboard():
    return StoryBlackboard()


def test_update_from_agent_stores_character_states(blackboard):
    blackboard.update_from_agent("character_agent", {
        "character_states": {
            "protagonist": {"mood": "angry", "location": "tavern"},
            "rival": {"mood": "smug", "location": "arena"},
        }
    })
    assert blackboard.character_states["protagonist"]["mood"] == "angry"
    assert blackboard.character_states["rival"]["location"] == "arena"


def test_update_from_agent_stores_plot_threads(blackboard):
    blackboard.update_from_agent("plot_agent", {
        "plot_threads": {
            "main_quest": {"status": "active", "tension": 0.7},
        }
    })
    assert blackboard.plot_threads["main_quest"]["status"] == "active"


def test_update_from_agent_appends_world_facts(blackboard):
    blackboard.update_from_agent("world_agent", {
        "world_facts": [{"fact": "The kingdom is at war"}, {"fact": "Magic is rare"}]
    })
    assert len(blackboard.world_facts) == 2
    assert blackboard.world_facts[0]["fact"] == "The kingdom is at war"


def test_update_from_agent_appends_emotional_arc(blackboard):
    blackboard.update_from_agent("style_agent", {
        "emotional_arc": [{"chapter": 1, "emotion": "hope"}]
    })
    assert len(blackboard.emotional_arc) == 1


def test_update_from_agent_merges_style_metrics(blackboard):
    blackboard.update_from_agent("style_agent", {
        "style_metrics": {"avg_sentence_length": 15.2, "dialogue_ratio": 0.4}
    })
    blackboard.update_from_agent("style_agent", {
        "style_metrics": {"avg_sentence_length": 16.0}
    })
    assert blackboard.style_metrics["avg_sentence_length"] == 16.0
    assert blackboard.style_metrics["dialogue_ratio"] == 0.4


def test_get_contributions_tracks_agent(blackboard):
    blackboard.update_from_agent("agent_a", {
        "character_states": {"hero": {"hp": 100}},
        "world_facts": [{"fact": "daytime"}],
    })
    contribs = blackboard.get_contributions("agent_a")
    assert "agent_a" in contribs
    assert "character_states.hero" in contribs["agent_a"]
    assert "world_facts" in contribs["agent_a"]


def test_get_contributions_all_agents(blackboard):
    blackboard.update_from_agent("agent_a", {"style_metrics": {"pacing": "fast"}})
    blackboard.update_from_agent("agent_b", {"world_facts": [{"fact": "rain"}]})
    all_contribs = blackboard.get_contributions()
    assert "agent_a" in all_contribs
    assert "agent_b" in all_contribs


def test_get_contributions_unknown_agent(blackboard):
    result = blackboard.get_contributions("nonexistent")
    assert result == {"nonexistent": []}


def test_clear_resets_everything(blackboard):
    blackboard.update_from_agent("agent_a", {
        "character_states": {"hero": {"hp": 100}},
        "plot_threads": {"quest": {"status": "active"}},
        "world_facts": [{"fact": "sunny"}],
        "emotional_arc": [{"emotion": "calm"}],
        "style_metrics": {"pacing": "slow"},
    })
    blackboard.clear()
    assert blackboard.character_states == {}
    assert blackboard.plot_threads == {}
    assert blackboard.world_facts == []
    assert blackboard.emotional_arc == []
    assert blackboard.style_metrics == {}
    assert blackboard.get_contributions() == {}


def test_multiple_agents_contribute(blackboard):
    blackboard.update_from_agent("character_agent", {
        "character_states": {"hero": {"mood": "determined"}},
    })
    blackboard.update_from_agent("plot_agent", {
        "plot_threads": {"betrayal": {"act": 2}},
    })
    blackboard.update_from_agent("style_agent", {
        "style_metrics": {"tone": "dark"},
        "emotional_arc": [{"chapter": 3, "emotion": "despair"}],
    })
    assert len(blackboard.character_states) == 1
    assert len(blackboard.plot_threads) == 1
    assert len(blackboard.emotional_arc) == 1
    assert blackboard.style_metrics["tone"] == "dark"
    all_contribs = blackboard.get_contributions()
    assert len(all_contribs) == 3


def test_get_conflicts_empty(blackboard):
    assert blackboard.get_conflicts() == []


def test_blackboard_conflict_dataclass():
    c = BlackboardConflict(
        key="character_states.hero",
        agent_a="char_agent",
        value_a={"mood": "happy"},
        agent_b="style_agent",
        value_b={"mood": "sad"},
    )
    assert c.key == "character_states.hero"
    assert c.agent_a == "char_agent"
    assert c.value_b == {"mood": "sad"}
