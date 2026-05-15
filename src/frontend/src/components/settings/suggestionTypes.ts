/**
 * suggestionTypes.ts — Types, constants, and animation variants for AISuggestionPanel.
 * Extracted to reduce AISuggestionPanel.tsx line count.
 */

import { AlertTriangle, AlertCircle, Lightbulb } from "lucide-react";
import type { EntityType } from "@/shared/types";

export type Severity = "error" | "warning" | "suggestion";
export type IssueType = "consistency" | "relationship" | "foreshadowing" | "suggestion" | "warning";

export interface SuggestionItem {
  id: string;
  type: IssueType;
  severity: Severity;
  title: string;
  description: string;
  entityIds?: number[];
  entityType?: EntityType;
  autoFixable: boolean;
  lineReference?: string;
}

export interface ReviewIteration {
  id: string;
  timestamp: string;
  category: EntityType;
  issueCount: number;
  severityCounts: Record<Severity, number>;
  suggestions: SuggestionItem[];
}

export interface ReviewHistoryState {
  iterations: ReviewIteration[];
  currentIterationId: string | null;
}

export const SEVERITY_CONFIG: Record<Severity, {
  label: string;
  icon: typeof AlertTriangle;
  colors: { bg: string; text: string; border: string; badge: string; glow: string };
  priority: number;
  gradient: string;
}> = {
  error: {
    label: "错误", icon: AlertCircle,
    colors: {
      bg: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
      text: "var(--color-danger)",
      border: "color-mix(in srgb, var(--color-danger) 25%, transparent)",
      badge: "var(--color-vermillion)",
      glow: "color-mix(in srgb, var(--color-danger) 30%, transparent)",
    },
    priority: 1,
    gradient: "linear-gradient(135deg, color-mix(in srgb, var(--color-danger) 8%, transparent) 0%, color-mix(in srgb, var(--color-danger) 2%, transparent) 100%)",
  },
  warning: {
    label: "警告", icon: AlertTriangle,
    colors: {
      bg: "color-mix(in srgb, var(--color-character) 12%, transparent)",
      text: "var(--color-character)",
      border: "color-mix(in srgb, var(--color-character) 25%, transparent)",
      badge: "var(--color-character)",
      glow: "color-mix(in srgb, var(--color-character) 30%, transparent)",
    },
    priority: 2,
    gradient: "linear-gradient(135deg, color-mix(in srgb, var(--color-character) 8%, transparent) 0%, color-mix(in srgb, var(--color-character) 2%, transparent) 100%)",
  },
  suggestion: {
    label: "建议", icon: Lightbulb,
    colors: {
      bg: "color-mix(in srgb, var(--color-outline) 12%, transparent)",
      text: "var(--color-outline)",
      border: "color-mix(in srgb, var(--color-outline) 25%, transparent)",
      badge: "var(--color-outline)",
      glow: "color-mix(in srgb, var(--color-outline) 30%, transparent)",
    },
    priority: 3,
    gradient: "linear-gradient(135deg, color-mix(in srgb, var(--color-outline) 8%, transparent) 0%, color-mix(in srgb, var(--color-outline) 2%, transparent) 100%)",
  },
};

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  consistency: "一致性", relationship: "关系", foreshadowing: "伏笔", suggestion: "建议", warning: "警告",
};

export const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.96, filter: "blur(2px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.15 } },
};

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
  exit: { opacity: 0, transition: { staggerChildren: 0.02, staggerDirection: -1 } },
};

export const pulseGlowVariants = {
  idle: { boxShadow: "0 0 0px rgba(201, 169, 110, 0)" },
  active: {
    boxShadow: ["0 0 4px rgba(201, 169, 110, 0.2)", "0 0 14px rgba(201, 169, 110, 0.45)", "0 0 4px rgba(201, 169, 110, 0.2)"],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" as const },
  },
};

export const shimmerVariants = {
  initial: { backgroundPosition: "-200% 0" },
  animate: { backgroundPosition: "200% 0", transition: { duration: 1.5, repeat: Infinity, ease: "linear" as const } },
};

export function mapSeverity(apiSeverity?: string, apiType?: string): Severity {
  if (apiSeverity === "high") return "error";
  if (apiSeverity === "medium") return "warning";
  if (apiType === "warning") return "warning";
  return "suggestion";
}
