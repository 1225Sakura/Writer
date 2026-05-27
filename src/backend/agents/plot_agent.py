"""Plot Agent - Plot design and rhythm analysis agent.

Provides three core capabilities:
1. Foreshadowing design: Analyze chapters and suggest new foreshadowing
   or identify opportunities to resolve existing foreshadowing.
2. Climax planning: Plan climax pacing based on outline and progress.
3. Plot rhythm analysis: Check tension curves between chapters.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from backend.utils.exceptions import AIServiceError, AIServiceTimeoutError, AIServiceRateLimitError
from .base import BaseAgent, AgentContext, AgentResult

import yaml
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent / "prompts"

def _load_prompts(name: str) -> dict:
    path = _PROMPTS_DIR / f"{name}.yaml"
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

_PLOT_PROMPTS = _load_prompts("plot_agent")

logger = logging.getLogger(__name__)


class PlotAgent(BaseAgent):
    """Plot design and rhythm analysis agent for novel writing.

    Uses the AI provider to generate structured plot suggestions including:
    - Foreshadowing design (new hooks and resolution opportunities)
    - Climax planning (pacing and placement of high-tension moments)
    - Plot rhythm analysis (tension curve evaluation across chapters)
    """

    # Confidence thresholds
    HIGH_CONFIDENCE_THRESHOLD = 0.8
    MEDIUM_CONFIDENCE_THRESHOLD = 0.6

    async def execute(self, context: AgentContext) -> AgentResult:
        """Execute plot analysis based on context task type.

        The task field determines which analysis to run:
        - "foreshadowing": Analyze and suggest foreshadowing
        - "climax": Plan climax pacing
        - "rhythm": Analyze plot rhythm / tension curve
        - "full" or default: Run all three analyses

        Args:
            context: AgentContext with:
                - task: Analysis type ("foreshadowing", "climax", "rhythm", "full")
                - settings: Dict containing:
                    - "content": Current chapter content (str)
                    - "outline": Story outline data (dict)
                    - "chapters": List of previous chapter summaries (list)
                    - "active_threads": Active plot threads (list)
                    - "progress": Current story progress 0.0-1.0 (float)
                - history: Previous plot analysis history (optional)
                - constraints: Constraints for analysis (optional)

        Returns:
            AgentResult with structured plot suggestions.
        """
        task_type = context.task.strip().lower() if context.task else "full"
        settings = context.settings
        content = settings.get("content", "")
        outline = settings.get("outline", {})
        chapters = settings.get("chapters", [])
        active_threads = settings.get("active_threads", [])
        progress = settings.get("progress", 0.5)

        warnings: list[str] = []

        if not content:
            warnings.append("No chapter content provided; analysis may be limited")

        results: dict[str, Any] = {}
        analyses_run = 0
        analyses_failed = 0

        # Run requested analyses
        if task_type in ("foreshadowing", "full"):
            try:
                results["foreshadowing"] = await self._analyze_foreshadowing(
                    content=content,
                    outline=outline,
                    chapters=chapters,
                    active_threads=active_threads,
                )
                analyses_run += 1
            except (AIServiceError, AIServiceTimeoutError, AIServiceRateLimitError) as exc:
                logger.exception("Foreshadowing analysis failed: %s", exc)
                results["foreshadowing"] = {"error": str(exc)}
                analyses_failed += 1

        if task_type in ("climax", "full"):
            try:
                results["climax"] = await self._plan_climax(
                    outline=outline,
                    chapters=chapters,
                    progress=progress,
                    active_threads=active_threads,
                )
                analyses_run += 1
            except (AIServiceError, AIServiceTimeoutError, AIServiceRateLimitError) as exc:
                logger.exception("Climax planning failed: %s", exc)
                results["climax"] = {"error": str(exc)}
                analyses_failed += 1

        if task_type in ("rhythm", "full"):
            try:
                results["rhythm"] = await self._analyze_rhythm(
                    chapters=chapters,
                    current_content=content,
                )
                analyses_run += 1
            except (AIServiceError, AIServiceTimeoutError, AIServiceRateLimitError) as exc:
                logger.exception("Rhythm analysis failed: %s", exc)
                results["rhythm"] = {"error": str(exc)}
                analyses_failed += 1

        # Calculate confidence based on success rate and data quality
        if analyses_run == 0:
            confidence = 0.0
            warnings.append("All analyses failed")
        else:
            success_rate = analyses_run / (analyses_run + analyses_failed)
            base_confidence = 0.5 + (success_rate * 0.4)

            # Boost confidence if we have rich context
            if outline and chapters:
                base_confidence = min(0.95, base_confidence + 0.1)
            if active_threads:
                base_confidence = min(0.95, base_confidence + 0.05)

            confidence = round(base_confidence, 2)

        # Publish event
        await self.event_bus.publish(
            "agent.plot.completed",
            {
                "agent": "PlotAgent",
                "task_type": task_type,
                "analyses_run": analyses_run,
                "analyses_failed": analyses_failed,
            },
        )

        logger.info(
            "PlotAgent completed: task=%s, run=%d, failed=%d, confidence=%.2f",
            task_type,
            analyses_run,
            analyses_failed,
            confidence,
        )

        return AgentResult(
            content=results,
            confidence=confidence,
            metadata={
                "task_type": task_type,
                "analyses_run": analyses_run,
                "analyses_failed": analyses_failed,
                "has_outline": bool(outline),
                "chapter_count": len(chapters),
                "thread_count": len(active_threads),
            },
            warnings=warnings,
        )

    # ------------------------------------------------------------------
    # Foreshadowing Analysis
    # ------------------------------------------------------------------

    async def _analyze_foreshadowing(
        self,
        content: str,
        outline: dict[str, Any],
        chapters: list[dict[str, Any]],
        active_threads: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Analyze current chapter for foreshadowing opportunities.

        Identifies:
        - New foreshadowing hooks that can be planted
        - Existing foreshadowing that should be resolved
        - Dangling threads that need attention

        Args:
            content: Current chapter content.
            outline: Story outline with major plot points.
            chapters: Previous chapter summaries.
            active_threads: Currently active plot threads.

        Returns:
            Structured foreshadowing analysis.
        """
        system_prompt = _PLOT_PROMPTS["foreshadowing_system_prompt"]

        user_content = self._build_foreshadowing_prompt_content(
            content, outline, chapters, active_threads
        )

        raw_response = await self.provider.generate(
            prompt=f"{system_prompt}\n\n{user_content}",
            style="default",
            operation="continue",
        )

        try:
            parsed = self._extract_json(raw_response)
            return self._validate_foreshadowing_result(parsed)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Failed to parse foreshadowing response: %s", exc)
            return {
                "new_hooks": [],
                "resolvable_hooks": [],
                "dangling_threads": [],
                "overall_assessment": "解析失败，请重试",
                "parse_error": str(exc),
                "raw_response": raw_response[:500],
            }

    def _build_foreshadowing_prompt_content(
        self,
        content: str,
        outline: dict[str, Any],
        chapters: list[dict[str, Any]],
        active_threads: list[dict[str, Any]],
    ) -> str:
        """Build user content for foreshadowing analysis prompt."""
        parts = []

        if outline:
            parts.append(f"【故事大纲】\n{json.dumps(outline, ensure_ascii=False, indent=2)}")

        if chapters:
            recent = chapters[-5:] if len(chapters) > 5 else chapters
            parts.append(
                f"【近期章节摘要】\n{json.dumps(recent, ensure_ascii=False, indent=2)}"
            )

        if active_threads:
            parts.append(
                f"【活跃线索】\n{json.dumps(active_threads, ensure_ascii=False, indent=2)}"
            )

        parts.append(f"【当前章节内容】\n{content[:3000]}")

        return "\n\n".join(parts)

    def _validate_foreshadowing_result(self, data: Any) -> dict[str, Any]:
        """Validate and normalize foreshadowing analysis result."""
        if not isinstance(data, dict):
            raise ValueError(f"Expected dict, got {type(data).__name__}")

        result = {
            "new_hooks": self._validate_hook_list(data.get("new_hooks", [])),
            "resolvable_hooks": self._validate_hook_list(
                data.get("resolvable_hooks", []), resolvable=True
            ),
            "dangling_threads": self._validate_hook_list(
                data.get("dangling_threads", []), thread=True
            ),
            "overall_assessment": data.get("overall_assessment", ""),
        }
        return result

    def _validate_hook_list(
        self,
        hooks: Any,
        resolvable: bool = False,
        thread: bool = False,
    ) -> list[dict[str, Any]]:
        """Validate a list of hook/thread dicts."""
        if not isinstance(hooks, list):
            return []

        validated = []
        for hook in hooks:
            if not isinstance(hook, dict):
                continue
            if "description" not in hook:
                continue

            item = {"description": hook.get("description", "")}

            if resolvable:
                item.update({
                    "origin": hook.get("origin", ""),
                    "suggested_resolution": hook.get("suggested_resolution", ""),
                    "urgency": hook.get("urgency", "medium"),
                })
            elif thread:
                item.update({
                    "risk": hook.get("risk", ""),
                    "suggestion": hook.get("suggestion", ""),
                })
            else:
                item.update({
                    "placement": hook.get("placement", ""),
                    "payoff_chapter": hook.get("payoff_chapter", ""),
                    "importance": hook.get("importance", "medium"),
                    "type": hook.get("type", ""),
                })

            validated.append(item)

        return validated

    # ------------------------------------------------------------------
    # Climax Planning
    # ------------------------------------------------------------------

    async def _plan_climax(
        self,
        outline: dict[str, Any],
        chapters: list[dict[str, Any]],
        progress: float,
        active_threads: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Plan climax pacing based on outline and current progress.

        Args:
            outline: Story outline with major plot points.
            chapters: Previous chapter summaries.
            progress: Current story progress (0.0-1.0).
            active_threads: Active plot threads.

        Returns:
            Structured climax plan.
        """
        system_prompt = _PLOT_PROMPTS["climax_system_prompt"]

        user_content = self._build_climax_prompt_content(
            outline, chapters, progress, active_threads
        )

        raw_response = await self.provider.generate(
            prompt=f"{system_prompt}\n\n{user_content}",
            style="default",
            operation="continue",
        )

        try:
            parsed = self._extract_json(raw_response)
            return self._validate_climax_result(parsed)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Failed to parse climax response: %s", exc)
            return {
                "climax_points": [],
                "current_phase": {
                    "name": "未知",
                    "description": "解析失败",
                    "recommended_pacing": "",
                    "next_milestone": "",
                },
                "pacing_recommendations": [],
                "risk_warnings": [],
                "parse_error": str(exc),
                "raw_response": raw_response[:500],
            }

    def _build_climax_prompt_content(
        self,
        outline: dict[str, Any],
        chapters: list[dict[str, Any]],
        progress: float,
        active_threads: list[dict[str, Any]],
    ) -> str:
        """Build user content for climax planning prompt."""
        parts = []

        parts.append(f"【当前进度】{progress * 100:.1f}%")

        if outline:
            parts.append(f"【故事大纲】\n{json.dumps(outline, ensure_ascii=False, indent=2)}")

        if chapters:
            recent = chapters[-3:] if len(chapters) > 3 else chapters
            parts.append(
                f"【最近章节】\n{json.dumps(recent, ensure_ascii=False, indent=2)}"
            )

        if active_threads:
            parts.append(
                f"【活跃线索】\n{json.dumps(active_threads, ensure_ascii=False, indent=2)}"
            )

        return "\n\n".join(parts)

    def _validate_climax_result(self, data: Any) -> dict[str, Any]:
        """Validate and normalize climax planning result."""
        if not isinstance(data, dict):
            raise ValueError(f"Expected dict, got {type(data).__name__}")

        climax_points = []
        for cp in data.get("climax_points", []):
            if isinstance(cp, dict) and "name" in cp:
                climax_points.append({
                    "name": cp.get("name", ""),
                    "estimated_position": cp.get("estimated_position", ""),
                    "type": cp.get("type", ""),
                    "buildup_chapters": cp.get("buildup_chapters", ""),
                    "intensity": self._clamp_intensity(cp.get("intensity", 5)),
                    "prerequisites": cp.get("prerequisites", []),
                    "emotional_impact": cp.get("emotional_impact", ""),
                })

        current_phase_raw = data.get("current_phase", {})
        current_phase = {
            "name": current_phase_raw.get("name", ""),
            "description": current_phase_raw.get("description", ""),
            "recommended_pacing": current_phase_raw.get("recommended_pacing", ""),
            "next_milestone": current_phase_raw.get("next_milestone", ""),
        }

        risk_warnings = []
        for rw in data.get("risk_warnings", []):
            if isinstance(rw, dict):
                risk_warnings.append({
                    "risk": rw.get("risk", ""),
                    "mitigation": rw.get("mitigation", ""),
                })

        return {
            "climax_points": climax_points,
            "current_phase": current_phase,
            "pacing_recommendations": data.get("pacing_recommendations", []),
            "risk_warnings": risk_warnings,
        }

    # ------------------------------------------------------------------
    # Rhythm Analysis
    # ------------------------------------------------------------------

    async def _analyze_rhythm(
        self,
        chapters: list[dict[str, Any]],
        current_content: str,
    ) -> dict[str, Any]:
        """Analyze plot rhythm and tension curve across chapters.

        Args:
            chapters: Previous chapter summaries with tension info.
            current_content: Current chapter content.

        Returns:
            Structured rhythm analysis.
        """
        system_prompt = _PLOT_PROMPTS["rhythm_system_prompt"]

        user_content = self._build_rhythm_prompt_content(chapters, current_content)

        raw_response = await self.provider.generate(
            prompt=f"{system_prompt}\n\n{user_content}",
            style="default",
            operation="continue",
        )

        try:
            parsed = self._extract_json(raw_response)
            return self._validate_rhythm_result(parsed)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Failed to parse rhythm response: %s", exc)
            return {
                "tension_curve": [],
                "analysis": {
                    "overall_rhythm": "解析失败",
                    "peak_distribution": "",
                    "valley_distribution": "",
                    "transition_quality": "",
                },
                "issues": [],
                "recommendations": [],
                "parse_error": str(exc),
                "raw_response": raw_response[:500],
            }

    def _build_rhythm_prompt_content(
        self,
        chapters: list[dict[str, Any]],
        current_content: str,
    ) -> str:
        """Build user content for rhythm analysis prompt."""
        parts = []

        if chapters:
            parts.append(
                f"【章节序列】\n{json.dumps(chapters, ensure_ascii=False, indent=2)}"
            )

        if current_content:
            parts.append(f"【当前章节内容】\n{current_content[:2000]}")

        return "\n\n".join(parts)

    def _validate_rhythm_result(self, data: Any) -> dict[str, Any]:
        """Validate and normalize rhythm analysis result."""
        if not isinstance(data, dict):
            raise ValueError(f"Expected dict, got {type(data).__name__}")

        tension_curve = []
        for tc in data.get("tension_curve", []):
            if isinstance(tc, dict):
                tension_curve.append({
                    "chapter": tc.get("chapter", ""),
                    "tension_score": self._clamp_intensity(tc.get("tension_score", 5)),
                    "emotional_tone": tc.get("emotional_tone", ""),
                    "pacing": tc.get("pacing", ""),
                })

        analysis_raw = data.get("analysis", {})
        analysis = {
            "overall_rhythm": analysis_raw.get("overall_rhythm", ""),
            "peak_distribution": analysis_raw.get("peak_distribution", ""),
            "valley_distribution": analysis_raw.get("valley_distribution", ""),
            "transition_quality": analysis_raw.get("transition_quality", ""),
        }

        issues = []
        for issue in data.get("issues", []):
            if isinstance(issue, dict):
                issues.append({
                    "location": issue.get("location", ""),
                    "type": issue.get("type", ""),
                    "severity": issue.get("severity", "medium"),
                    "description": issue.get("description", ""),
                    "suggestion": issue.get("suggestion", ""),
                })

        return {
            "tension_curve": tension_curve,
            "analysis": analysis,
            "issues": issues,
            "recommendations": data.get("recommendations", []),
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _extract_json(self, content: str) -> Any:
        """Extract JSON from AI response, handling markdown code blocks."""
        content = content.strip()

        # Handle markdown code blocks
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[0].strip().startswith("```"):
                content = "\n".join(lines[1:])
            if content.strip().endswith("```"):
                content = content.strip()[:-3]

        content = content.strip()
        return json.loads(content)

    def _clamp_intensity(self, value: Any) -> int:
        """Clamp intensity value to 1-10 range."""
        try:
            v = int(value)
            return max(1, min(10, v))
        except (TypeError, ValueError):
            return 5
