/**
 * ReviewHistoryDrawer — Slide-out drawer showing review iteration history.
 * Extracted from SuggestionFilters.tsx.
 */

import { X, History, Clock } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { motion, AnimatePresence } from "framer-motion";
import { DURATION, EASE } from "@/components/shared/AnimationConfig";
import type { ReviewIteration } from "./suggestionTypes";

export function ReviewHistoryDrawer({
  isOpen,
  onClose,
  history,
  currentIterationId,
  onSelectIteration,
}: {
  isOpen: boolean;
  onClose: () => void;
  history: ReviewIteration[];
  currentIterationId: string | null;
  onSelectIteration: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            className="absolute right-0 top-0 bottom-0 z-40 w-[var(--sidebar-outline-width)] flex flex-col bg-[var(--color-surface-base)] border-l border-[var(--border-subtle)]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Icon icon={History} size="sm" color="muted" />
                <span className="text-sm font-medium text-[var(--text-primary)]">审查历史</span>
              </div>
              <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors">
                <Icon icon={X} size="sm" color="muted" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <Icon icon={Clock} size="lg" color="muted" className="mx-auto mb-2" />
                  <p className="text-xs text-[var(--text-tertiary)]">暂无审查记录</p>
                </div>
              ) : (
                history.map((iteration, index) => {
                  const isActive = iteration.id === currentIterationId;
                  const date = new Date(iteration.timestamp);
                  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

                  return (
                    <motion.button
                      key={iteration.id}
                      onClick={() => onSelectIteration(iteration.id)}
                      className="w-full text-left rounded-xl p-3 transition-all"
                      style={{
                        backgroundColor: isActive ? "var(--accent-muted)" : "var(--color-surface-raised)",
                        border: `1px solid ${isActive ? "var(--accent-primary)25" : "var(--border-subtle)"}`,
                      }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: isActive ? "var(--accent-primary)" : "var(--text-primary)" }}>
                          第 {history.length - index} 次审查
                        </span>
                        <span className="text-[10px] text-[var(--text-disabled)]">{timeStr}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {iteration.severityCounts.error > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-danger)15", color: "var(--color-danger)" }}>
                            {iteration.severityCounts.error} 错误
                          </span>
                        )}
                        {iteration.severityCounts.warning > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-character)15", color: "var(--color-character)" }}>
                            {iteration.severityCounts.warning} 警告
                          </span>
                        )}
                        {iteration.severityCounts.suggestion > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-outline)15", color: "var(--color-outline)" }}>
                            {iteration.severityCounts.suggestion} 建议
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
