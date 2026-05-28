from dataclasses import dataclass, field
from typing import Dict, List, Any


@dataclass
class BlackboardConflict:
    key: str
    agent_a: str
    value_a: Any
    agent_b: str
    value_b: Any


class StoryBlackboard:
    """Shared story state for multi-agent collaboration."""

    def __init__(self):
        self.character_states: Dict[str, Dict] = {}
        self.plot_threads: Dict[str, Dict] = {}
        self.world_facts: List[Dict] = []
        self.emotional_arc: List[Dict] = []
        self.style_metrics: Dict[str, Any] = {}
        self._contributions: Dict[str, List[str]] = {}  # agent -> [keys]

    def update_from_agent(self, agent_name: str, updates: Dict[str, Any]) -> None:
        """Merge agent contributions into shared state."""
        self._contributions.setdefault(agent_name, [])

        if "character_states" in updates:
            for name, state in updates["character_states"].items():
                self.character_states[name] = state
                self._contributions[agent_name].append(f"character_states.{name}")

        if "plot_threads" in updates:
            for name, thread in updates["plot_threads"].items():
                self.plot_threads[name] = thread
                self._contributions[agent_name].append(f"plot_threads.{name}")

        if "world_facts" in updates:
            self.world_facts.extend(updates["world_facts"])
            self._contributions[agent_name].append("world_facts")

        if "emotional_arc" in updates:
            self.emotional_arc.extend(updates["emotional_arc"])
            self._contributions[agent_name].append("emotional_arc")

        if "style_metrics" in updates:
            self.style_metrics.update(updates["style_metrics"])
            self._contributions[agent_name].append("style_metrics")

    def get_conflicts(self) -> List[BlackboardConflict]:
        """Detect contradictions between agent contributions."""
        conflicts = []
        # Check character state conflicts
        for name, state in self.character_states.items():
            # Simple conflict: same character has different states
            pass  # Implement based on specific conflict rules
        return conflicts

    def get_contributions(self, agent_name: str = None) -> Dict[str, List[str]]:
        """Get contributions by agent."""
        if agent_name:
            return {agent_name: self._contributions.get(agent_name, [])}
        return dict(self._contributions)

    def clear(self) -> None:
        """Reset blackboard state."""
        self.character_states.clear()
        self.plot_threads.clear()
        self.world_facts.clear()
        self.emotional_arc.clear()
        self.style_metrics.clear()
        self._contributions.clear()
