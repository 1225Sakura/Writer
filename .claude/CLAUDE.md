# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 自动化写作软件 (Auto Novel Writer)

本地桌面写作软件，面向中文网络小说作者，通过 AI 辅助完成从世界观构建、角色设定到正文创作的全流程。三界面架构：聊天初始化 → 设定编辑 → 正文写作。

**技术栈：** Electron 33 + electron-builder · React 18 + TypeScript · Vite 6 · Tailwind CSS · shadcn/ui (Radix) · Zustand 5 (+ immer) · Tiptap · Framer Motion · react-force-graph · Playwright + Vitest

**AI 模型：** 通过用户配置的外部 API（MiniMax 等）调用，本仓库不部署本地模型。

**项目参考：** `read/` 目录下的 `reference-webnovel` 等子模块作为架构参考（只读，不修改）。

---

## 常用命令

仓库有两个独立 `package.json` — 前端与 Electron 壳层各一个，**所有 npm 命令必须先 `cd` 到对应目录**。

### 前端 (`src/frontend/`)

| 命令 | 用途 |
|------|------|
| `npm install` | 安装前端依赖 |
| `npm run dev` | 启动 Vite 开发服务器 (默认 :5173) |
| `npm run build` | TypeScript 编译 (`tsc -b`) + Vite 生产构建 |
| `npm run preview` | 本地预览生产构建 |
| `npm run lint` | ESLint 全量检查 |
| `npm test` | Vitest 跑单测 + 集成测试一次 (`vitest run`) |
| `npm run benchmark:ux` | 仅跑 UX 基准测试 |
| `npm run e2e` | Playwright 全量 e2e（chromium + electron 项目） |
| `npm run e2e:cold-start` / `:full-flow` / `:fix-flow` / `:regression` | 单旅程 e2e |
| `npm run e2e:ui` | Playwright UI 调试器 |
| `npm run e2e:report` | 查看 e2e HTML 报告 |

### Electron 壳层 (`electron/`)

| 命令 | 用途 |
|------|------|
| `npm install` | 安装 Electron 依赖 |
| `npm run build:electron` | 仅 `tsc` 编译主进程 + preload → `dist-electron/` |
| `npm run electron:dev` | 编译后启动 Electron |
| `npm run dist:win` | 打包 Windows NSIS 安装程序 → `release/Writer Setup 1.0.0.exe` |
| `npm run dist:win_dir` | 仅生成解压目录（便携版） |

### 完整开发流程

```bash
# 终端 1
cd src/frontend && npm install && npm run dev

# 终端 2
cd electron && npm install && npm run electron:dev
```

发布打包时：先在 `src/frontend/` 执行 `npm run build`（产物输出到 `electron/frontend-build/`），再到 `electron/` 执行 `npm run dist:win`。

---

## 仓库结构

