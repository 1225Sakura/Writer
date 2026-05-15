/**
 * SpecializedDisplay — Checker-specific detail displays.
 * Extracted from CheckerResults.tsx.
 */

import { motion } from "framer-motion";
import {
  AlertCircle,
  Flame,
  TrendingUp,
  Zap,
  BookOpen,
  Magnet,
} from "lucide-react";
import { DURATION, EASE } from "@/components/shared/AnimationConfig";
import type {
  ContinuityCheckResponse,
  PacingCheckResponse,
  OOCCheckResponse,
  HighPointCheckResponse,
  ReaderPullCheckResponse,
} from "@/api/types";
import type { CheckerConfig, CheckerResult } from "./AICheckerPanel";

export function SpecializedDisplay({
  config,
  data,
}: {
  config: CheckerConfig;
  data: CheckerResult["data"];
}) {
  if (!data) return null;

  switch (config.key) {
    case "continuity": {
      const continuity = data as ContinuityCheckResponse;
      if (!continuity.plot_thread_status || continuity.plot_thread_status.length === 0)
        return null;
      return (
        <div className="space-y-1">
          <div className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            伏笔状态
          </div>
          {continuity.plot_thread_status.map((threadStatus, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs px-2 py-1 rounded-md"
              style={{ background: "var(--color-surface-base)" }}
            >
              <span style={{ color: "var(--text-secondary)" }}>{threadStatus.title}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: threadStatus.fulfilled
                    ? "color-mix(in srgb, var(--color-ifline) 18%, transparent)"
                    : "color-mix(in srgb, var(--color-character) 18%, transparent)",
                  color: threadStatus.fulfilled ? "var(--color-ifline)" : "var(--color-character)",
                }}
              >
                {threadStatus.fulfilled ? "已呼应" : "待呼应"}
              </span>
            </div>
          ))}
        </div>
      );
    }

    case "pacing": {
      const pacing = data as PacingCheckResponse;
      if (!pacing.strand_ratios || pacing.strand_ratios.length === 0) return null;
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            故事线比例
          </div>
          {pacing.strand_ratios.map((strand, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--text-secondary)" }}>{strand.strand}</span>
                <span className="tabular-nums font-medium" style={{ color: config.color }}>
                  {strand.percentage}%
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border-subtle)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: config.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${strand.percentage}%` }}
                  transition={{ duration: DURATION.SLOW, delay: i * 0.1, ease: EASE.SMOOTH }}
                />
              </div>
            </div>
          ))}
          {pacing.analysis && (
            <div
              className="text-xs leading-relaxed p-2 rounded-lg"
              style={{ background: "var(--color-surface-base)", color: "var(--text-secondary)" }}
            >
              {pacing.analysis}
            </div>
          )}
        </div>
      );
    }

    case "ooc": {
      const ooc = data as OOCCheckResponse;
      if (!ooc.violations || ooc.violations.length === 0) return null;
      return (
        <div className="space-y-1">
          <div className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
            OOC 违规 ({ooc.violations.length})
          </div>
          {ooc.violations.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-2 rounded-lg space-y-1"
              style={{
                background: "color-mix(in srgb, var(--color-vermillion) 5%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-vermillion) 10%, transparent)",
              }}
            >
              <div className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                {v.location}
              </div>
              <div className="text-xs space-y-0.5">
                <div className="flex gap-1.5">
                  <span style={{ color: "var(--text-tertiary)" }}>期望:</span>
                  <span style={{ color: "var(--color-ifline)" }}>{v.expected_behavior}</span>
                </div>
                <div className="flex gap-1.5">
                  <span style={{ color: "var(--text-tertiary)" }}>实际:</span>
                  <span style={{ color: "var(--vermillion-100)" }}>{v.actual_behavior}</span>
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{v.reason}</div>
              </div>
            </motion.div>
          ))}
        </div>
      );
    }

    case "highPoint": {
      const hp = data as HighPointCheckResponse;
      return (
        <div className="space-y-2">
          {hp.excitement_density && (
            <div
              className="flex items-center gap-2 text-xs p-2 rounded-lg"
              style={{ background: "var(--color-surface-base)" }}
            >
              <TrendingUp className="w-3.5 h-3.5" style={{ color: config.color }} />
              <span style={{ color: "var(--text-secondary)" }}>{hp.excitement_density}</span>
            </div>
          )}
          {hp.ending_hook && (
            <div
              className="flex items-center gap-2 text-xs p-2 rounded-lg"
              style={{ background: "var(--color-surface-base)" }}
            >
              <Zap className="w-3.5 h-3.5" style={{ color: config.color }} />
              <span style={{ color: "var(--text-secondary)" }}>{hp.ending_hook}</span>
            </div>
          )}
          {hp.high_points && hp.high_points.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                高潮点 ({hp.high_points.length})
              </div>
              {hp.high_points.map((point, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs px-2 py-1 rounded-md"
                  style={{ background: "var(--color-surface-base)" }}
                >
                  <Flame className="w-3 h-3" style={{ color: config.color }} />
                  <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                    {point.location}
                  </span>
                  <span className="text-[10px] tabular-nums font-medium" style={{ color: config.color }}>
                    {point.intensity}/10
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    case "readerPull": {
      const rp = data as ReaderPullCheckResponse;
      return (
        <div className="space-y-2">
          {rp.opening_hook && (
            <div
              className="flex items-center gap-2 text-xs p-2 rounded-lg"
              style={{ background: "var(--color-surface-base)" }}
            >
              <BookOpen className="w-3.5 h-3.5" style={{ color: config.color }} />
              <span style={{ color: "var(--text-secondary)" }}>{rp.opening_hook}</span>
            </div>
          )}
          {rp.ending_hook && (
            <div
              className="flex items-center gap-2 text-xs p-2 rounded-lg"
              style={{ background: "var(--color-surface-base)" }}
            >
              <Zap className="w-3.5 h-3.5" style={{ color: config.color }} />
              <span style={{ color: "var(--text-secondary)" }}>{rp.ending_hook}</span>
            </div>
          )}
          {rp.curiosity_gaps && rp.curiosity_gaps.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                好奇心缺口 ({rp.curiosity_gaps.length})
              </div>
              {rp.curiosity_gaps.map((gap, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-xs px-2 py-1 rounded-md"
                  style={{ background: "var(--color-surface-base)" }}
                >
                  <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: config.color }} />
                  <span style={{ color: "var(--text-secondary)" }}>{gap}</span>
                </div>
              ))}
            </div>
          )}
          {rp.hooks && rp.hooks.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                钩子 ({rp.hooks.length})
              </div>
              {rp.hooks.map((hook, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs px-2 py-1 rounded-md"
                  style={{ background: "var(--color-surface-base)" }}
                >
                  <Magnet className="w-3 h-3" style={{ color: config.color }} />
                  <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                    {hook.description}
                  </span>
                  <span className="text-[10px] tabular-nums font-medium" style={{ color: config.color }}>
                    {hook.effectiveness}/10
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
