/**
 * IterationComparisonView — Side-by-side comparison of two review iterations.
 * Extracted from SuggestionFilters.tsx.
 */

import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight as ChevronRightIcon, X, Check } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { motion } from "framer-motion";
import type { ReviewIteration } from "./suggestionTypes";
import { SEVERITY_CONFIG } from "./suggestionTypes";

export function IterationComparisonView({
  iterations,
  onClose,
}: {
  iterations: ReviewIteration[];
  onClose: () => void;
}) {
  const [leftIndex, setLeftIndex] = useState(Math.max(0, iterations.length - 2));
  const [rightIndex, setRightIndex] = useState(Math.max(0, iterations.length - 1));

  const leftIter = iterations[leftIndex];
  const rightIter = iterations[rightIndex];

  if (!leftIter || !rightIter) return null;

  const leftIds = new Set(leftIter.suggestions.map((s) => s.id));
  const rightIds = new Set(rightIter.suggestions.map((s) => s.id));
  const resolvedIds = [...leftIds].filter((id) => !rightIds.has(id));
  const newIds = [...rightIds].filter((id) => !leftIds.has(id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-[var(--color-surface-base)] border-t border-[var(--border-default)]"
      style={{ maxHeight: "70%", boxShadow: "var(--shadow-float)" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Icon icon={ArrowRight} size="sm" color="accent" />
          <span className="text-sm font-medium text-[var(--text-primary)]">审查对比</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
          <Icon icon={X} size="sm" color="muted" />
        </button>
      </div>

      <div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.04]">
        <div className="flex-1">
          <span className="text-[10px] text-[var(--text-tertiary)]">较早版本</span>
          <div className="flex items-center gap-1 mt-0.5">
            <button onClick={() => setLeftIndex(Math.max(0, leftIndex - 1))} disabled={leftIndex === 0} className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-opacity">
              <Icon icon={ChevronLeft} size="xs" color="muted" />
            </button>
            <span className="text-xs font-medium text-[var(--text-primary)]">第 {leftIndex + 1} 次</span>
            <button onClick={() => setLeftIndex(Math.min(rightIndex - 1, leftIndex + 1))} disabled={leftIndex >= rightIndex - 1} className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-opacity">
              <Icon icon={ChevronRightIcon} size="xs" color="muted" />
            </button>
          </div>
        </div>
        <Icon icon={ArrowRight} size="sm" color="muted" className="flex-shrink-0" />
        <div className="flex-1">
          <span className="text-[10px] text-[var(--text-tertiary)]">较晚版本</span>
          <div className="flex items-center gap-1 mt-0.5">
            <button onClick={() => setRightIndex(Math.max(leftIndex + 1, rightIndex - 1))} disabled={rightIndex <= leftIndex + 1} className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-opacity">
              <Icon icon={ChevronLeft} size="xs" color="muted" />
            </button>
            <span className="text-xs font-medium text-[var(--text-primary)]">第 {rightIndex + 1} 次</span>
            <button onClick={() => setRightIndex(Math.min(iterations.length - 1, rightIndex + 1))} disabled={rightIndex >= iterations.length - 1} className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 transition-opacity">
              <Icon icon={ChevronRightIcon} size="xs" color="muted" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-tertiary)]">已解决:</span>
          <span className="text-xs font-medium text-[var(--color-success)]">{resolvedIds.length} 项</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-tertiary)]">新增:</span>
          <span className="text-xs font-medium text-[var(--color-character)]">{newIds.length} 项</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-tertiary)]">剩余:</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{rightIter.issueCount} 项</span>
        </div>
      </div>

      <div className="overflow-y-auto p-3 space-y-2" style={{ maxHeight: "calc(70vh - 140px)" }}>
        {rightIter.suggestions.map((suggestion) => {
          const isNew = newIds.includes(suggestion.id);
          const config = SEVERITY_CONFIG[suggestion.severity];
          const SuggIcon = config.icon;

          return (
            <div key={suggestion.id} className="p-2.5 rounded-xl" style={{ backgroundColor: isNew ? "var(--color-character)06" : "var(--color-surface-raised)", border: `1px solid ${isNew ? "var(--color-character)15" : "var(--border-subtle)"}` }}>
              <div className="flex items-center gap-2 mb-1">
                {isNew && <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "var(--color-character)15", color: "var(--color-character)" }}>新增</span>}
                <SuggIcon className="w-3 h-3" style={{ color: config.colors.badge }} />
                <span className="text-xs font-medium text-[var(--text-primary)]">{suggestion.title}</span>
              </div>
              <p className="text-[11px] pl-5 text-[var(--text-tertiary)]">{suggestion.description}</p>
            </div>
          );
        })}

        {resolvedIds.length > 0 && (
          <div className="pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <p className="text-[10px] mb-2 text-[var(--text-disabled)]">已解决的问题</p>
            {resolvedIds.map((id) => {
              const suggestion = leftIter.suggestions.find((s) => s.id === id);
              if (!suggestion) return null;
              return (
                <div key={id} className="p-2.5 rounded-xl opacity-50" style={{ backgroundColor: "var(--color-success)06", border: "1px solid var(--color-success)10" }}>
                  <div className="flex items-center gap-2">
                    <Icon icon={Check} size="xs" color="success" />
                    <span className="text-xs line-through text-[var(--text-tertiary)]">{suggestion.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
