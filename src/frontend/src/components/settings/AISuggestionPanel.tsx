/**
 * AISuggestionPanel — AI review suggestions panel.
 * Sub-components: SuggestionCard, SuggestionFilters. Types: suggestionTypes. Hook: useSuggestionPanel.
 */

import { ChevronDown, Sparkles, RotateCw, History, ArrowRight, Wand2, ThumbsUp } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { motion, AnimatePresence } from "framer-motion";
import { DURATION, EASE, SPRING } from "@/components/shared/AnimationConfig";
import { SuggestionCard, SkeletonCard } from "./SuggestionCard";
import { SeverityFilterTabs, ReviewHistoryDrawer, IterationComparisonView } from "./SuggestionFilters";
import { SEVERITY_CONFIG, containerVariants, pulseGlowVariants, shimmerVariants } from "./suggestionTypes";
import { useSuggestionPanel } from "./useSuggestionPanel";

export type { Severity, SuggestionItem, ReviewIteration, ReviewHistoryState, IssueType } from "./suggestionTypes";
export { SEVERITY_CONFIG, ISSUE_TYPE_LABELS, cardVariants } from "./suggestionTypes";

export function AISuggestionPanel() {
  const s = useSuggestionPanel();

  return (
    <div className="relative bg-[var(--color-surface-base)]">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-100)] to-transparent opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-8 opacity-[0.04] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, var(--accent-100), transparent 70%)" }} />

      {/* Header */}
      <motion.button onClick={() => s.setIsExpanded(!s.isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between transition-all hover:bg-[var(--color-surface-raised)] relative overflow-hidden"
        style={{
          borderBottom: s.isExpanded ? "1px solid var(--border-subtle)" : "none",
          background: s.isReviewing ? "linear-gradient(135deg, color-mix(in srgb, var(--accent-100) 8%, transparent) 0%, var(--color-surface-base) 60%)" : "transparent",
        }}
        animate={s.isReviewing ? "active" : "idle"} variants={pulseGlowVariants}>
        {s.isReviewing && !s.prefersReducedMotion && (
          <motion.div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, var(--accent-glow), transparent)", backgroundSize: "200% 100%" }}
            animate={{ backgroundPosition: ["200% 0", "-200% 0"] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
        )}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="relative">
            <motion.div animate={s.isReviewing && !s.prefersReducedMotion ? { rotate: [0, 15, -15, 0] } : { rotate: 0 }}
              transition={s.isReviewing && !s.prefersReducedMotion ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}>
              <Icon icon={Sparkles} size="sm" color="accent" />
            </motion.div>
            {s.isReviewing && !s.prefersReducedMotion && (
              <motion.div className="absolute inset-0 rounded-full" style={{ border: "1px solid var(--accent-primary)" }}
                animate={{ scale: [1, 1.8], opacity: [0.6, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }} />
            )}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">AI 审查建议</span>
            {s.isReviewing && <span className="text-[10px] text-[var(--accent-primary)] animate-pulse">正在分析设定...</span>}
          </div>
          {s.severityCounts.all > 0 && !s.isReviewing && (
            <div className="flex items-center gap-1">
              {s.severityCounts.error > 0 && (
                <motion.span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-danger) 8%, transparent)", color: "var(--color-danger)" }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.BADGE}>{s.severityCounts.error}</motion.span>
              )}
              {s.severityCounts.warning > 0 && (
                <motion.span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-character) 8%, transparent)", color: "var(--color-character)" }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.BADGE, delay: 0.05 }}>{s.severityCounts.warning}</motion.span>
              )}
              {s.severityCounts.suggestion > 0 && (
                <motion.span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: "color-mix(in srgb, var(--color-outline) 8%, transparent)", color: "var(--color-outline)" }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.BADGE, delay: 0.05 }}>{s.severityCounts.suggestion}</motion.span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {s.reviewHistory.iterations.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); s.setShowHistory(true); }} className="p-1.5 rounded hover:bg-white/10 transition-colors" title="审查历史">
              <Icon icon={History} size="xs" color="muted" />
            </button>
          )}
          {s.hasMultipleIterations && (
            <button onClick={(e) => { e.stopPropagation(); s.setShowComparison(true); }} className="p-1.5 rounded hover:bg-white/10 transition-colors" title="审查对比">
              <Icon icon={ArrowRight} size="xs" color="muted" />
            </button>
          )}
          <motion.div animate={{ rotate: s.isExpanded ? 0 : 180 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}>
            <Icon icon={ChevronDown} size="sm" color="muted" />
          </motion.div>
        </div>
      </motion.button>

      {/* Content */}
      <AnimatePresence mode="wait">
        {s.isExpanded && (
          <motion.div className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}>
            {s.currentSuggestions.length > 0 && (
              <SeverityFilterTabs counts={s.severityCounts} activeFilter={s.severityFilter} onFilterChange={s.setSeverityFilter} />
            )}
            <div className="px-4 pb-4 pt-2 space-y-2.5 max-h-[400px] overflow-y-auto scrollbar-ink">
              <AnimatePresence>
                {s.isReviewing && s.displaySuggestions.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                    <SkeletonCard /><SkeletonCard /><SkeletonCard />
                  </motion.div>
                )}
              </AnimatePresence>

              {!s.isReviewing && s.displaySuggestions.length === 0 ? (
                <motion.div className="text-center py-8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}>
                  <motion.div className="relative inline-block" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.SNAPPY, delay: 0.1 }}>
                    <div className="absolute inset-0 rounded-full bg-[var(--color-success)] opacity-10 blur-xl" />
                    <Icon icon={ThumbsUp} size="lg" color="success" className="mx-auto mb-3 relative z-10" />
                  </motion.div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    {s.severityFilter !== "all" ? `暂无${SEVERITY_CONFIG[s.severityFilter].label}级别的问题` : "设定一致，暂无建议"}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">AI 已完成审查，未发现明显问题</p>
                  {s.severityFilter !== "all" && (
                    <button onClick={() => s.setSeverityFilter("all")} className="text-xs mt-2 hover:underline text-[var(--accent-primary)] transition-colors">查看全部</button>
                  )}
                </motion.div>
              ) : (
                <motion.div variants={containerVariants} initial="hidden" animate="visible" exit="exit">
                  <AnimatePresence>
                    {s.displaySuggestions.map((suggestion) => (
                      <SuggestionCard key={suggestion.id} suggestion={suggestion} isApplied={s.appliedIds.has(suggestion.id)}
                        onDismiss={() => s.handleDismiss(suggestion.id)} onApplyFix={() => s.handleApplyFix(suggestion.id)}
                        onClickLocate={() => s.handleLocate(suggestion.entityIds)} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}

              <AnimatePresence>
                {s.displaySuggestions.length > 0 && (
                  <motion.div className="flex gap-2 pt-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    transition={{ delay: Math.min(s.displaySuggestions.length * 0.05 + 0.05, 0.3) }}>
                    <motion.button onClick={() => s.displaySuggestions.filter((i) => i.autoFixable).forEach((i) => s.handleApplyFix(i.id))}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all relative overflow-hidden"
                      style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--color-success) 12%, transparent) 0%, color-mix(in srgb, var(--color-success) 6%, transparent) 100%)", color: "var(--color-success)", border: "1px solid color-mix(in srgb, var(--color-success) 25%, transparent)" }}
                      whileHover={{ scale: 1.01, boxShadow: "0 0 14px color-mix(in srgb, var(--color-success) 30%, transparent)" }} whileTap={{ scale: 0.98 }}>
                      <Icon icon={Wand2} size="xs" color="success" className="inline-block mr-1 -mt-0.5" />应用所有修复
                    </motion.button>
                    <motion.button onClick={() => s.setDismissed(new Set(s.displaySuggestions.map((i) => i.id)))}
                      className="flex-1 py-2 rounded-xl text-xs font-medium transition-all bg-transparent text-[var(--text-tertiary)] border border-[var(--border-default)] hover:bg-white/5 hover:text-[var(--text-secondary)]"
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>全部忽略</motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-3">
                <motion.button onClick={s.handleReReview} disabled={s.isReviewing}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 relative overflow-hidden"
                  style={{
                    background: s.isReviewing ? "linear-gradient(135deg, color-mix(in srgb, var(--accent-100) 15%, transparent) 0%, color-mix(in srgb, var(--accent-100) 8%, transparent) 100%)" : "linear-gradient(135deg, color-mix(in srgb, var(--accent-100) 12%, transparent) 0%, color-mix(in srgb, var(--accent-100) 6%, transparent) 100%)",
                    color: "var(--accent-primary)", border: "1px solid color-mix(in srgb, var(--accent-100) 25%, transparent)",
                  }}
                  whileHover={!s.isReviewing ? { scale: 1.01, boxShadow: "0 0 18px color-mix(in srgb, var(--accent-100) 30%, transparent), 0 0 36px color-mix(in srgb, var(--accent-100) 15%, transparent)" } : {}}
                  whileTap={!s.isReviewing ? { scale: 0.98 } : {}}>
                  {s.isReviewing && !s.prefersReducedMotion && (
                    <motion.div className="absolute inset-0"
                      style={{ background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-100) 10%, transparent) 50%, transparent 100%)", backgroundSize: "200% 100%" }}
                      variants={shimmerVariants} initial="initial" animate="animate" />
                  )}
                  <motion.div className="relative z-10" animate={s.isReviewing && !s.prefersReducedMotion ? { rotate: 360 } : { rotate: 0 }}
                    transition={s.isReviewing && !s.prefersReducedMotion ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
                    <Icon icon={RotateCw} size="xs" color="accent" />
                  </motion.div>
                  <span className="relative z-10">{s.isReviewing ? "审查中..." : "重新审查"}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ReviewHistoryDrawer isOpen={s.showHistory} onClose={() => s.setShowHistory(false)} history={s.reviewHistory.iterations}
        currentIterationId={s.reviewHistory.currentIterationId} onSelectIteration={(id) => { s.handleSelectIteration(id); s.setShowHistory(false); }} />

      <AnimatePresence>
        {s.showComparison && s.hasMultipleIterations && (
          <IterationComparisonView iterations={s.reviewHistory.iterations} onClose={() => s.setShowComparison(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
