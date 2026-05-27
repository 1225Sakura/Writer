/**
 * SuggestionCard — Individual suggestion card and skeleton loader.
 * Extracted from AISuggestionPanel.tsx.
 */

import { useState } from "react";
import { ChevronDown, Info, X, Wand2 } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { DURATION, EASE } from "@/components/shared/AnimationConfig";
import type { SuggestionItem } from "./suggestionTypes";
import { SEVERITY_CONFIG, ISSUE_TYPE_LABELS, cardVariants } from "./suggestionTypes";

// ============================================
// Skeleton Card
// ============================================

export function SkeletonCard() {
  return (
    <GlassCard
      intensity="light"
      border="subtle"
      padding="md"
      rounded="lg"
      className="space-y-2.5"
    >
      <div className="flex items-center gap-2">
        <div
          className="w-16 h-5 rounded-md animate-shimmer"
          style={{
            background:
              "linear-gradient(90deg, var(--color-surface-overlay) 25%, var(--border-subtle) 50%, var(--color-surface-overlay) 75%)",
            backgroundSize: "200% 100%",
          }}
        />
        <div
          className="w-14 h-5 rounded-md animate-shimmer"
          style={{
            background:
              "linear-gradient(90deg, var(--color-surface-overlay) 25%, var(--border-subtle) 50%, var(--color-surface-overlay) 75%)",
            backgroundSize: "200% 100%",
          }}
        />
      </div>
      <div
        className="w-3/4 h-4 rounded-md animate-shimmer"
        style={{
          background:
            "linear-gradient(90deg, var(--color-surface-overlay) 25%, var(--border-subtle) 50%, var(--color-surface-overlay) 75%)",
          backgroundSize: "200% 100%",
        }}
      />
      <div
        className="w-full h-3 rounded-md animate-shimmer"
        style={{
          background:
            "linear-gradient(90deg, var(--color-surface-overlay) 25%, var(--border-subtle) 50%, var(--color-surface-overlay) 75%)",
          backgroundSize: "200% 100%",
        }}
      />
    </GlassCard>
  );
}

// ============================================
// Suggestion Card
// ============================================

export function SuggestionCard({
  suggestion,
  isApplied,
  onDismiss,
  onApplyFix,
  onClickLocate,
}: {
  suggestion: SuggestionItem;
  isApplied: boolean;
  onDismiss: () => void;
  onApplyFix: () => void;
  onClickLocate: () => void;
}) {
  const config = SEVERITY_CONFIG[suggestion.severity];
  const SeverityIcon = config.icon;
  const [isExpanded, setIsExpanded] = useState(false);

  const accentBorderColor = config.colors.badge;

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="rounded-xl group overflow-hidden relative"
      style={{
        background: isApplied
          ? "linear-gradient(135deg, rgba(94,181,166,0.08) 0%, var(--color-surface-raised) 100%)"
          : config.gradient,
        border: `1px solid ${isApplied ? "rgba(94,181,166,0.2)" : "var(--border-subtle)"}`,
      }}
      whileHover={!isApplied ? {
        scale: 1.01,
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
      } : {}}
      onMouseEnter={(e) => {
        if (!isApplied) {
          e.currentTarget.style.background =
            "linear-gradient(135deg, rgba(201,169,110,0.06) 0%, var(--color-surface-overlay) 100%)";
          e.currentTarget.style.borderColor = `${config.colors.border}`;
          e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px color-mix(in srgb, ${config.colors.glow} 31%, transparent), 0 0 24px color-mix(in srgb, ${config.colors.glow} 19%, transparent)`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isApplied) {
          e.currentTarget.style.background = config.gradient;
          e.currentTarget.style.borderColor = "var(--border-subtle)";
          e.currentTarget.style.boxShadow = "none";
        }
      }}
      exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0, padding: 0 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      {/* Gradient left border accent with glow */}
      <div
        className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full"
        style={{
          background: isApplied
            ? "var(--color-success)"
            : `linear-gradient(180deg, color-mix(in srgb, ${accentBorderColor} 56%, transparent), ${accentBorderColor}, color-mix(in srgb, ${accentBorderColor} 56%, transparent))`,
          boxShadow: isApplied
            ? "0 0 10px color-mix(in srgb, var(--color-success) 31%, transparent)"
            : `0 0 10px color-mix(in srgb, ${accentBorderColor} 31%, transparent)`,
        }}
      />

      <div className="p-3.5 pl-4.5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Severity + Type badges */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <span
                className="text-[10px] px-2 py-0.5 rounded-md font-medium flex items-center gap-1"
                style={{
                  backgroundColor: config.colors.bg,
                  color: config.colors.text,
                  boxShadow: `0 0 8px color-mix(in srgb, ${config.colors.glow} 13%, transparent)`,
                }}
              >
                <Icon icon={SeverityIcon} size="xs" color="inherit" />
                {config.label}
              </span>
              {ISSUE_TYPE_LABELS[suggestion.type] && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]">
                  {ISSUE_TYPE_LABELS[suggestion.type]}
                </span>
              )}
              {suggestion.lineReference && (
                <button
                  onClick={onClickLocate}
                  className="text-[10px] px-2 py-0.5 rounded-md hover:bg-white/10 transition-colors flex items-center gap-1 bg-[var(--accent-muted)] text-[var(--accent-primary)]"
                  title="定位到相关实体"
                >
                  <Icon icon={Info} size="xs" color="accent" />
                  定位
                </button>
              )}
            </div>

            {/* Title */}
            <p className="text-sm font-medium mb-1.5 text-[var(--text-primary)]">
              {suggestion.title}
            </p>

            {/* Description - expandable */}
            <motion.div
              initial={false}
              animate={{ height: isExpanded ? "auto" : "3.2em" }}
              transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
              className="overflow-hidden"
            >
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                {suggestion.description}
              </p>
            </motion.div>

            {/* Expand/collapse hint */}
            {suggestion.description.length > 80 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[10px] mt-1.5 text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors flex items-center gap-0.5"
              >
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                >
                  <Icon icon={ChevronDown} size="xs" color="accent" />
                </motion.span>
                {isExpanded ? "收起" : "展开"}
              </button>
            )}
          </div>

          {/* Action buttons - refined styling */}
          <div className="flex gap-0.5 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {suggestion.autoFixable && (
              <motion.button
                onClick={onApplyFix}
                className="p-1.5 rounded-lg transition-all relative overflow-hidden"
                style={{
                  color: isApplied
                    ? "var(--color-success)"
                    : "var(--text-tertiary)",
                  backgroundColor: isApplied
                    ? "rgba(94,181,166,0.15)"
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isApplied) {
                    e.currentTarget.style.backgroundColor =
                      "rgba(94,181,166,0.15)";
                    e.currentTarget.style.color = "var(--color-success)";
                    e.currentTarget.style.boxShadow =
                      "0 0 10px rgba(94,181,166,0.35)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isApplied) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-tertiary)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
                title="自动修复"
                whileTap={{ scale: 0.85 }}
                disabled={isApplied}
              >
                <Icon icon={Wand2} size="xs" color="inherit" />
              </motion.button>
            )}
            <motion.button
              onClick={onDismiss}
              className="p-1.5 rounded-lg transition-all text-[var(--text-tertiary)]"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "var(--color-surface-overlay)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-tertiary)";
              }}
              title="忽略"
              whileTap={{ scale: 0.85 }}
            >
              <Icon icon={X} size="xs" color="inherit" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
