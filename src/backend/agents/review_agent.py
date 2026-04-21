"""Review Agent - Multi-round novel quality review agent.

Implements a three-phase review process:
1. Quick scan: Fast heuristic checks across six dimensions
2. Deep analysis: AI-powered thorough analysis
3. Cross-validation: Compare results and flag disagreements
"""

from __future__ import annotations

import logging
from typing import Any

from .base import BaseAgent, AgentContext, AgentResult
from .checkers.pipeline import CheckerPipeline
from .checkers.base import CheckerResult

logger = logging.getLogger(__name__)


class ReviewAgent(BaseAgent):
    """Multi-round quality review agent for novel chapters.

    Executes a three-phase review pipeline:
    - Phase 1 (Quick Scan): Run CheckerPipeline.run_quick_scan for fast
      heuristic checks across all registered checkers.
    - Phase 2 (Deep Analysis): Run CheckerPipeline.run_deep_analysis for
      thorough AI-powered analysis with full context.
    - Phase 3 (Cross-Validation): Compare quick scan and deep analysis
      results, flagging disagreements and synthesizing a final report.

    The final output is an AgentResult containing a structured review report
    with overall_score, issues, and suggestions.
    """

    # Severity to confidence mapping
    SEVERITY_CONFIDENCE = {
        "low": 0.85,
        "medium": 0.70,
        "high": 0.55,
        "critical": 0.40,
    }

    def __init__(self, provider, event_bus) -> None:
        """Initialize the review agent.

        Args:
            provider: The AI provider for generation tasks.
            event_bus: Async event bus for publishing agent events.
        """
        super().__init__(provider, event_bus)
        self._pipeline: CheckerPipeline | None = None

    def set_pipeline(self, pipeline: CheckerPipeline) -> None:
        """Set the checker pipeline for this agent.

        Args:
            pipeline: CheckerPipeline instance with registered checkers.
        """
        self._pipeline = pipeline

    async def execute(self, context: AgentContext) -> AgentResult:
        """Execute the multi-round review process.

        Args:
            context: AgentContext with:
                - task: The chapter content to review (str)
                - settings: Optional dict with 'checkers' list, 'context' dict
                - history: Previous review history (optional)
                - constraints: Review constraints (optional)

        Returns:
            AgentResult with structured review report.
        """
        content = context.task
        if not content or not content.strip():
            return AgentResult(
                content={
                    "overall_score": 0,
                    "severity": "critical",
                    "issues": [{"type": "input_error", "message": "Review content is empty"}],
                    "suggestions": ["Please provide chapter content for review"],
                    "phase_results": {},
                    "disagreements": [],
                },
                confidence=0.0,
                metadata={"phases_completed": 0},
                warnings=["Empty content provided"],
            )

        review_context = context.settings.get("context", {})
        warnings: list[str] = []

        # Phase 1: Quick Scan
        logger.info("ReviewAgent Phase 1: Quick scan started")
        quick_results = await self._run_quick_scan(content)
        if not quick_results:
            warnings.append("Quick scan produced no results")

        # Phase 2: Deep Analysis
        logger.info("ReviewAgent Phase 2: Deep analysis started")
        deep_results = await self._run_deep_analysis(content, review_context)
        if not deep_results:
            warnings.append("Deep analysis produced no results")

        # Phase 3: Cross-Validation
        logger.info("ReviewAgent Phase 3: Cross-validation started")
        disagreements = self._find_disagreements(quick_results, deep_results)
        report = self._synthesize_report(quick_results, deep_results, disagreements)

        # Compute confidence based on severity
        severity = report.get("severity", "medium")
        confidence = self.SEVERITY_CONFIDENCE.get(severity, 0.70)

        # Adjust confidence based on disagreement count
        if len(disagreements) > 3:
            confidence = max(0.3, confidence - 0.2)
        elif len(disagreements) > 0:
            confidence = max(0.4, confidence - 0.1)

        # Publish review completed event
        await self.event_bus.publish(
            "agent.review.completed",
            {
                "agent": "ReviewAgent",
                "overall_score": report.get("overall_score", 0),
                "severity": severity,
                "total_issues": len(report.get("issues", [])),
                "disagreement_count": len(disagreements),
            },
        )

        logger.info(
            "ReviewAgent completed: score=%d, severity=%s, issues=%d, disagreements=%d",
            report.get("overall_score", 0),
            severity,
            len(report.get("issues", [])),
            len(disagreements),
        )

        return AgentResult(
            content=report,
            confidence=confidence,
            metadata={
                "phases_completed": 3,
                "quick_scan_count": len(quick_results),
                "deep_analysis_count": len(deep_results),
                "disagreement_count": len(disagreements),
            },
            warnings=warnings,
        )

    # ------------------------------------------------------------------
    # Phase implementations
    # ------------------------------------------------------------------

    async def _run_quick_scan(
        self, content: str
    ) -> dict[str, CheckerResult]:
        """Run quick scan phase using the checker pipeline.

        Args:
            content: Chapter content to review.

        Returns:
            Dict mapping checker name to CheckerResult.
        """
        if self._pipeline is None:
            logger.warning("No checker pipeline configured, skipping quick scan")
            return {}

        try:
            return await self._pipeline.run_quick_scan(content)
        except Exception as exc:
            logger.exception("Quick scan failed: %s", exc)
            return {}

    async def _run_deep_analysis(
        self, content: str, context: dict[str, Any]
    ) -> dict[str, CheckerResult]:
        """Run deep analysis phase using the checker pipeline.

        Args:
            content: Chapter content to review.
            context: Additional context for deep analysis.

        Returns:
            Dict mapping checker name to CheckerResult.
        """
        if self._pipeline is None:
            logger.warning("No checker pipeline configured, skipping deep analysis")
            return {}

        try:
            return await self._pipeline.run_deep_analysis(content, context)
        except Exception as exc:
            logger.exception("Deep analysis failed: %s", exc)
            return {}

    # ------------------------------------------------------------------
    # Cross-validation
    # ------------------------------------------------------------------

    def _find_disagreements(
        self,
        quick_results: dict[str, CheckerResult],
        deep_results: dict[str, CheckerResult],
    ) -> list[dict[str, Any]]:
        """Compare quick scan and deep analysis results for disagreements.

        Flags cases where:
        - Score difference exceeds threshold (20 points)
        - Issue counts differ significantly
        - One phase finds issues the other misses

        Args:
            quick_results: Results from quick scan phase.
            deep_results: Results from deep analysis phase.

        Returns:
            List of disagreement records.
        """
        disagreements: list[dict[str, Any]] = []
        all_checkers = set(quick_results.keys()) | set(deep_results.keys())

        SCORE_THRESHOLD = 20
        ISSUE_COUNT_THRESHOLD = 3

        for checker_name in all_checkers:
            quick = quick_results.get(checker_name)
            deep = deep_results.get(checker_name)

            if quick is None:
                disagreements.append(
                    {
                        "checker": checker_name,
                        "type": "missing_quick_scan",
                        "message": f"Quick scan missing for {checker_name}, deep analysis found {len(deep.issues)} issues",
                        "deep_score": deep.score if deep else 0,
                    }
                )
                continue

            if deep is None:
                disagreements.append(
                    {
                        "checker": checker_name,
                        "type": "missing_deep_analysis",
                        "message": f"Deep analysis missing for {checker_name}, quick scan found {len(quick.issues)} issues",
                        "quick_score": quick.score,
                    }
                )
                continue

            # Score disagreement
            score_diff = abs(quick.score - deep.score)
            if score_diff > SCORE_THRESHOLD:
                disagreements.append(
                    {
                        "checker": checker_name,
                        "type": "score_disagreement",
                        "message": (
                            f"Score divergence: quick={quick.score}, "
                            f"deep={deep.score}, diff={score_diff}"
                        ),
                        "quick_score": quick.score,
                        "deep_score": deep.score,
                        "diff": score_diff,
                    }
                )

            # Issue count disagreement
            quick_issue_count = len(quick.issues)
            deep_issue_count = len(deep.issues)
            issue_diff = abs(quick_issue_count - deep_issue_count)
            if issue_diff > ISSUE_COUNT_THRESHOLD:
                disagreements.append(
                    {
                        "checker": checker_name,
                        "type": "issue_count_disagreement",
                        "message": (
                            f"Issue count divergence: quick={quick_issue_count}, "
                            f"deep={deep_issue_count}, diff={issue_diff}"
                        ),
                        "quick_issues": quick_issue_count,
                        "deep_issues": deep_issue_count,
                        "diff": issue_diff,
                    }
                )

            # One phase finds issues the other misses entirely
            if quick_issue_count == 0 and deep_issue_count > 0:
                disagreements.append(
                    {
                        "checker": checker_name,
                        "type": "missed_by_quick_scan",
                        "message": f"Quick scan found no issues, but deep analysis found {deep_issue_count}",
                        "deep_issues": deep_issue_count,
                    }
                )
            elif quick_issue_count > 0 and deep_issue_count == 0:
                disagreements.append(
                    {
                        "checker": checker_name,
                        "type": "missed_by_deep_analysis",
                        "message": f"Deep analysis found no issues, but quick scan found {quick_issue_count}",
                        "quick_issues": quick_issue_count,
                    }
                )

        return disagreements

    def _synthesize_report(
        self,
        quick_results: dict[str, CheckerResult],
        deep_results: dict[str, CheckerResult],
        disagreements: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Synthesize final review report from all phases.

        Uses deep analysis results as primary (more thorough), but
        incorporates quick scan results for coverage. Aggregates scores
        and flattens all issues and suggestions.

        Args:
            quick_results: Quick scan results.
            deep_results: Deep analysis results.
            disagreements: Flagged disagreements between phases.

        Returns:
            Structured review report dict.
        """
        # Use deep analysis as primary; fall back to quick scan if deep missing
        primary_results = {}
        all_checkers = set(quick_results.keys()) | set(deep_results.keys())

        for checker_name in all_checkers:
            deep = deep_results.get(checker_name)
            quick = quick_results.get(checker_name)

            if deep is not None:
                primary_results[checker_name] = deep
            elif quick is not None:
                primary_results[checker_name] = quick

        # Aggregate using pipeline if available, otherwise manual aggregation
        if self._pipeline is not None:
            aggregated = self._pipeline.aggregate_results(primary_results)
        else:
            aggregated = self._manual_aggregate(primary_results)

        # Build phase detail summary
        phase_results = {
            "quick_scan": {
                name: {"score": r.score, "issue_count": len(r.issues)}
                for name, r in quick_results.items()
            },
            "deep_analysis": {
                name: {"score": r.score, "issue_count": len(r.issues)}
                for name, r in deep_results.items()
            },
        }

        # Collect all unique issues
        all_issues: list[dict[str, Any]] = []
        seen_issues: set[str] = set()

        for name, result in primary_results.items():
            for issue in result.issues:
                issue_key = f"{name}:{issue.get('type', 'unknown')}:{issue.get('message', '')}"
                if issue_key not in seen_issues:
                    seen_issues.add(issue_key)
                    all_issues.append(
                        {
                            "checker": name,
                            **issue,
                        }
                    )

        # Collect all unique suggestions
        all_suggestions: list[str] = []
        seen_suggestions: set[str] = set()

        for name, result in primary_results.items():
            for suggestion in result.suggestions:
                if suggestion not in seen_suggestions:
                    seen_suggestions.add(suggestion)
                    all_suggestions.append(f"[{name}] {suggestion}")

        return {
            "overall_score": aggregated.get("overall_score", 100),
            "severity": aggregated.get("severity", "low"),
            "total_issues": len(all_issues),
            "issue_breakdown": aggregated.get("issue_breakdown", {}),
            "issues": all_issues,
            "suggestions": all_suggestions,
            "checker_scores": aggregated.get("checker_scores", {}),
            "phase_results": phase_results,
            "disagreements": disagreements,
            "disagreement_count": len(disagreements),
        }

    def _manual_aggregate(
        self, results: dict[str, CheckerResult]
    ) -> dict[str, Any]:
        """Manual aggregation when pipeline is not available.

        Args:
            results: Dict mapping checker name to CheckerResult.

        Returns:
            Aggregated report dict.
        """
        if not results:
            return {
                "overall_score": 100,
                "severity": "low",
                "total_issues": 0,
                "issue_breakdown": {},
                "all_suggestions": [],
                "checker_scores": {},
            }

        total_score = 0
        total_issues = 0
        issue_breakdown: dict[str, int] = {}
        checker_scores: dict[str, int] = {}

        for name, result in results.items():
            checker_scores[name] = result.score
            total_score += result.score
            issue_count = len(result.issues)
            issue_breakdown[name] = issue_count
            total_issues += issue_count

        overall_score = round(total_score / len(results))

        if overall_score >= 80:
            severity = "low"
        elif overall_score >= 60:
            severity = "medium"
        elif overall_score >= 40:
            severity = "high"
        else:
            severity = "critical"

        return {
            "overall_score": overall_score,
            "severity": severity,
            "total_issues": total_issues,
            "issue_breakdown": issue_breakdown,
            "checker_scores": checker_scores,
        }
