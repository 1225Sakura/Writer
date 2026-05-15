/**
 * CommandPalette — Enhanced command palette with glowing search,
 * gradient hover effects, elegant kbd shortcuts, and refined empty state.
 * Hook extracted to: useCommandPalette.ts. Sub-components: CommandResults.
 */

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Search, Command, X } from "lucide-react";
import { DURATION, EASE } from "@/components/shared/AnimationConfig";
import { KbdPill, CommandListBody } from "./CommandResults";
import { useCommandPalette } from "./useCommandPalette";

export type CommandCategory =
  | "navigation"
  | "file"
  | "view"
  | "ai"
  | "theme"
  | "settings"
  | "search"
  | "system";

export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  category: CommandCategory;
  keywords?: string[];
  disabled?: boolean;
}


export function CommandPalette() {
  const {
    isOpen, search, setSearch, selectedIndex, setSelectedIndex,
    filteredCommands, inputRef, handleKeyDown, close,
  } = useCommandPalette();

  if (!isOpen) return null;

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      onClick={close}
    >
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          background: "color-mix(in srgb, var(--ink-100) 65%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
        className="relative w-full max-w-xl rounded-2xl border overflow-hidden"
        style={{
          background: "color-mix(in srgb, var(--ink-90) 95%, transparent)",
          borderColor: "color-mix(in srgb, var(--paper-100) 10%, transparent)",
          boxShadow: "0 24px 64px color-mix(in srgb, var(--ink-100) 40%, transparent), 0 0 0 1px color-mix(in srgb, var(--paper-100) 4%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 border-b"
          style={{
            borderColor: "color-mix(in srgb, var(--paper-100) 8%, transparent)",
            background: "color-mix(in srgb, var(--ink-100) 25%, transparent)",
          }}
        >
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="输入命令或搜索..."
            aria-label="搜索命令"
            className="flex-1 bg-transparent border-none text-sm placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-0"
            style={{ color: "var(--text-primary)" }}
          />
          <button
            onClick={close}
            className="p-1.5 rounded-md transition-all duration-200 hover:bg-white/10 hover:scale-105 active:scale-95"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto py-2">
          <CommandListBody filteredCommands={filteredCommands} search={search} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2.5 border-t flex items-center justify-between text-[11px]"
          style={{
            borderColor: "color-mix(in srgb, var(--paper-100) 8%, transparent)",
            background: "color-mix(in srgb, var(--ink-100) 20%, transparent)",
            color: "var(--text-tertiary)",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <KbdPill shortcut="↑" />
              <KbdPill shortcut="↓" />
              <span className="ml-1">导航</span>
            </span>
            <span className="flex items-center gap-1">
              <KbdPill shortcut="↵" />
              <span className="ml-1">执行</span>
            </span>
            <span className="flex items-center gap-1">
              <KbdPill shortcut="Esc" />
              <span className="ml-1">关闭</span>
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{
              background: "color-mix(in srgb, var(--paper-100) 5%, transparent)",
              border: "1px solid color-mix(in srgb, var(--paper-100) 8%, transparent)",
            }}
          >
            <Command className="w-3 h-3" />
            <span className="font-medium">K</span>
            <span style={{ opacity: 0.6 }}>打开</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(content, document.body);
}
