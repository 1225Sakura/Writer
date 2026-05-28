"""Project Constitution - Creative vision and content rules for agents.

Provides a structured way to define project-wide creative directives that
are injected into agent system prompts, ensuring consistency across all
AI-generated content.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class ProjectConstitution:
    """Creative vision and content rules for a writing project.

    The constitution captures the author's intent across multiple dimensions
    and converts them into a system prompt prefix that every agent receives.

    Attributes:
        creative_vision: High-level description of the story's creative direction.
        tone: Overall emotional tone (e.g., "dark and gritty", "lighthearted").
        content_rules: Explicit rules for content generation (e.g., "no gore").
        compliance: Compliance or regulatory constraints.
        themes: List of narrative themes to reinforce.
        style_directive: Writing style instructions (e.g., "minimalist prose").
        character_voice: Per-character voice instructions keyed by character name.
    """

    creative_vision: str = ""
    tone: str = ""
    content_rules: List[str] = field(default_factory=list)
    compliance: List[str] = field(default_factory=list)
    themes: List[str] = field(default_factory=list)
    style_directive: str = ""
    character_voice: Dict[str, str] = field(default_factory=dict)

    def to_system_prompt_prefix(self) -> str:
        """Convert the constitution into a system prompt prefix.

        Returns:
            A newline-joined string of non-empty directives suitable for
            prepending to an agent's system prompt. Returns empty string
            if no directives are set.
        """
        parts: list[str] = []

        if self.creative_vision:
            parts.append(f"Creative Vision: {self.creative_vision}")
        if self.tone:
            parts.append(f"Tone: {self.tone}")
        if self.content_rules:
            parts.append(f"Content Rules: {'; '.join(self.content_rules)}")
        if self.compliance:
            parts.append(f"Compliance: {'; '.join(self.compliance)}")
        if self.themes:
            parts.append(f"Themes: {', '.join(self.themes)}")
        if self.style_directive:
            parts.append(f"Style: {self.style_directive}")
        if self.character_voice:
            voice_lines = "; ".join(
                f"{name}: {voice}" for name, voice in self.character_voice.items()
            )
            parts.append(f"Character Voices: {voice_lines}")

        return "\n".join(parts)

    def to_dict(self) -> Dict[str, object]:
        """Serialize the constitution to a JSON-compatible dict.

        Returns:
            Dict representation of all constitution fields.
        """
        return {
            "creative_vision": self.creative_vision,
            "tone": self.tone,
            "content_rules": list(self.content_rules),
            "compliance": list(self.compliance),
            "themes": list(self.themes),
            "style_directive": self.style_directive,
            "character_voice": dict(self.character_voice),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "ProjectConstitution":
        """Deserialize a constitution from a dict.

        Args:
            data: Dict with constitution fields.

        Returns:
            A new ProjectConstitution instance.
        """
        return cls(
            creative_vision=str(data.get("creative_vision", "")),
            tone=str(data.get("tone", "")),
            content_rules=list(data.get("content_rules", [])),  # type: ignore[arg-type]
            compliance=list(data.get("compliance", [])),  # type: ignore[arg-type]
            themes=list(data.get("themes", [])),  # type: ignore[arg-type]
            style_directive=str(data.get("style_directive", "")),
            character_voice=dict(data.get("character_voice", {})),  # type: ignore[arg-type]
        )
