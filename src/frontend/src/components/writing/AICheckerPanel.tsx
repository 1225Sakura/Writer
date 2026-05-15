/**
 * AICheckerPanel — AI quality checker panel.
 * Sub-components extracted to: CheckerResults, SpecializedDisplay.
 * Configs/types extracted to: CheckerConfigs.
 */

import { useState, useCallback } from "react";
import { useWritingStore } from "@/store";
import { checkerApi } from "@/api/aiReview";
import { showToast } from "@/components/ui/Toast";
import { motion } from "framer-motion";
import {
  Play,
  Loader2,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { CheckerCard, ScoreOverview } from "./CheckerResults";
import type { CheckerKey, CheckerResult } from "./CheckerConfigs";
import { checkers } from "./CheckerConfigs";

// Re-export types and utils for consumers
export type { CheckerKey, CheckerConfig, CheckerResult } from "./CheckerConfigs";
export { checkers, getScoreColor, getScoreLabel } from "./CheckerConfigs";

export function PanelHeader({ onRunAll, isRunning }: { onRunAll: () => void; isRunning: boolean }) {
  return (
    <div className="flex items-center gap-3 pb-3 mb-1">
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center relative z-10"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--color-outline) 22%, transparent) 0%, color-mix(in srgb, var(--color-outline) 8%, transparent) 100%)", border: "1px solid color-mix(in srgb, var(--color-outline) 30%, transparent)", boxShadow: "0 0 16px color-mix(in srgb, var(--color-outline) 15%, transparent), inset 0 1px 0 color-mix(in srgb, var(--color-outline) 10%, transparent)" }}>
          <Sparkles className="w-5 h-5" style={{ color: "var(--color-outline)" }} />
        </div>
        <span className="absolute inset-[-2px] rounded-xl animate-ping opacity-25 motion-reduce:animate-none" style={{ background: "color-mix(in srgb, var(--color-outline) 15%, transparent)", animationDuration: "2.5s" }} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold tracking-tight" style={{ background: "linear-gradient(90deg, var(--color-outline) 0%, var(--color-ifline) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          AI 质量检查
        </h3>
        <p className="text-[10px] leading-tight flex items-center gap-1.5" style={{ color: "var(--text-tertiary)" }}>
          <span className="inline-block w-1 h-1 rounded-full animate-pulse motion-reduce:animate-none" style={{ background: "var(--color-outline)", boxShadow: "0 0 4px var(--color-outline)" }} />
          六维质量分析 · 智能诊断
        </p>
      </div>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onRunAll} disabled={isRunning}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--color-outline) 20%, transparent) 0%, color-mix(in srgb, var(--color-ifline) 15%, transparent) 100%)", border: "1px solid color-mix(in srgb, var(--color-outline) 30%, transparent)", color: "var(--color-outline)" }}>
        {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        全部检查
      </motion.button>
    </div>
  );
}

export function AICheckerPanel() {
  const { currentChapterId } = useWritingStore();
  const [results, setResults] = useState<Map<CheckerKey, CheckerResult>>(new Map());
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const setResult = useCallback((key: CheckerKey, update: Partial<CheckerResult>) => {
    setResults((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      next.set(key, {
        key,
        loading: false,
        error: null,
        data: null,
        timestamp: null,
        ...existing,
        ...update,
      });
      return next;
    });
  }, []);

  const runChecker = useCallback(
    async (key: CheckerKey) => {
      if (!currentChapterId) {
        showToast("请先选择一个章节", "warning");
        return;
      }

      setResult(key, { loading: true, error: null });

      try {
        let data: CheckerResult["data"];

        switch (key) {
          case "consistency":
            data = await checkerApi.checkConsistency(currentChapterId);
            break;
          case "continuity":
            data = await checkerApi.checkContinuity(currentChapterId);
            break;
          case "pacing":
            data = await checkerApi.checkPacing(currentChapterId);
            break;
          case "ooc":
            if (!selectedCharacterId) {
              showToast("请先选择一个角色", "warning");
              setResult(key, { loading: false, error: "未选择角色" });
              return;
            }
            data = await checkerApi.checkOOC(currentChapterId, selectedCharacterId);
            break;
          case "highPoint":
            data = await checkerApi.checkHighPoint(currentChapterId);
            break;
          case "readerPull":
            data = await checkerApi.checkReaderPull(currentChapterId);
            break;
          default:
            throw new Error(`Unknown checker: ${key}`);
        }

        setResult(key, { loading: false, data, timestamp: Date.now() });
        showToast(`${checkers.find((c) => c.key === key)?.label} 检查完成`, "success");
      } catch (error) {
        const message = error instanceof Error ? error.message : "检查失败";
        setResult(key, { loading: false, error: message });
        showToast(message, "error");
      }
    },
    [currentChapterId, selectedCharacterId, setResult],
  );

  const runAllCheckers = useCallback(async () => {
    if (!currentChapterId) {
      showToast("请先选择一个章节", "warning");
      return;
    }

    setIsRunningAll(true);
    showToast("开始全部检查...", "info");

    const promises = checkers
      .filter((c) => c.key !== "ooc")
      .map(async (config) => {
        setResult(config.key, { loading: true, error: null });
        try {
          let data: CheckerResult["data"] = null;
          switch (config.key) {
            case "consistency":
              data = await checkerApi.checkConsistency(currentChapterId);
              break;
            case "continuity":
              data = await checkerApi.checkContinuity(currentChapterId);
              break;
            case "pacing":
              data = await checkerApi.checkPacing(currentChapterId);
              break;
            case "highPoint":
              data = await checkerApi.checkHighPoint(currentChapterId);
              break;
            case "readerPull":
              data = await checkerApi.checkReaderPull(currentChapterId);
              break;
          }
          setResult(config.key, { loading: false, data, timestamp: Date.now() });
        } catch (error) {
          const message = error instanceof Error ? error.message : "检查失败";
          setResult(config.key, { loading: false, error: message });
        }
      });

    await Promise.all(promises);
    setIsRunningAll(false);
    showToast("全部检查完成", "success");
  }, [currentChapterId, setResult]);

  if (!currentChapterId) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid var(--border-default)",
          }}
        >
          <BarChart3 className="w-6 h-6" style={{ color: "var(--text-tertiary)" }} />
        </div>
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>未选择章节</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>请先选择一个章节以运行质量检查</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 ai-drawer-scroll">
      <PanelHeader onRunAll={runAllCheckers} isRunning={isRunningAll} />

      <ScoreOverview results={results} checkers={checkers} />

      <div className="space-y-2">
        {checkers.map((config) => (
          <CheckerCard
            key={config.key}
            config={config}
            result={results.get(config.key)}
            onRun={() => runChecker(config.key)}
            selectedCharacterId={selectedCharacterId}
            onCharacterChange={setSelectedCharacterId}
          />
        ))}
      </div>

      <p className="text-[10px] text-center pt-2" style={{ color: "var(--text-tertiary)" }}>
        基于 AI 分析，结果仅供参考
      </p>
    </div>
  );
}