```
writer/
├── .claude/                    # Claude Code 项目配置（CLAUDE.md, AGENTS.md, skills）
├── .agents/                    # AI agent 协调（与 .claude/skills 镜像）
├── .github/workflows/          # CI
├── electron/                   # Electron 主进程 + preload + 构建配置
│   ├── main.ts                 # 主进程：窗口管理、IPC、Python 后端子进程管理、健康检查
│   ├── preload.ts              # contextBridge 暴露 IPC API 到渲染进程
│   ├── package.json            # electron-builder 配置（NSIS, AppImage, dmg）
│   └── public/icon.ico
├── read/                       # 架构参考子模块（只读，勿改）
│   └── reference-webnovel/     # 三界面架构灵感来源
├── src/
│   ├── frontend/               # React + Vite 应用
│   │   ├── src/
│   │   │   ├── App.tsx         # 顶层：三界面路由 + 背景层 + 全局 Provider
│   │   │   ├── main.tsx        # 入口：enableMapSet() + DEV 暴露 stores
│   │   │   ├── components/
│   │   │   │   ├── chat/       # 界面1：聊天初始化（ChatInitPage, ChatArea, CollectedInfoPanel…）
│   │   │   │   ├── settings/   # 界面2：设定编辑（SettingEditorPage, GraphCanvas, KanbanView…）
│   │   │   │   ├── writing/    # 界面3：正文写作（WritingEditorPage + 子模块：corkboard/snapshots/dashboard/ai/collaboration/linkage/toolbar/immersive/editor）
│   │   │   │   ├── shared/     # 全局 Provider/动画/主题/快捷键/命令面板/背景
│   │   │   │   └── ui/         # shadcn/ui 原语 + 自定义封装（Button, Card, Toast, MagneticButton, MaterialCard, GlassCard…）
│   │   │   ├── store/          # Zustand 切片（详见下节）
│   │   │   ├── api/            # 后端 REST + WebSocket 客户端（按域分文件）
│   │   │   ├── services/       # 纯前端服务（exportService, versionService, writingStatsService）
│   │   │   ├── hooks/          # 自定义 React hooks（主题/沉浸/快捷键/滑动）
│   │   │   ├── styles/         # design-tokens.css 是色彩 SSOT，其余 CSS 文件引用 token
│   │   │   ├── constants/  types/  utils/  lib/
│   │   │   └── __tests__/      # Vitest 单元 + 集成测试
│   │   ├── e2e/
│   │   │   ├── journeys/       # Playwright 旅程：cold-start / full-flow / regression
│   │   │   └── fixtures/       # global-setup, global-teardown, setup-journey, ai-jsonl-reporter
│   │   ├── playwright.config.ts
│   │   ├── vite.config.ts      # 含手动分包（vendor-react/motion/icons/ui/tiptap/force-graph/zustand/charts）
│   │   └── tsconfig.json       # strict + noUnusedLocals + noUnusedParameters + `@/*` 路径别名
│   └── backend/                # ✅ LIVE 系统：FastAPI/Python 后端。electron/main.ts:201-301 启动 Python 子进程 + 后端 18 个路由（chat / ai_generate / projects / characters / items / locations / factions / world_settings / rules / ai_provider / outlines / chapters / drafts / chat_ws / ai_review / ai_fill_fields / ai_rewrite_description / ai_generate_entity）+ alembic 迁移 + 健康检查。所有"后端"API 调用走 http://127.0.0.1:8000。详见 docs/plans/ralplan-comprehensive-audit-2026-07-21-v0.4.md §2.4 F-E-11。
└── README.md
```

---

## 架构要点

### 三界面路由

`App.tsx` 用 `useUIStore.currentInterface`（`'chat' | 'settings' | 'writing'`）做顶层 switch，三个页面组件全部 `lazy()` 动态导入，每个都包 `<ErrorBoundary>` + `<Suspense>`。背景由 `UnifiedBackground`（Canvas/CSS 混合）单层管理，根据 `interfaceType` 切换模式/密度/速度，沉浸模式降低背景透明度。

### Zustand 切片（`src/frontend/src/store/`）

每个切片为独立文件，导出 `useXxxStore` + 选择器 + `cleanupXxxStore()`。全部入口在 `store/index.ts`。**状态变化时优先加新切片而非膨胀旧切片。**

| 切片 | 职责 |
|------|------|
| `uiStore` | 当前界面、抽屉、面板尺寸、主题、显示模式、沉浸/焦点模式 |
| `chatStore` | 聊天会话、流式状态、已收集实体（含 `migrateChatToSettings`） |
| `settingsStore` | 设定实体（角色/物品/地点/势力/规则/大纲/IF线）+ 关系（由 `settingsDataSlice`/`UISlice`/`ValidationSlice` 组合） |
| `writingStore` | 当前章节、草稿版本、写作会话、自动保存、写作配置、风格 |
| `contentStore` | 章节、大纲、IF 线、伏笔、检查报告 |
| `aiStore` | 生成队列（AIGenerationJob）、流式、风格预设 |
| `syncStore` | IF 线同步状态（用 `Map`/`Set`） |
| `checkerStore` | 一致性/连续性/节奏/OOC/钩子/读者吸引力 |
| `contextStore` | AI 上下文包 |
| `linkageStore` | 章节↔实体 关联追踪 |
| `analyticsStore` | 钩子分析、债务报告、参与度评分 |
| `systemStore` | 类型、工作流、执行、指标、债务、约束规则 |
| `projectDataStore` | 快照、备份、导入导出 |
| `aiProviderStore` | AI 提供商/API Key 配置 |
| `templateStore` | 模板 |
| `editorRegistry` | 编辑器实例注册中心（用于非选中触发 AI） |

**immer MapSet 必需：** `main.tsx` 顶部调用 `enableMapSet()`，否则任何含 `Map`/`Set` 字段的 store（如 `syncStore.IFLineSyncState`）运行时会抛 `[Immer] The plugin for 'MapSet' has not been loaded`。新增使用 Map/Set 的 store 后务必在 e2e 实际触发，否则只在测试里 `enable` 会漏掉生产路径。

**e2e 测试钩子：** `main.tsx` 在 `import.meta.env.DEV` 下把核心 store 挂到 `window.__writerE2E`，供 Playwright 调用尚未有 UI 入口的 action（如 `migrateChatToSettings`）。生产构建会自动 tree-shake。

### Electron ↔ Renderer

- `electron/preload.ts` 通过 `contextBridge` 暴露安全 IPC API。
- `electron/main.ts` 负责窗口状态持久化（`userData/state/window-state.json`）、健康检查、自动重启后端子进程、Splash 窗口。
- 渲染进程通过 `src/frontend/src/api/electron.ts` 调用 IPC，通过 `src/frontend/src/api/*.ts` 调用后端 REST，通过 `websocket.ts` 接收流式。

### AI 协作系统

六大 AI 操作对应快捷键：`Ctrl+Shift+O/E/S/R/W/P`（优化/扩写/缩写/改写/续写/润色）。AI 调用统一走 `aiStore` 的 job 队列（`processNextJob` 必须 mutate draft，不要直接修改外部冻结引用 — 近期修复见 git log）。"无选中触发"通过 `editorRegistry` 拿到当前光标位置。

### 数据持久化

全部本地：Electron `userData` 目录下的 JSON + IndexedDB（`store/utils/indexedDBStorage.ts` 提供）。**后端 = src/backend/ LIVE 系统**（FastAPI + SQLite + alembic），由 electron/main.ts 启动 Python 子进程在 127.0.0.1:8000 监听；前端 @/api/* 调用走 `getBackendUrl()` + axios。

---

## 开发约定

### TypeScript

- `strict: true`，`noUnusedLocals` + `noUnusedParameters` — 未使用的局部变量/参数会编译失败，写代码时及时清理。
- 路径别名 `@/*` → `src/*`（Vite 与 TS 都已配置）。
- `src/**/*.test.ts(x)` 在 tsconfig 中排除，但会被 Vitest 收集。

### 命名

| 类型 | 约定 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `MaterialCard.tsx`、`GlassCard.tsx` |
| shadcn/ui 原语 | 小写/kebab-case（保持 shadcn 约定） | `accordion.tsx`、`scroll-area.tsx` |
| 工具/服务 | camelCase | `utils.ts`、`entityColors.ts` |
| Hook | camelCase + `use` 前缀 | `useTheme.ts` |
| CSS | kebab-case | `design-tokens.css`、`globals.css` |
| 索引 | 小写 | `index.ts` |

### 样式（**色彩 SSOT = `src/frontend/src/styles/design-tokens.css`**）

CLAUDE.md 列出的色板仅作描述参考；实际定义都在 `design-tokens.css` 的 `:root` CSS 变量中。所有其它 CSS 文件通过 `var(--ink-100)` 等引用，**禁止在其它位置硬编码颜色值**。修改色彩只需改 token 文件。

### 提交规范

近期提交遵循 `[tier:<scope>] <type>(<scope>): <subject>` 格式（例：`[tier:mechanism] fix(frontend): enable immer MapSet plugin for syncStore`）。常用 type: `feat` / `fix` / `refactor` / `test` / `docs`。Commit footer 包含 `Co-Authored-By: 1225Sakura <...>`。

### Agent 协调

`.claude/AGENTS.md` 定义了 AI 文本生成 agent 的角色分工（writer / planner / researcher / reviewer / executor），与代码 Claude Code 无关；代码任务使用项目根的 `.claude/CLAUDE.md`（即本文件）+ 用户级 OMC 配置。

---

## 测试

- **单元/集成：** Vitest，文件在 `src/__tests__/` 或就近 `*.test.ts(x)`。`npm test` 单次运行（不 watch）。Store 测试常驻 — 修改 store 后**必须**跑 store 单测 + 至少一个相关 e2e 旅程。
- **UX 基准：** `npm run benchmark:ux` 跑性能/可交互性指标。
- **E2E：** Playwright + 两项目（`chromium`：裸浏览器 UI 烟雾测试；`electron`：完整桌面壳）。`globalSetup` 拉起 Vite (`npm run dev`) 和 Python 后端。**per-journey 隔离**通过 `WRITER_DATA_DIR` + `--user-data-dir` 保证（见 `playwright.config.ts` 头部注释）。
- 写完代码后至少跑 `npm run lint` + 相关 vitest 文件 + 触及改动面的 e2e 旅程。

---

## 调试技巧

- 渲染进程：DevTools 在 Electron 开发模式自动打开；前端 dev server 单独跑时用普通 Chrome。
- 主进程：日志前缀 `[Electron]`；窗口状态/后端子进程状态在主进程 stdout。
- 后端 (如还在使用)：通过 `electron_launcher.py` 启动；`WRITER_DATA_DIR` 控制数据目录。
- Store 状态：浏览器控制台 `window.__writerE2E.useChatStore.getState()` 可直接查看（仅 dev）。
- 单测调试：`npx vitest run <pattern> --reporter=verbose`。

---

## 约束（与 `.claude/CLAUDE.md` 一致）

- 仅本地桌面应用，不做移动端/Web 端。
- 不部署本地模型，纯外部 API 调用。
- 不做出版级校对/语法检查。
- 不做多语言/翻译功能。
- 无移动端/Web 端（仅本地桌面应用）。
- `src/backend/` 是 **LIVE** 系统（非 dead code）—— 18 个 FastAPI 路由 + alembic + SQLite + Python 子进程；详见仓库结构表 + docs/plans/ralplan-comprehensive-audit-2026-07-21-v0.4.md §2.4 F-E-11。

## 快捷键速查

| 操作 | 快捷键 |
|------|--------|
| 优化 / 扩写 / 缩写 / 改写 / 续写 / 润色 | `Ctrl+Shift+O/E/S/R/W/P` |
| 切换 AI 抽屉 | `Ctrl+\` |
| 切换协作面板 | `Ctrl+/` |
| 保存 | `Ctrl+S` |
| 全屏写作 | `F11` |
| 上一章 / 下一章 | `Ctrl+Shift+Up/Down` |
| 命令面板（输入 `/` 触发 AI 操作） | 见 `CommandPalette` |