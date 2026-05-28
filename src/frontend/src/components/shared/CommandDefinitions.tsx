/**
 * CommandDefinitions.tsx — Command item definitions for CommandPalette.
 * Extracted from CommandPalette.tsx to reduce its line count.
 */

import {
  FilePlus,
  MessageCircle,
  Users,
  List,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Keyboard,
  Eye,
  EyeOff,
  Home,
  Settings,
  PenTool,
  Sparkles,
  Wand2,
  Scissors,
  RefreshCw,
  BookOpen,
  User,
  MapPin,
  Shield,
  ShieldCheck,
  Globe,
  GitBranch,
  Save,
  ArrowRight,
} from "lucide-react";
import { showToast } from "@/components/ui/Toast";
import type { CommandItem, CommandCategory } from "./CommandPalette";
import type { AIOperationType } from "@/constants/shortcuts";
import type { InterfaceType, SettingsCategory } from "@/store/uiStore";

interface CommandDeps {
  currentInterface: string;
  currentChapterId: number | null;
  theme: string;
  immersiveMode: boolean;
  focusModeEnabled: boolean;
  characters: Array<{ id: number; name: string }>;
  locations: Array<{ id: number; name: string }>;
  toggleAIDrawer: () => void;
  toggleCollaborationDrawer: () => void;
  toggleOutlineDrawer: () => void;
  toggleCheckerDrawer: () => void;
  toggleTheme: () => void;
  toggleImmersiveMode: () => void;
  toggleFocusMode: () => void;
  setCurrentInterface: (interfaceType: InterfaceType, meta?: Record<string, unknown>) => void;
  setSettingsCategory: (category: SettingsCategory) => void;
  saveCurrentChapter: () => void;
  createChapter: (data: any) => Promise<any>;
  createSession: () => void;
  recordCommand: (id: string) => void;
  executeAIOperation: (op: AIOperationType) => void;
  setIsOpen: (open: boolean) => void;
}

