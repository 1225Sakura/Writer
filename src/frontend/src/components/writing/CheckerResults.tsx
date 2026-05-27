/**
 * CheckerResults — Checker card, score overview, and specialized displays.
 * Extracted from AICheckerPanel.tsx.
 */

import { useState } from "react";
import { useSettingsStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  X,
  Play,
  Loader2,
} from "lucide-react";
import { DURATION, EASE } from "@/components/shared/AnimationConfig";
import type { CheckerConfig, CheckerResult } from "./AICheckerPanel";
import { getScoreColor, getScoreLabel } from "./AICheckerPanel";
import { SpecializedDisplay } from "./SpecializedDisplay";

export { ScoreOverview } from "./CheckerScoreOverview";

export function CheckerCard({
  config,
  result,
  onRun,
  selectedCharacterId,
  onCharacterChange,
}: {
  config: CheckerConfig;
  result: CheckerResult | undefined;
  onRun: () => void;
  selectedCharacterId: number | null;
  onCharacterChange: (id: number | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { characters } = useSettingsStore();

  const isLoading = result?.loading ?? false;
  const hasData = result?.data !== null;
  const score = result?.data?.score ?? 0;
  const issues = result?.data?.issues ?? [];
  const suggestions = result?.data?.suggestions ?? [];

  return (
    <motion.div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
      }}
      whileHover={{ borderColor: 'var(--border-strong)' }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      {/* Card Header */}
      <button
        onClick={() => hasData && setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`${config.label} - ${expanded ? '收起详情' : '展开详情'}`}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-colors hover:bg-[var(--hover-bg)]"
      >
        <span
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{
            background: `color-mix(in srgb, ${config.color} 15%, transparent)`,
            color: config.color,
          }}
        >
          {config.icon}
        </span>
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{config.label}</div>
          <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>{config.description}</div>
        </div>

        {hasData && (
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: `color-mix(in srgb, ${getScoreColor(score)} 9%, transparent)`,
                color: getScoreColor(score),
              }}
            >
              {score}分
            </span>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </motion.div>
          </div>
        )}

        {!hasData && !isLoading && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium"
            style={{
              background: `color-mix(in srgb, ${config.color} 15%, transparent)`,
              color: config.color,
            }}
          >
            <Play className="w-3 h-3" />
            检查
          </motion.button>
        )}

        {isLoading && (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: config.color }} />
        )}
      </button>

      {/* Character selector for OOC checker */}
      <AnimatePresence>
        {config.key === 'ooc' && !hasData && !isLoading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5">
              <select
                value={selectedCharacterId ?? ''}
                onChange={(e) => onCharacterChange(e.target.value ? Number(e.target.value) : null)}
                aria-label="选择要检查的角色"
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border bg-[var(--color-surface-base)] text-[var(--text-primary)]"
                style={{ borderColor: 'var(--border-default)' }}
              >
                <option value="">选择要检查的角色</option>
                {characters.map((char) => (
                  <option key={char.id} value={char.id}>{char.name}</option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && hasData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            className="overflow-hidden"
          >
            <div
              className="px-3 pb-3 pt-1 space-y-2"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              {/* Score bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  <span>质量评分</span>
                  <span style={{ color: getScoreColor(score) }}>{getScoreLabel(score)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: config.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>

              {/* Issues */}
              {issues.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'var(--color-vermillion)' }}>
                    <AlertCircle className="w-3 h-3" />
                    发现问题 ({issues.length})
                  </div>
                  {issues.map((issue, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-1.5 p-1.5 rounded-lg text-xs"
                      style={{
                        background: 'color-mix(in srgb, var(--color-vermillion) 6%, transparent)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <X className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-vermillion)' }} />
                      <span>{issue}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: 'var(--color-ifline)' }}>
                    <Lightbulb className="w-3 h-3" />
                    改进建议 ({suggestions.length})
                  </div>
                  {suggestions.map((suggestion, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-1.5 p-1.5 rounded-lg text-xs"
                      style={{
                        background: 'color-mix(in srgb, var(--color-ifline) 6%, transparent)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-ifline)' }} />
                      <span>{suggestion}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* No issues */}
              {issues.length === 0 && suggestions.length === 0 && (
                <div
                  className="flex items-center gap-2 p-2 rounded-lg text-xs"
                  style={{
                    background: 'color-mix(in srgb, var(--color-ifline) 8%, transparent)',
                    color: 'var(--color-ifline)',
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  未发现问题，表现优秀！
                </div>
              )}

              {/* Specialized displays */}
              <SpecializedDisplay config={config} data={result?.data} />

              {/* Re-run button */}
              <button
                onClick={onRun}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all disabled:opacity-50"
                style={{
                  background: `color-mix(in srgb, ${config.color} 10%, transparent)`,
                  color: config.color,
                  border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)`,
                }}
              >
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                重新检查
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

