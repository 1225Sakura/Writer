/**
 * useSuggestionPanel — State management hook for AISuggestionPanel.
 * Extracted to reduce AISuggestionPanel.tsx line count.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useSettingsStore } from "@/store/settingsStore";
import { useUIStore } from "@/store/uiStore";
import type { EntityType } from "@/shared/types";
import { SEVERITY_CONFIG, mapSeverity } from "./suggestionTypes";
import type { Severity, IssueType, SuggestionItem, ReviewIteration, ReviewHistoryState } from "./suggestionTypes";
import { aiReviewApi } from "@/api/aiReview";
import { showWarning } from "@/utils/toastHelper";

export function useSuggestionPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [isReviewing, setIsReviewing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryState>({ iterations: [], currentIterationId: null });
  const historyLoaded = useRef(false);

  const prefersReducedMotion = useReducedMotion();
  const aiReviewResult = useSettingsStore((s) => s.aiReviewResult);
  const reviewWithAI = useSettingsStore((s) => s.reviewWithAI);
  const settingsCategory = useUIStore((s) => s.settingsCategory);

  // Load review history from backend on mount
  useEffect(() => {
    if (historyLoaded.current) return;
    historyLoaded.current = true;
    aiReviewApi.getReviewHistory().then((res) => {
      if (res.iterations.length > 0) {
        const iterations: ReviewIteration[] = res.iterations.map((it) => ({
          id: it.id,
          timestamp: it.timestamp,
          category: it.category as EntityType,
          issueCount: it.issue_count,
          severityCounts: it.severity_counts,
          suggestions: it.suggestions.map((s) => ({
            id: s.id,
            type: s.type as IssueType,
            severity: s.severity as Severity,
            title: s.title,
            description: s.description,
            entityIds: s.entityIds,
            entityType: s.entityType as EntityType | undefined,
            autoFixable: s.autoFixable,
            lineReference: s.lineReference,
          })),
        }));
        setReviewHistory({
          iterations,
          currentIterationId: iterations[iterations.length - 1].id,
        });
      }
    }).catch(() => { showWarning('审查历史加载失败') });
  }, []);

  const currentSuggestions: SuggestionItem[] = useMemo(() => {
    if (!aiReviewResult) return [];
    const raw = aiReviewResult.raw_response as {
      issues?: Array<{ type: string; severity: string; title: string; description: string; entityIds?: number[] }>;
      suggestions?: Array<{ title: string; description: string; type: string }>;
      category?: string;
    } | undefined;

    const issues: SuggestionItem[] = (raw?.issues || []).map((issue, index) => ({
      id: `issue_${index}`,
      type: issue.type === "inconsistency" ? "consistency" : (issue.type as IssueType),
      severity: mapSeverity(issue.severity, issue.type),
      title: issue.title, description: issue.description,
      entityIds: issue.entityIds,
      entityType: (raw?.category as EntityType) || "character",
      autoFixable: false,
      lineReference: issue.entityIds?.length ? `实体 #${issue.entityIds[0]}` : undefined,
    }));

    const suggestions: SuggestionItem[] = (raw?.suggestions || []).map((s, index) => ({
      id: `suggestion_${index}`, type: "suggestion", severity: "suggestion",
      title: s.title, description: s.description, autoFixable: s.type === "optimization",
    }));

    return [...issues, ...suggestions];
  }, [aiReviewResult]);

  useEffect(() => {
    if (currentSuggestions.length > 0 && aiReviewResult) {
      const lastIter = reviewHistory.iterations[reviewHistory.iterations.length - 1];
      const isNewResult = !lastIter || lastIter.issueCount !== currentSuggestions.length ||
        JSON.stringify(lastIter.suggestions.map((s) => s.title)) !== JSON.stringify(currentSuggestions.map((s) => s.title));
      if (isNewResult) {
        const raw = aiReviewResult.raw_response as { category?: string } | undefined;
        const newIteration: ReviewIteration = {
          id: `iter_${Date.now()}`, timestamp: new Date().toISOString(),
          category: (raw?.category as EntityType) || "character",
          issueCount: currentSuggestions.length,
          severityCounts: {
            error: currentSuggestions.filter((s) => s.severity === "error").length,
            warning: currentSuggestions.filter((s) => s.severity === "warning").length,
            suggestion: currentSuggestions.filter((s) => s.severity === "suggestion").length,
          },
          suggestions: [...currentSuggestions],
        };
        setReviewHistory((prev) => ({ iterations: [...prev.iterations, newIteration], currentIterationId: newIteration.id }));
        // Persist to backend (fire-and-forget)
        aiReviewApi.saveReviewIteration({
          id: newIteration.id,
          timestamp: newIteration.timestamp,
          category: newIteration.category,
          issue_count: newIteration.issueCount,
          severity_counts: newIteration.severityCounts,
          suggestions: newIteration.suggestions,
        }).catch(() => { showWarning('审查结果保存失败') });
      }
    }
  }, [aiReviewResult?.raw_response, currentSuggestions.length]);

  const filteredSuggestions = useMemo(() => {
    let filtered = currentSuggestions.filter((s) => !dismissed.has(s.id));
    if (severityFilter !== "all") filtered = filtered.filter((s) => s.severity === severityFilter);
    return filtered.sort((a, b) => SEVERITY_CONFIG[a.severity].priority - SEVERITY_CONFIG[b.severity].priority);
  }, [currentSuggestions, dismissed, severityFilter]);

  const severityCounts = useMemo(() => ({
    all: currentSuggestions.filter((s) => !dismissed.has(s.id)).length,
    error: currentSuggestions.filter((s) => s.severity === "error" && !dismissed.has(s.id)).length,
    warning: currentSuggestions.filter((s) => s.severity === "warning" && !dismissed.has(s.id)).length,
    suggestion: currentSuggestions.filter((s) => s.severity === "suggestion" && !dismissed.has(s.id)).length,
  }), [currentSuggestions, dismissed]);

  const handleDismiss = useCallback((id: string) => { setDismissed((prev) => new Set([...prev, id])); }, []);

  const handleApplyFix = useCallback((id: string) => {
    setAppliedIds((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setDismissed((prev) => new Set([...prev, id]));
      setAppliedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 800);
  }, []);

  const handleReReview = useCallback(async () => {
    setIsReviewing(true);
    try {
      const cats: EntityType[] = ["world", "character", "item", "location", "faction", "rule"];
      await reviewWithAI(cats.includes(settingsCategory as EntityType) ? (settingsCategory as EntityType) : "character");
    } catch { /* Error handled by store */ } finally { setIsReviewing(false); }
  }, [reviewWithAI, settingsCategory]);

  const handleLocate = useCallback((entityIds?: number[]) => {
    if (entityIds?.length) window.dispatchEvent(new CustomEvent("ai-review-locate", { detail: { entityIds } }));
  }, []);

  const handleSelectIteration = useCallback((id: string) => {
    setReviewHistory((prev) => ({ ...prev, currentIterationId: id }));
  }, []);

  const displaySuggestions = useMemo(() => {
    const currentIter = reviewHistory.iterations.find((i) => i.id === reviewHistory.currentIterationId);
    return currentIter ? currentIter.suggestions.filter((s) => !dismissed.has(s.id)) : filteredSuggestions;
  }, [reviewHistory, dismissed, filteredSuggestions]);

  return {
    isExpanded, setIsExpanded, severityFilter, setSeverityFilter,
    dismissed, setDismissed, appliedIds, isReviewing,
    showHistory, setShowHistory, showComparison, setShowComparison,
    reviewHistory, prefersReducedMotion,
    currentSuggestions, severityCounts, displaySuggestions,
    hasMultipleIterations: reviewHistory.iterations.length >= 2,
    handleDismiss, handleApplyFix, handleReReview, handleLocate, handleSelectIteration,
  };
}
