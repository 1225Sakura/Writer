/**
 * SuggestionFilters — Severity filter tabs + re-exports for drawer/comparison.
 * Extracted from AISuggestionPanel.tsx.
 */

import { motion } from "framer-motion";
import { SPRING } from "@/components/shared/AnimationConfig";
import type { Severity } from "./suggestionTypes";
import { SEVERITY_CONFIG } from "./suggestionTypes";

export { ReviewHistoryDrawer } from "./ReviewHistoryDrawer";
export { IterationComparisonView } from "./IterationComparisonView";

export function SeverityFilterTabs({
  counts,
  activeFilter,
  onFilterChange,
}: {
  counts: Record<Severity | "all", number>;
  activeFilter: Severity | "all";
  onFilterChange: (filter: Severity | "all") => void;
}) {
  const tabs: Array<{ key: Severity | "all"; label: string; color: string }> = [
    { key: "all", label: "全部", color: "var(--text-tertiary)" },
    { key: "error", label: "错误", color: SEVERITY_CONFIG.error.colors.badge },
    {
      key: "warning",
      label: "警告",
      color: SEVERITY_CONFIG.warning.colors.badge,
    },
    {
      key: "suggestion",
      label: "建议",
      color: SEVERITY_CONFIG.suggestion.colors.badge,
    },
  ];

  return (
    <div className="flex items-center gap-1 px-4 pt-2 pb-1">
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.key;
        const count = counts[tab.key];
        return (
          <motion.button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
            style={{
              backgroundColor: isActive ? `color-mix(in srgb, ${tab.color} 9%, transparent)` : "transparent",
              color: isActive ? tab.color : "var(--text-tertiary)",
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={(e) => {
              if (!isActive)
                e.currentTarget.style.backgroundColor =
                  "var(--color-surface-overlay)";
            }}
            onMouseLeave={(e) => {
              if (!isActive)
                e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {tab.label}
            {count > 0 && (
              <motion.span
                className="text-[10px] px-1.5 py-0 rounded-full font-medium"
                style={{
                  backgroundColor: isActive
                    ? `color-mix(in srgb, ${tab.color} 15%, transparent)`
                    : "var(--color-surface-overlay)",
                  color: isActive ? tab.color : "var(--text-disabled)",
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={SPRING.BADGE}
              >
                {count}
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
