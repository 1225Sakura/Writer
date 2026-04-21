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

from .base import BaseAgent, AgentContext, AgentResult

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
            except Exception as exc:
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
            except Exception as exc:
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
            except Exception as exc:
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
        system_prompt = """你是一位专业的小说情节设计专家，专注于伏笔设计。

请分析提供的章节内容，并给出结构化的伏笔建议。你必须返回一个有效的JSON对象，格式如下：

{
    "new_hooks": [
        {
            "description": "新伏笔的描述（30字以内）",
            "placement": "建议放置的位置（开头/中间/结尾）",
            "payoff_chapter": "预计回收的章节范围（如：5-10章后）",
            "importance": "重要性（high/medium/low）",
            "type": "伏笔类型（信息型/物品型/关系型/事件型）"
        }
    ],
    "resolvable_hooks": [
        {
            "description": "可回收的旧伏笔描述",
            "origin": "该伏笔最初出现的章节或位置",
            "suggested_resolution": "建议的回收方式",
            "urgency": "回收紧迫性（high/medium/low）"
        }
    ],
    "dangling_threads": [
        {
            "description": "悬而未决的线索描述",
            "risk": "长期不处理的风险",
            "suggestion": "处理建议"
        }
    ],
    "overall_assessment": "对当前章节伏笔布局的整体评价（50字以内）"
}

注意：
- 使用双引号包裹所有字符串
- 确保JSON格式正确
- 如果某类结果为空，返回空数组"""

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
        system_prompt = """你是一位专业的小说节奏规划专家，专注于高潮设计。

请根据提供的大纲和当前进度，规划高潮节奏。返回有效的JSON对象：

{
    "climax_points": [
        {
            "name": "高潮点名称",
            "estimated_position": "预计位置（如：第30章/故事60%处）",
            "type": "高潮类型（情感爆发/战斗/揭秘/抉择/牺牲）",
            "buildup_chapters": "建议铺垫章节数",
            "intensity": "强度评分（1-10）",
            "prerequisites": ["触发该高潮的前提条件"],
            "emotional_impact": "预期情感冲击描述"
        }
    ],
    "current_phase": {
        "name": "当前阶段名称（如：铺垫期/上升期/高潮期）",
        "description": "当前阶段描述",
        "recommended_pacing": "建议的节奏控制方式",
        "next_milestone": "下一个里程碑"
    },
    "pacing_recommendations": [
        "节奏控制建议1",
        "节奏控制建议2"
    ],
    "risk_warnings": [
        {
            "risk": "潜在风险描述",
            "mitigation": "规避建议"
        }
    ]
}

注意：
- 使用双引号包裹所有字符串
- 确保JSON格式正确
- 高潮点应该有起承转合的层次感"""

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
        system_prompt = """你是一位专业的小说节奏分析专家，专注于情节张力曲线分析。

请分析提供的章节序列，评估张力曲线。返回有效的JSON对象：

{
    "tension_curve": [
        {
            "chapter": "章节标识",
            "tension_score": "张力评分（1-10）",
            "emotional_tone": "情感基调（紧张/舒缓/悲伤/兴奋等）",
            "pacing": "节奏评价（过快/适中/过慢）"
        }
    ],
    "analysis": {
        "overall_rhythm": "整体节奏评价",
        "peak_distribution": "高潮分布评价",
        "valley_distribution": "低谷/舒缓段分布评价",
        "transition_quality": "章节间过渡质量评价"
    },
    "issues": [
        {
            "location": "问题位置",
            "type": "问题类型（节奏断裂/张力不足/高潮堆砌/过渡生硬）",
            "severity": "严重程度（high/medium/low）",
            "description": "问题描述",
            "suggestion": "改进建议"
        }
    ],
    "recommendations": [
        "节奏调整建议"
    ]
}

注意：
- 使用双引号包裹所有字符串
- 确保JSON格式正确
- 张力曲线应该有起伏，避免平铺直叙"""

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
