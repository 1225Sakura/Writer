/**
 * CommandResults — Search utilities, keyboard shortcut pill, category configs, and list rendering.
 * Extracted from CommandPalette.tsx.
 */

import { motion } from "framer-motion";
import { Feather } from "lucide-react";
import { DURATION, EASE } from "@/components/shared/AnimationConfig";
import type { CommandCategory, CommandItem } from "./CommandPalette";

// ============================================
// Category Display Configuration
// ============================================

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: "导航",
  file: "文件",
  view: "视图",
  ai: "AI操作",
  theme: "主题",
  settings: "设定",
  search: "搜索",
  system: "系统",
};

export const CATEGORY_ORDER: CommandCategory[] = [
  "navigation",
  "file",
  "view",
  "ai",
  "settings",
  "search",
  "theme",
  "system",
];

export const CATEGORY_COLORS: Record<CommandCategory, string> = {
  navigation: "var(--accent-primary)",
  file: "var(--color-success)",
  view: "var(--color-info)",
  ai: "var(--color-warning)",
  theme: "var(--color-item)",
  settings: "var(--color-character)",
  search: "var(--color-location)",
  system: "var(--text-tertiary)",
};

// ============================================
// Fuzzy Search
// ============================================

export function fuzzyMatch(
  query: string,
  text: string,
  keywords?: string[],
): boolean {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return true;

  const lowerText = text.toLowerCase();
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  if (queryIndex === lowerQuery.length) return true;

  // Search keywords
  if (keywords) {
    for (const kw of keywords) {
      if (kw.toLowerCase().includes(lowerQuery)) return true;
    }
  }
  return false;
}

export function highlightMatch(
  query: string,
  text: string,
): React.ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const result: React.ReactNode[] = [];
  let queryIndex = 0;
  let lastIndex = 0;

  for (
    let i = 0;
    i < lowerText.length && queryIndex < lowerQuery.length;
    i++
  ) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      if (i > lastIndex) {
        result.push(text.slice(lastIndex, i));
      }
      result.push(
        <span
          key={i}
          className="font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {text[i]}
        </span>,
      );
      lastIndex = i + 1;
      queryIndex++;
    }
  }
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result.length > 0 ? result : text;
}

// ============================================
// Keyboard Shortcut Pill
// ============================================

export function KbdPill({ shortcut }: { shortcut: string }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
      style={{
        background: "color-mix(in srgb, var(--paper-100) 6%, transparent)",
        border: "1px solid color-mix(in srgb, var(--paper-100) 10%, transparent)",
        color: "var(--text-tertiary)",
        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--paper-100) 4%, transparent)",
      }}
    >
      {shortcut}
    </span>
  );
}

// ============================================
// Command List Body
// ============================================

export function CommandListBody({
  filteredCommands,
  search,
  selectedIndex,
  onSelect,
}: {
  filteredCommands: CommandItem[];
  search: string;
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (filteredCommands.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}>
          <Feather className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--text-tertiary)", opacity: 0.4 }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>未找到匹配的命令</p>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>尝试其他关键词或检查拼写</p>
        </motion.div>
      </div>
    );
  }

  const grouped: Record<string, CommandItem[]> = {};
  for (const cmd of filteredCommands) {
    if (!grouped[cmd.category]) grouped[cmd.category] = [];
    grouped[cmd.category].push(cmd);
  }
  const sortedCategories = CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0);

  let globalIndex = 0;
  return (
    <>
      {sortedCategories.map((category) => (
        <div key={category}>
          <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2"
            style={{ color: CATEGORY_COLORS[category as CommandCategory] }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[category as CommandCategory] }} />
            {CATEGORY_LABELS[category as CommandCategory]}
          </div>
          {grouped[category].map((cmd) => {
            const currentIndex = globalIndex++;
            const isSelected = currentIndex === selectedIndex;
            return (
              <button key={cmd.id} onClick={() => cmd.action()} onMouseEnter={() => onSelect(currentIndex)}
                className="relative w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all duration-150 group"
                disabled={cmd.disabled}
                style={{
                  opacity: cmd.disabled ? 0.4 : 1, cursor: cmd.disabled ? "not-allowed" : "pointer",
                  background: isSelected ? "linear-gradient(90deg, color-mix(in srgb, var(--accent-100) 12%, transparent) 0%, color-mix(in srgb, var(--accent-100) 4%, transparent) 100%)" : "transparent",
                  borderLeft: isSelected ? "3px solid var(--accent-primary)" : "3px solid transparent",
                }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--paper-100) 3%, transparent) 0%, transparent 100%)" }} />
                <span className="relative flex-shrink-0 transition-colors duration-150" style={{ color: isSelected ? "var(--accent-primary)" : "var(--text-tertiary)" }}>{cmd.icon}</span>
                <span className="relative flex-1" style={{ color: isSelected ? "var(--text-primary)" : "var(--text-secondary)" }}>{highlightMatch(search, cmd.label)}</span>
                {cmd.shortcut && <KbdPill shortcut={cmd.shortcut} />}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}