export function buildCommands(d: CommandDeps): CommandItem[] {
  return [
    {
      id: "goto-chat", label: "聊天初始化", shortcut: "Ctrl+Alt+1",
      icon: <Home className="w-4 h-4" />, category: "navigation",
      keywords: ["chat", "home", "开始"],
      action: () => { d.setCurrentInterface("chat"); showToast("已切换到聊天初始化", "info"); d.setIsOpen(false); },
    },
    {
      id: "goto-settings", label: "设定编辑", shortcut: "Ctrl+Alt+2",
      icon: <Settings className="w-4 h-4" />, category: "navigation",
      keywords: ["settings", "设定", "配置"],
      action: () => { d.setCurrentInterface("settings"); showToast("已切换到设定编辑", "info"); d.setIsOpen(false); },
    },
    {
      id: "goto-writing", label: "正文写作", shortcut: "Ctrl+Alt+3",
      icon: <PenTool className="w-4 h-4" />, category: "navigation",
      keywords: ["write", "写作", "编辑"],
      action: () => { d.setCurrentInterface("writing"); showToast("已切换到正文写作", "info"); d.setIsOpen(false); },
    },
    {
      id: "save", label: "保存", shortcut: "Ctrl+S",
      icon: <Save className="w-4 h-4" />, category: "file",
      keywords: ["save", "保存"],
      action: () => {
        if (d.currentChapterId) { d.saveCurrentChapter(); showToast("保存成功", "success"); }
        else { showToast("没有可保存的内容", "warning"); }
        d.setIsOpen(false);
      },
    },
    {
      id: "new-chapter", label: "新建章节", shortcut: "Ctrl+N",
      icon: <FilePlus className="w-4 h-4" />, category: "file",
      keywords: ["new", "chapter", "新建", "章节"],
      action: () => {
        d.createChapter({ title: "新章节", status: "planning" })
          .then((ch: any) => { showToast(`已创建: ${ch.title}`, "success"); })
          .catch(() => showToast("创建失败", "error"));
        d.setIsOpen(false);
      },
    },
    {
      id: "ai-optimize", label: "AI优化", shortcut: "Ctrl+Shift+O",
      icon: <Sparkles className="w-4 h-4" />, category: "ai",
      keywords: ["optimize", "优化", "改进"],
      disabled: !d.currentChapterId || d.currentInterface !== "writing",
      action: () => { d.recordCommand("ai-optimize"); d.executeAIOperation("optimize"); },
    },
    {
      id: "ai-expand", label: "AI扩写", shortcut: "Ctrl+Shift+E",
      icon: <Maximize2 className="w-4 h-4" />, category: "ai",
      keywords: ["expand", "扩写", "扩展"],
      disabled: !d.currentChapterId || d.currentInterface !== "writing",
      action: () => { d.recordCommand("ai-expand"); d.executeAIOperation("expand"); },
    },
    {
      id: "ai-condense", label: "AI缩写", shortcut: "Ctrl+Shift+S",
      icon: <Scissors className="w-4 h-4" />, category: "ai",
      keywords: ["condense", "shrink", "缩写", "精简"],
      disabled: !d.currentChapterId || d.currentInterface !== "writing",
      action: () => { d.recordCommand("ai-condense"); d.executeAIOperation("condense"); },
    },
    {
      id: "ai-rewrite", label: "AI改写", shortcut: "Ctrl+Shift+R",
      icon: <RefreshCw className="w-4 h-4" />, category: "ai",
      keywords: ["rewrite", "改写", "重写"],
      disabled: !d.currentChapterId || d.currentInterface !== "writing",
      action: () => { d.recordCommand("ai-rewrite"); d.executeAIOperation("rewrite"); },
    },
    {
      id: "ai-continue", label: "AI续写", shortcut: "Ctrl+Shift+W",
      icon: <ArrowRight className="w-4 h-4" />, category: "ai",
      keywords: ["continue", "续写", "继续"],
      disabled: !d.currentChapterId || d.currentInterface !== "writing",
      action: () => { d.recordCommand("ai-continue"); d.executeAIOperation("continue"); },
    },
    {
      id: "ai-polish", label: "AI润色", shortcut: "Ctrl+Shift+P",
      icon: <Wand2 className="w-4 h-4" />, category: "ai",
      keywords: ["polish", "润色", "修饰"],
      disabled: !d.currentChapterId || d.currentInterface !== "writing",
      action: () => { d.recordCommand("ai-polish"); d.executeAIOperation("polish"); },
    },
    {
      id: "toggle-ai-drawer", label: "切换AI操作面板", shortcut: "Ctrl+\\",
      icon: <MessageCircle className="w-4 h-4" />, category: "view",
      keywords: ["ai", "drawer", "面板"],
      disabled: d.currentInterface !== "writing",
      action: () => { d.toggleAIDrawer(); d.setIsOpen(false); },
    },
    {
      id: "toggle-collaboration", label: "切换协作面板", shortcut: "Ctrl+/",
      icon: <Users className="w-4 h-4" />, category: "view",
      keywords: ["collaboration", "协作", "面板"],
      disabled: d.currentInterface !== "writing",
      action: () => { d.toggleCollaborationDrawer(); d.setIsOpen(false); },
    },
    {
      id: "toggle-outline", label: "切换大纲面板", shortcut: "Ctrl+Shift+D",
      icon: <List className="w-4 h-4" />, category: "view",
      keywords: ["outline", "大纲", "面板"],
      disabled: d.currentInterface !== "writing",
      action: () => { d.toggleOutlineDrawer(); d.setIsOpen(false); },
    },
    {
      id: "toggle-checker", label: "切换检查面板", shortcut: "Ctrl+5",
      icon: <ShieldCheck className="w-4 h-4" />, category: "view",
      keywords: ["checker", "检查", "质量", "面板"],
      disabled: d.currentInterface !== "writing",
      action: () => { d.toggleCheckerDrawer(); d.setIsOpen(false); },
    },
    {
      id: "toggle-immersive",
      label: d.immersiveMode ? "退出沉浸模式" : "进入沉浸模式",
      shortcut: "Ctrl+Shift+I",
      icon: d.immersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />,
      category: "view",
      keywords: ["immersive", "沉浸", "全屏"],
      disabled: d.currentInterface !== "writing",
      action: () => { d.toggleImmersiveMode(); showToast(d.immersiveMode ? "退出沉浸模式" : "进入沉浸模式", "info"); d.setIsOpen(false); },
    },
    {
      id: "toggle-focus-mode",
      label: d.focusModeEnabled ? "退出专注模式" : "进入专注模式",
      shortcut: "Ctrl+Shift+F",
      icon: d.focusModeEnabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />,
      category: "view",
      keywords: ["focus", "专注", "模式"],
      disabled: d.currentInterface !== "writing",
      action: () => { d.toggleFocusMode(); showToast(d.focusModeEnabled ? "退出专注模式" : "进入专注模式", "info"); d.setIsOpen(false); },
    },
    {
      id: "goto-world", label: "世界观设定",
      icon: <Globe className="w-4 h-4" />, category: "settings",
      keywords: ["world", "世界观", "设定"],
      action: () => { d.setCurrentInterface("settings"); d.setSettingsCategory("world"); d.setIsOpen(false); },
    },
    {
      id: "goto-characters", label: "角色设定",
      icon: <User className="w-4 h-4" />, category: "settings",
      keywords: ["character", "角色", "人物"],
      action: () => { d.setCurrentInterface("settings"); d.setSettingsCategory("character"); d.setIsOpen(false); },
    },
    {
      id: "goto-locations", label: "地点设定",
      icon: <MapPin className="w-4 h-4" />, category: "settings",
      keywords: ["location", "地点", "场景"],
      action: () => { d.setCurrentInterface("settings"); d.setSettingsCategory("location"); d.setIsOpen(false); },
    },
    {
      id: "goto-factions", label: "势力设定",
      icon: <Shield className="w-4 h-4" />, category: "settings",
      keywords: ["faction", "势力", "门派"],
      action: () => { d.setCurrentInterface("settings"); d.setSettingsCategory("faction"); d.setIsOpen(false); },
    },
    {
      id: "goto-outline", label: "大纲设定",
      icon: <BookOpen className="w-4 h-4" />, category: "settings",
      keywords: ["outline", "大纲", "剧情"],
      action: () => { d.setCurrentInterface("settings"); d.setSettingsCategory("outline"); d.setIsOpen(false); },
    },
    {
      id: "goto-ifline", label: "IF线设定",
      icon: <GitBranch className="w-4 h-4" />, category: "settings",
      keywords: ["ifline", "IF线", "支线"],
      action: () => { d.setCurrentInterface("settings"); d.setSettingsCategory("ifline"); d.setIsOpen(false); },
    },
    ...(d.characters.slice(0, 5).map((c) => ({
      id: `char-${c.id}`, label: `角色: ${c.name}`,
      icon: <User className="w-4 h-4" />, category: "search" as CommandCategory,
      keywords: ["character", "角色", c.name],
      action: () => { d.setCurrentInterface("settings"); d.setSettingsCategory("character"); d.setIsOpen(false); },
    })) || []),
    ...(d.locations.slice(0, 3).map((l) => ({
      id: `loc-${l.id}`, label: `地点: ${l.name}`,
      icon: <MapPin className="w-4 h-4" />, category: "search" as CommandCategory,
      keywords: ["location", "地点", l.name],
      action: () => { d.setCurrentInterface("settings"); d.setSettingsCategory("location"); d.setIsOpen(false); },
    })) || []),
    {
      id: "toggle-theme",
      label: `切换${d.theme === "dark" ? "浅色" : "深色"}模式`,
      shortcut: "Ctrl+Shift+T",
      icon: d.theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
      category: "theme",
      keywords: ["theme", "主题", "颜色"],
      action: () => { d.toggleTheme(); showToast(`已切换至${d.theme === "dark" ? "浅色" : "深色"}模式`, "info"); d.setIsOpen(false); },
    },
    {
      id: "shortcuts-help", label: "快捷键帮助", shortcut: "Ctrl+Shift+?",
      icon: <Keyboard className="w-4 h-4" />, category: "system",
      keywords: ["shortcut", "快捷键", "帮助", "help"],
      action: () => {
        window.dispatchEvent(new CustomEvent("show-shortcuts-help", { detail: { interface: d.currentInterface } }));
        d.setIsOpen(false);
      },
    },
    {
      id: "new-chat-session", label: "新建聊天会话",
      icon: <MessageCircle className="w-4 h-4" />, category: "system",
      keywords: ["chat", "会话", "新建"],
      action: () => { d.createSession(); d.setCurrentInterface("chat"); showToast("已创建新会话", "success"); d.setIsOpen(false); },
    },
  ];
}
