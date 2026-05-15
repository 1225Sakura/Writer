/**
 * CheckerScoreOverview — Aggregate score display for all checkers.
 * Extracted from CheckerResults.tsx.
 */

import { CircularProgress } from "@/components/ui/CircularProgress";
import type { CheckerConfig, CheckerResult } from "./AICheckerPanel";
import { getScoreColor, getScoreLabel } from "./AICheckerPanel";

export function ScoreOverview({
  results,
  checkers,
}: {
  results: Map<string, CheckerResult>;
  checkers: CheckerConfig[];
}) {
  const scores = checkers
    .map((c) => {
      const r = results.get(c.key);
      return r?.data ? { key: c.key, label: c.label, score: r.data.score, color: c.color } : null;
    })
    .filter(Boolean) as Array<{ key: string; label: string; score: number; color: string }>;

  if (scores.length === 0) return null;

  const avgScore = Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length);

  return (
    <div
      className="p-3 rounded-xl mb-3"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center gap-3">
        <CircularProgress
          value={avgScore}
          size={48}
          strokeWidth={3}
          color={getScoreColor(avgScore)}
          trackColor="var(--border-subtle)"
          showPercentage={true}
        />
        <div className="flex-1">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>综合质量评分</div>
          <div className="text-sm font-semibold" style={{ color: getScoreColor(avgScore) }}>
            {getScoreLabel(avgScore)} ({avgScore}分)
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {scores.map((s) => (
          <div key={s.key} className="text-center">
            <div className="text-xs font-bold" style={{ color: s.color }}>{s.score}</div>
            <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
