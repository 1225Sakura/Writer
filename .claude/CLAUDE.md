# CLAUDE.md — 自动化写作软件 (Auto Novel Writer)

## 项目概述

本项目是一款面向中文网络小说作者的本地桌面写作软件，通过 AI 辅助完成从世界观构建、角色设定到正文创作的全流程。

**核心功能：** 三界面架构（聊天初始化 → 设定编辑 → 正文写作），支持文笔风格调节、人机协作比例控制、IF 线同步写作。

**技术栈：** React 18 + TypeScript + Vite + Tailwind CSS + Electron (electron-builder) + shadcn/ui + Zustand + MiniMax API (AI)

**参考架构：** `D:/writer/read/reference-webnovel`

---

## 运行环境

- **平台：** 本地桌面应用（Windows/macOS/Linux），基于 Electron 渲染进程
- **打包：** Electron + electron-builder（输出 `.exe`/`.dmg`/`.AppImage`）
- **存储：** 本地文件（JSON / IndexedDB / localStorage），不依赖后端服务
- **网络：** AI 调用需联网，UI 完全离线可用

---

## 三界面架构

### 界面1：聊天初始化 (Chat Initialization)
- AI 主动提问，收集世界观、角色、金手指、反派等设定
- 实时显示已收集信息面板
- 支持随时进入界面2预览

### 界面2：设定编辑 (Setting Editor)
- 左侧分类导航（世界观/角色/物品/地点/势力/规则/大纲/IF线）
- 右侧编辑器支持关系可视化
- AI 审查可多次迭代（一致性检查、伏笔追踪、建议优化）

### 界面3：正文写作 (Writing Editor)
- 沉浸式写作区，最大化正文空间
- AI 操作抽屉（右侧）+ 协作面板抽屉（右侧），可独立展开/收起
- 工具栏：写作/大纲/AI操作/协作/返回设定
- 人机比例滑块实时调节
- 快捷键：Ctrl+Shift+O(优化) / E(扩写) / S(缩写) / R(改写) / W(续写) / P(润色)

---

## 色彩系统

| 类型 | 色值 | 用途 |
|------|------|------|
| 深墨色 | #1a1510 | 写作区背景（深色模式） |
| 宣纸白 | #f5eed6 | 正文文字/卡片背景 |
| 朱砂红 | #8b3a3a | 强调/警告/重要标记 |
| 角色橙 | #c9a06e | 角色类型编码 |
| 物品紫 | #8b7aaa | 物品类型编码 |
| 地点青 | #6b9e8e | 地点类型编码 |
| 势力红 | #a04848 | 势力类型编码 |
| 大纲蓝 | #7088a8 | 大纲类型编码 |
| IF线绿 | #7a9e58 | IF线类型编码 |

---

## 字体排版

- **写作字体：** 思源宋体 (中文) / JetBrains Mono (英文)，16-18px，行高 1.75-2em
- **界面字体：** 思源黑体 / Inter，13-14px，行高 1.5em
- **基础单位：** 4px

### 组件命名规范

- **组件文件：** PascalCase（`MaterialCard.tsx`、`GlassCard.tsx`）
- **shadcn/ui 原语：** 小写单词（`accordion.tsx`、`badge.tsx`）或 kebab-case（`scroll-area.tsx`），保持 shadcn 生成的约定
- **工具文件：** camelCase（`utils.ts`、`entityColors.ts`）
- **Hook 文件：** camelCase + `use` 前缀（`useTheme.ts`、`useImmersiveMode.ts`）
- **CSS 文件：** kebab-case（`design-tokens.css`、`globals.css`）
- **索引文件：** 小写（`index.ts`）

---

## 快捷键

| 操作 | 快捷键 |
|------|--------|
| 切换AI抽屉 | Ctrl+\ |
| 切换协作面板 | Ctrl+/ |
| 保存 | Ctrl+S |
| 全屏写作 | F11 |
| 优化/扩写/缩写/改写/续写/润色 | Ctrl+Shift+O/E/S/R/W/P |

---

## 约束 (Constraints)

- 仅本地桌面应用，不做移动端/Web端
- 不部署本地模型，纯 API 调用
- 不做出版级校对/语法检查
- 不做多语言/翻译功能
- 无后端服务，数据全部存于前端本地存储