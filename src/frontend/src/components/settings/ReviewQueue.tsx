/**
 * ReviewQueue — AI suggestion queue workflow.
 *
 * Suggestions enter the queue and the user processes them one by one:
 *   Accept  -> commit data
 *   Edit    -> open edit dialog
 *   Reject  -> remove from queue
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Pencil, XCircle, Sparkles, Inbox } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { GlassCard } from "@/components/ui/GlassCard";
import { DURATION, EASE, SPRING } from "@/components/shared/AnimationConfig";
import { SEVERITY_CONFIG, ISSUE_TYPE_LABELS, type Severity } from "./suggestionTypes";
import type { EntityType } from "@/shared/types";

// -- Types -----

export type ReviewActionType = "add" | "modify" | "delete" | "conflict";

export interface ReviewSuggestion {
  id: string;
  type: ReviewActionType;
  severity: Severity;
  title: string;
  description: string;
  entityType: EntityType | string;
  entityId?: number;
  suggestedData?: Record<string, unknown>;
  status: "pending" | "accepted" | "edited" | "rejected";
}

export interface ReviewQueueProps {
  suggestions: ReviewSuggestion[];
  onAccept: (id: string) => void;
  onEdit: (id: string, data: Record<string, unknown>) => void;
  onReject: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

// -- Animation -----

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.96, filter: "blur(2px)" },
  visible: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, x: -24, scale: 0.95, transition: { duration: 0.2 } },
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

// -- Helpers -----

const ACTION_LABEL: Record<ReviewActionType, string> = { add: "新增", modify: "修改", delete: "删除", conflict: "冲突" };
const ACTION_COLOR: Record<ReviewActionType, string> = { add: "var(--color-success)", modify: "var(--color-outline)", delete: "var(--color-danger)", conflict: "var(--color-character)" };

/** Shared gradient button style for an action colour. */
function actionBtnStyle(varColor: string): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, color-mix(in srgb, ${varColor} 14%, transparent) 0%, color-mix(in srgb, ${varColor} 6%, transparent) 100%)`,
    color: varColor,
    border: `1px solid color-mix(in srgb, ${varColor} 25%, transparent)`,
  };
}

function actionBtnHover(varColor: string) {
  return { scale: 1.02, boxShadow: `0 0 12px color-mix(in srgb, ${varColor} 30%, transparent)` };
}

/** Severity count badge. */
function SeverityBadge({ n, varColor }: { n: number; varColor: string }) {
  if (n <= 0) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
      style={{ backgroundColor: `color-mix(in srgb, ${varColor} 8%, transparent)`, color: varColor }}>{n}</span>
  );
}

// -- Empty state -----

function EmptyState() {
  return (
    <motion.div className="text-center py-10" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}>
      <motion.div className="relative inline-block" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING.SNAPPY, delay: 0.1 }}>
        <div className="absolute inset-0 rounded-full bg-[var(--color-success)] opacity-10 blur-xl" />
        <Icon icon={Inbox} size="lg" color="success" className="mx-auto mb-3 relative z-10" />
      </motion.div>
      <p className="text-sm font-medium text-[var(--text-secondary)]">队列为空</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">没有待处理的 AI 建议</p>
    </motion.div>
  );
}

// -- Queue item -----

function QueueItem({ item, onAccept, onEdit, onReject }: {
  item: ReviewSuggestion;
  onAccept: (id: string) => void;
  onEdit: (id: string, data: Record<string, unknown>) => void;
  onReject: (id: string) => void;
}) {
  const config = SEVERITY_CONFIG[item.severity];
  const SeverityIcon = config.icon;
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div variants={itemVariants} layout
      className="rounded-xl group overflow-hidden relative"
      style={{ background: config.gradient, border: "1px solid var(--border-subtle)" }}
      whileHover={{ scale: 1.008, transition: { duration: 0.2, ease: EASE.SMOOTH } }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = config.colors.border; e.currentTarget.style.boxShadow = `0 4px 20px color-mix(in srgb, var(--ink-100) 25%, transparent), 0 0 24px color-mix(in srgb, ${config.colors.glow} 19%, transparent)`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.boxShadow = "none"; }}
      exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0, padding: 0 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}>
      {/* Accent bar */}
      <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full"
        style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${config.colors.badge} 56%, transparent), ${config.colors.badge}, color-mix(in srgb, ${config.colors.badge} 56%, transparent))`, boxShadow: `0 0 10px color-mix(in srgb, ${config.colors.badge} 31%, transparent)` }} />
      <div className="p-3.5 pl-4.5">
        {/* Badges */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium flex items-center gap-1"
            style={{ backgroundColor: config.colors.bg, color: config.colors.text }}>
            <Icon icon={SeverityIcon} size="xs" color="inherit" />{config.label}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
            style={{ backgroundColor: `color-mix(in srgb, ${ACTION_COLOR[item.type]} 12%, transparent)`, color: ACTION_COLOR[item.type] }}>
            {ACTION_LABEL[item.type]}
          </span>
          {ISSUE_TYPE_LABELS[item.entityType] && (
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]">
              {ISSUE_TYPE_LABELS[item.entityType] ?? item.entityType}
            </span>
          )}
        </div>
        {/* Title */}
        <p className="text-sm font-medium mb-1.5 text-[var(--text-primary)]">{item.title}</p>
        {/* Description */}
        <motion.div initial={false} animate={{ height: expanded ? "auto" : "3.2em" }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }} className="overflow-hidden">
          <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">{item.description}</p>
        </motion.div>
        {item.description.length > 80 && (
          <button onClick={() => setExpanded(!expanded)}
            className="text-[10px] mt-1.5 text-[var(--accent-primary)] hover:underline transition-colors">
            {expanded ? "收起" : "展开"}
          </button>
        )}
        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <motion.button onClick={() => onAccept(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={actionBtnStyle("var(--color-success)")} whileHover={actionBtnHover("var(--color-success)")} whileTap={{ scale: 0.96 }}>
            <Icon icon={CheckCircle2} size="xs" color="success" />接受
          </motion.button>
          <motion.button onClick={() => onEdit(item.id, item.suggestedData ?? {})} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={actionBtnStyle("var(--color-outline)")} whileHover={actionBtnHover("var(--color-outline)")} whileTap={{ scale: 0.96 }}>
            <Icon icon={Pencil} size="xs" color="inherit" />编辑
          </motion.button>
          <motion.button onClick={() => onReject(item.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={actionBtnStyle("var(--color-danger)")} whileHover={actionBtnHover("var(--color-danger)")} whileTap={{ scale: 0.96 }}>
            <Icon icon={XCircle} size="xs" color="danger" />拒绝
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// -- Main component -----

export function ReviewQueue({ suggestions, onAccept, onEdit, onReject, onAcceptAll, onRejectAll }: ReviewQueueProps) {
  const pending = useMemo(() => suggestions.filter((s) => s.status === "pending"), [suggestions]);

  const severityCounts = useMemo(() => {
    const c: Record<Severity, number> = { error: 0, warning: 0, suggestion: 0 };
    for (const s of pending) c[s.severity]++;
    return c;
  }, [pending]);

  return (
    <GlassCard intensity="light" border="subtle" padding="none" rounded="xl" className="overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <Icon icon={Sparkles} size="sm" color="accent" />
          <span className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">审查队列</span>
          {pending.length > 0 && (
            <motion.span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-[var(--accent-muted)] text-[var(--accent-primary)]"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING.BADGE}>{pending.length}</motion.span>
          )}
        </div>
        {pending.length > 0 && (
          <div className="flex items-center gap-1.5">
            <SeverityBadge n={severityCounts.error} varColor="var(--color-danger)" />
            <SeverityBadge n={severityCounts.warning} varColor="var(--color-character)" />
            <SeverityBadge n={severityCounts.suggestion} varColor="var(--color-outline)" />
          </div>
        )}
      </div>

      {/* List */}
      <div className="px-4 pb-4 pt-2 space-y-2.5 max-h-[440px] overflow-y-auto scrollbar-ink">
        {pending.length === 0 ? <EmptyState /> : (
          <AnimatePresence>
            <motion.div variants={listVariants} initial="hidden" animate="visible" exit="exit">
              {pending.map((item) => (
                <QueueItem key={item.id} item={item} onAccept={onAccept} onEdit={onEdit} onReject={onReject} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Batch actions */}
        <AnimatePresence>
          {pending.length > 0 && (
            <motion.div className="flex gap-2 pt-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              transition={{ delay: Math.min(pending.length * 0.05 + 0.05, 0.3) }}>
              <motion.button onClick={onAcceptAll} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={actionBtnStyle("var(--color-success)")} whileHover={{ scale: 1.01, boxShadow: "0 0 14px color-mix(in srgb, var(--color-success) 30%, transparent)" }} whileTap={{ scale: 0.98 }}>
                <Icon icon={CheckCircle2} size="xs" color="success" className="inline-block mr-1 -mt-0.5" />全部接受
              </motion.button>
              <motion.button onClick={onRejectAll} className="flex-1 py-2 rounded-xl text-xs font-medium transition-all bg-transparent text-[var(--text-tertiary)] border border-[var(--border-default)] hover:bg-white/5 hover:text-[var(--text-secondary)]"
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                <Icon icon={XCircle} size="xs" color="muted" className="inline-block mr-1 -mt-0.5" />全部拒绝
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
