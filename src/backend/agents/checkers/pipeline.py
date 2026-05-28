"""Checker pipeline for orchestrating multiple quality checkers.

Provides parallel execution of quick scans and deep analysis across
all registered checkers, plus result aggregation.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

from .base import BaseChecker, CheckerResult
from ...utils.exceptions import CheckerAnalysisError, CheckerError


class CheckerPipeline:
    """Orchestrates multiple checkers in parallel.

    The pipeline runs all registered checkers concurrently and
    aggregates their results into an overall quality report.
    """

    def __init__(self, checkers: list[BaseChecker]) -> None:
        """Initialize the pipeline with a list of checkers.

        Args:
            checkers: List of BaseChecker instances to run.
        """
        self._checkers = list(checkers)

    @property
    def checkers(self) -> list[BaseChecker]:
        """Registered checkers."""
        return self._checkers

    async def run_quick_scan(self, content: str) -> dict[str, CheckerResult]:
        """Run quick_scan on all checkers in parallel.

        Args:
            content: The text content to check.

        Returns:
            Dict mapping checker name to its CheckerResult.
        """
        if not self._checkers:
            return {}

        tasks = [
            asyncio.create_task(
                self._run_checker_safe(checker, checker.quick_scan, content),
                name=f"quick_scan:{checker.name}",
            )
            for checker in self._checkers
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._collect_results(results)

    async def run_deep_analysis(
        self, content: str, context: dict[str, Any]
    ) -> dict[str, CheckerResult]:
        """Run deep_analyze on all checkers in parallel.

        Args:
            content: The text content to analyze.
            context: Additional context for deep analysis.

        Returns:
            Dict mapping checker name to its CheckerResult.
        """
        if not self._checkers:
            return {}

        tasks = [
            asyncio.create_task(
                self._run_checker_safe(
                    checker, checker.deep_analyze, content, context
                ),
                name=f"deep_analyze:{checker.name}",
            )
            for checker in self._checkers
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)
        return self._collect_results(results)

    def aggregate_results(
        self, results: dict[str, CheckerResult]
    ) -> dict[str, Any]:
        """Aggregate individual checker results into a summary.

        Computes weighted overall score, severity-weighted issue counts, and
        flattens suggestions.  Results with ``failure_mode == "analysis_failed"``
        are excluded from the weighted average so that a broken checker does
        not silently drag the score to zero.  Any result containing an issue
        with ``severity == "critical"`` forces the overall score to 0.

        Args:
            results: Dict mapping checker name to CheckerResult.

        Returns:
            Aggregated report dict with overall_score, total_issues,
            issue_breakdown, all_suggestions, checker_scores, and
            failed_checkers.
        """
        if not results:
            return {
                "overall_score": 100,
                "total_issues": 0,
                "issue_breakdown": {},
                "all_suggestions": [],
                "checker_scores": {},
                "failed_checkers": [],
            }

        checker_scores: dict[str, int] = {}
        issue_breakdown: dict[str, int] = {}
        all_suggestions: list[str] = []
        failed_checkers: list[str] = []
        total_issues = 0
        has_critical_issue = False

        # Build a mapping of checker name -> weight from registered checkers
        checker_weights: dict[str, float] = {
            c.name: c.weight for c in self._checkers
        }

        valid_results: list[tuple[str, CheckerResult]] = []

        for name, result in results.items():
            checker_scores[name] = result.score
            issue_count = len(result.issues)
            issue_breakdown[name] = issue_count
            total_issues += issue_count
            all_suggestions.extend(result.suggestions)

            # Check for critical issues
            for issue in result.issues:
                if issue.get("severity") == "critical":
                    has_critical_issue = True

            # Exclude failed checkers from weighted average
            if result.failure_mode == "analysis_failed":
                failed_checkers.append(name)
            else:
                valid_results.append((name, result))

        # Compute weighted average over valid (non-failed) results
        if valid_results:
            weighted_sum = 0.0
            weight_total = 0.0
            for name, result in valid_results:
                w = checker_weights.get(name, 1.0)
                weighted_sum += result.score * w
                weight_total += w
            overall_score = round(weighted_sum / weight_total) if weight_total > 0 else 0
        else:
            # All checkers failed -- report 0
            overall_score = 0

        # Critical issues force score to 0
        if has_critical_issue:
            overall_score = 0

        # Severity classification based on overall score
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
            "all_suggestions": all_suggestions,
            "checker_scores": checker_scores,
            "failed_checkers": failed_checkers,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _run_checker_safe(
        self,
        checker: BaseChecker,
        method: Any,
        content: str,
        context: dict[str, Any] | None = None,
    ) -> tuple[str, CheckerResult]:
        """Run a checker method, catching exceptions.

        Returns:
            Tuple of (checker_name, CheckerResult). On failure, returns
            a CheckerResult with score 0 and ``failure_mode="analysis_failed"``
            so that aggregation can exclude it from the weighted average.
            On success, ``failure_mode`` is set to ``None`` or ``"no_issues"``
            depending on whether issues were found.
        """
        try:
            if context is not None:
                result = await method(content, context)
            else:
                result = await method(content)
            # Annotate successful results with failure_mode
            if result.failure_mode is None and result.score == 100 and not result.issues:
                result.failure_mode = "no_issues"
            return (checker.name, result)
        except CheckerAnalysisError as exc:
            logger.warning("Checker '%s' analysis error: %s", checker.name, exc)
            return (
                checker.name,
                CheckerResult(
                    score=0,
                    issues=[
                        {
                            "type": "checker_error",
                            "checker": checker.name,
                            "message": str(exc),
                        }
                    ],
                    suggestions=["请检查checker实现或重试"],
                    failure_mode="analysis_failed",
                ),
            )
        except (CheckerError, RuntimeError) as exc:
            logger.error("Checker '%s' unexpected error: %s", checker.name, exc, exc_info=True)
            return (
                checker.name,
                CheckerResult(
                    score=0,
                    issues=[
                        {
                            "type": "checker_error",
                            "checker": checker.name,
                            "message": str(exc),
                        }
                    ],
                    suggestions=["请检查checker实现或重试"],
                    failure_mode="analysis_failed",
                ),
            )

    def _collect_results(
        self, results: list[tuple[str, CheckerResult] | BaseException]
    ) -> dict[str, CheckerResult]:
        """Collect parallel execution results into a dict.

        Filters out exceptions (already handled by _run_checker_safe,
        but defensive here).
        """
        collected: dict[str, CheckerResult] = {}
        for item in results:
            if isinstance(item, tuple) and len(item) == 2:
                name, result = item
                collected[name] = result
            elif isinstance(item, BaseException):
                # Should not happen due to _run_checker_safe, but handle defensively
                collected["unknown"] = CheckerResult(
                    score=0,
                    issues=[{"type": "pipeline_error", "message": str(item)}],
                    suggestions=["Pipeline执行异常，请检查日志"],
                )
        return collected
