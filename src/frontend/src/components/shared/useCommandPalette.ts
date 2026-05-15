/**
 * useCommandPalette — Hook for command palette state management.
 * Extracted from CommandPalette.tsx.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useUIStore, useWritingStore, useSettingsStore, useChatStore } from "@/store";
import { showToast } from "@/components/ui/Toast";
import type { AIOperationType } from "@/constants/shortcuts";
import { fuzzyMatch } from "./CommandResults";
import { buildCommands } from "./CommandDefinitions";
import type { CommandItem } from "./CommandPalette";

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  const {
    toggleAIDrawer,
    toggleCollaborationDrawer,
    toggleOutlineDrawer,
    toggleTheme,
    theme,
    toggleImmersiveMode,
    immersiveMode,
    toggleFocusMode,
    focusModeEnabled,
    setCurrentInterface,
    currentInterface,
    setSettingsCategory,
  } = useUIStore();

  const { currentChapterId, saveCurrentChapter, createChapter } = useWritingStore();
  const { characters, locations } = useSettingsStore();
  const { createSession } = useChatStore();

  useEffect(() => {
    const stored = localStorage.getItem("writer-recent-commands");
    if (stored) {
      try {
        setRecentCommands(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, []);

  const recordCommand = useCallback((commandId: string) => {
    setRecentCommands((prev) => {
      const next = [commandId, ...prev.filter((id) => id !== commandId)].slice(0, 5);
      localStorage.setItem("writer-recent-commands", JSON.stringify(next));
      return next;
    });
  }, []);

  const executeAIOperation = useCallback(
    async (operation: AIOperationType) => {
      if (!currentChapterId) {
        showToast("请先选择一个章节", "warning");
        return;
      }
      setIsOpen(false);
      const labels: Record<AIOperationType, string> = {
        optimize: "优化",
        expand: "扩写",
        condense: "缩写",
        rewrite: "改写",
        continue: "续写",
        polish: "润色",
      };
      showToast(`正在${labels[operation]}...`, "info");
      try {
        window.dispatchEvent(
          new CustomEvent("ai-operation-request", { detail: { operation } }),
        );
      } catch {
        showToast("操作失败", "error");
      }
    },
    [currentChapterId],
  );

  const commands: CommandItem[] = useMemo(() =>
    buildCommands({
      currentInterface, currentChapterId, theme, immersiveMode, focusModeEnabled,
      characters, locations, toggleAIDrawer, toggleCollaborationDrawer, toggleOutlineDrawer,
      toggleTheme, toggleImmersiveMode, toggleFocusMode, setCurrentInterface,
      setSettingsCategory, saveCurrentChapter, createChapter, createSession,
      recordCommand, executeAIOperation, setIsOpen,
    }),
    [
      currentInterface, currentChapterId, theme, immersiveMode, focusModeEnabled,
      characters, locations, toggleAIDrawer, toggleCollaborationDrawer, toggleOutlineDrawer,
      toggleTheme, toggleImmersiveMode, toggleFocusMode, setCurrentInterface,
      setSettingsCategory, saveCurrentChapter, createChapter, executeAIOperation,
      recordCommand, createSession,
    ],
  );

  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      const recent = recentCommands
        .map((id) => commands.find((c) => c.id === id))
        .filter(Boolean) as CommandItem[];
      const others = commands.filter((c) => !recentCommands.includes(c.id));
      return [...recent, ...others].filter((c) => !c.disabled);
    }
    return commands.filter(
      (cmd) => !cmd.disabled && fuzzyMatch(search, cmd.label, cmd.keywords),
    );
  }, [commands, search, recentCommands]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    const handleToggle = () => setIsOpen((prev) => !prev);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("toggle-command-palette", handleToggle);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("toggle-command-palette", handleToggle);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setSearch("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    [filteredCommands, selectedIndex],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setSearch("");
    setSelectedIndex(0);
  }, []);

  return {
    isOpen, search, setSearch, selectedIndex, setSelectedIndex,
    filteredCommands, inputRef, handleKeyDown, open, close,
  };
}
