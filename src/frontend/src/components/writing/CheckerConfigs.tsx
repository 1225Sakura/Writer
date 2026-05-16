/**
 * CheckerConfigs — Checker definitions, types, and utility functions.
 * Extracted from AICheckerPanel.tsx.
 */

import {
  ShieldCheck,
  GitBranch,
  Gauge,
  UserCheck,
  Flame,
  Magnet,
  BookOpen,
  Atom,
} from "lucide-react";
import type {
  CheckerBaseResponse,
  ContinuityCheckResponse,
  PacingCheckResponse,
  OOCCheckResponse,
  HighPointCheckResponse,
  ReaderPullCheckResponse,
} from "@/api/types";

export type CheckerKey = "consistency" | "continuity" | "pacing" | "ooc" | "highPoint" | "readerPull" | "outlineLaw" | "settingPhysics";

export interface CheckerConfig {
  key: CheckerKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  requiresCharacter: boolean;
}

export interface CheckerResult {
  key: CheckerKey;
  loading: boolean;
  error: string | null;
  data:
    | CheckerBaseResponse
    | ContinuityCheckResponse
    | PacingCheckResponse
    | OOCCheckResponse
    | HighPointCheckResponse
    | ReaderPullCheckResponse
    | null
    | undefined;
  timestamp: number | null;
}

export const checkers: CheckerConfig[] = [
  {
    key: "consistency",
    label: "世界一致性",
    description: "地点、时间线、实力等级、物品归属",
    icon: <ShieldCheck className="w-4 h-4" />,
    color: "var(--color-location)",
    requiresCharacter: false,
  },
  {
    key: "continuity",
    label: "叙事连续性",
    description: "场景转换、事件连贯、伏笔呼应",
    icon: <GitBranch className="w-4 h-4" />,
    color: "var(--color-outline)",
    requiresCharacter: false,
  },
  {
    key: "pacing",
    label: "叙事节奏",
    description: "任务线/燃情线/星座线比例分析",
    icon: <Gauge className="w-4 h-4" />,
    color: "var(--color-character)",
    requiresCharacter: false,
  },
  {
    key: "ooc",
    label: "角色OOC",
    description: "行为是否符合已建立的性格设定",
    icon: <UserCheck className="w-4 h-4" />,
    color: "var(--color-item)",
    requiresCharacter: true,
  },
  {
    key: "highPoint",
    label: "高潮分布",
    description: "情感节奏、铺垫充分性、结尾钩子",
    icon: <Flame className="w-4 h-4" />,
    color: "var(--color-faction)",
    requiresCharacter: false,
  },
  {
    key: "readerPull",
    label: "读者吸引力",
    description: "开头钩子、结尾悬念、好奇心缺口",
    icon: <Magnet className="w-4 h-4" />,
    color: "var(--color-ifline)",
    requiresCharacter: false,
  },
  {
    key: "outlineLaw",
    label: "大纲法则",
    description: "章节是否遵循大纲规划、情节点完成度",
    icon: <BookOpen className="w-4 h-4" />,
    color: "var(--color-outline)",
    requiresCharacter: false,
  },
  {
    key: "settingPhysics",
    label: "设定物理法则",
    description: "力量体系、空间距离、时间逻辑一致性",
    icon: <Atom className="w-4 h-4" />,
    color: "var(--color-rule)",
    requiresCharacter: false,
  },
];

export function getScoreColor(score: number): string {
  if (score >= 90) return "var(--color-ifline)";
  if (score >= 75) return "var(--color-location)";
  if (score >= 60) return "var(--color-character)";
  return "var(--color-faction)";
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "优秀";
  if (score >= 75) return "良好";
  if (score >= 60) return "一般";
  return "需改进";
}
