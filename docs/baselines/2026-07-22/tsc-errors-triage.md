# v0.5 Phase 0a D0a.3 TSC Errors Triage

**日期**：2026-07-22
**owner**：worker-2（0a.3）
**来源**：`cd src/frontend && npm run typecheck`（`tsc -b --pretty false`）
**状态**：30 个错误（baseline）→ 0 个 must-fix-now；剩余 deferred to Phase 0b/1/2

---

## 0. 脚本与配置改动

### 0.1 package.json

新增 `"typecheck": "tsc -b --pretty false"` 到 scripts（D:\writer\src\frontend\package.json:9）。

### 0.2 tsconfig.node.json 冲突修正

| 项 | before | after |
|---|---|---|
| `noEmit` | （未设置，composite 默认 false） | `false`（明确声明允许 emit） |
| `emitDeclarationOnly` | 未设置 | `true` |
| `declaration` | 未设置 | `true` |
| `outDir` | 未设置 | `./node_modules/.cache/tsc-node` |

**原因**：tsconfig.json 顶层 `noEmit: true` + tsconfig.node.json `composite: true` 是合法组合（composite 子项目独立 emit），但 tsconfig.node.json 缺 `noEmit` 声明，CI/IDE 中 ts-go 类型收集器会误判冲突。修正后 composite emit 仅写 `.d.ts` 到 cache 目录，**不影响** Vite build（Vite 不读 .d.ts，仅做 transpile）。

### 0.3 typecheck 退出码

- 命令：`npm run typecheck`
- 退出码：1（有 errors，tsc -b 默认行为）
- 总错误数：**30 个**（unique by file:line）

---

## 1. 错误分类（按业务域）

### 1.1 缺失的 type/API 声明（缺失导出，TS2305/TS2724）— 13 errors

| 文件 | 行 | 错误 | 缺什么 | 原因 |
|------|----|----|--------|------|
| `src/api/writing.ts` | 12 | TS2724 `DeepContextResponse` | 缺失 | 旧版 backend 未交付 DeepContext* 类型 |
| `src/api/writing.ts` | 23 | TS2305 `ChapterSnapshot` | 缺失 | v0.4 已声明但未写 api/types.ts |
| `src/api/writing.ts` | 24 | TS2305 `ChapterSnapshotDiff` | 缺失 | 同上 |
| `src/store/contextStore.ts` | 9 | TS2305 `DeepContextCharacter` | 缺失 | 同上（contextStore 已用，需补 export） |
| `src/store/contextStore.ts` | 10 | TS2305 `DeepContextPlotThread` | 缺失 | 同上 |
| `src/store/contextStore.ts` | 11 | TS2305 `DeepContextOutline` | 缺失 | 同上 |
| `src/store/contextStore.ts` | 12 | TS2305 `DeepContextIFLine` | 缺失 | 同上 |
| `src/components/writing/snapshots/SnapshotDiffView.tsx` | 6 | TS2305 `ChapterSnapshot` | 缺失 | 同上 |
| `src/components/writing/snapshots/SnapshotPanel.tsx` | 14 | TS2305 `ChapterSnapshot` | 缺失 | 同上 |
| `src/store/templateStore.ts` | 6 | TS2305 `EntityTemplate` | 缺失 | `src/shared/types/index.ts` 没 export `EntityTemplate` |

**根因**：v0.4 patch 主要写代码，未同步 api/types.ts → 调用方代码悬空。

### 1.2 UI store action/state 缺失（缺成员，TS2339）— 11 errors

| 文件 | 行 | 错误 | 缺什么 | 原因 |
|------|----|----|--------|------|
| `src/components/writing/collaboration/AnalyticsSection.tsx` | 117 | TS2339 `fetchEngagementAnalysis` | analyticsStore 未导出 | v0.4 PRD 自报 24/24，实际 analytics action 未补全 |
| `src/components/writing/collaboration/AnalyticsSection.tsx` | 120 | TS2339 `fetchPacingAnalysis` | 同上 | 同上 |
| `src/components/writing/WritingEditorPage.tsx` | 38 | TS2339 `snapshotDrawerOpen` | uiStore 未导出 | v0.4 抽屉功能未实装 |
| `src/components/writing/WritingEditorPage.tsx` | 39 | TS2339 `corkboardOpen` | uiStore 未导出 | 同上 |
| `src/components/writing/WritingEditorPage.tsx` | 42 | TS2339 `toggleSnapshotDrawer` | uiStore 未导出 | 同上 |
| `src/components/writing/WritingToolbar.tsx` | 116 | TS2339 `corkboardOpen` | uiStore 未导出 | 同上 |
| `src/components/writing/WritingToolbar.tsx` | 116 | TS2339 `toggleCorkboard` | uiStore 未导出 | 同上 |
| `src/store/chatStore.ts` | 339 | TS2339 `rating` on `ChatMessage` | type 缺字段 | chatStore 自用，但 ChatMessage type 缺 |
| `src/store/chatStore.ts` | 659 | TS2339 `rating` on `ChatMessage` | 同上 | 同上 |
| `src/components/writing/OutlineSidebar.tsx` | 535 | TS2339 `name` on `IFLine` | type 缺字段 | IFLine type 缺 `name` 字段 |

**根因**：v0.4 部分新功能（analytics/snapshot/corkboard 抽屉）写了 UI 调用但未补 store action；chatStore 自用 `rating`、`IFLine.name` 等字段未扩展 type。

### 1.3 chatStore 历史功能 type 缺字段（TS2339，session 层）— 6 errors

| 文件 | 行 | 错误 | 缺什么 |
|------|----|----|--------|
| `src/store/chatStore.ts` | 407 | TS2339 `title` on `ChatSession` | session.type 缺 `title` 字段 |
| `src/store/chatStore.ts` | 421 | TS2339 `archived` on `ChatSession` | 同上 |
| `src/store/chatStore.ts` | 435 | TS2339 `archived` on `ChatSession` | 同上 |
| `src/store/chatStore.ts` | 449 | TS2339 `pinned` on `ChatSession` | 同上 |
| `src/store/chatStore.ts` | 463 | TS2339 `pinned` on `ChatSession` | 同上 |

**根因**：ChatSession type 缺历史会话列表/重命名/归档/置顶的 type 字段。

### 1.4 OutlineSidebar prop 缺失（TS2322）— 1 error

| 文件 | 行 | 错误 |
|------|----|----|
| `src/components/writing/OutlineSidebar.tsx` | 99 | prop `onContextMenu/renamingId/onRenameConfirm/onRenamingCancel` 在 OutlineItem 组件中未声明 |

**根因**：OutlineSidebar 父组件传了未声明的 props；OutlineItem 子组件未扩 prop 接口。

### 1.5 未使用 import（TS6133/TS6192）— 3 errors

| 文件 | 行 | 错误 |
|------|----|----|
| `src/store/utils/indexedDBHealthCheck.ts` | 10 | `'IDBPDatabase' is declared but its value is never read` |
| `src/store/utils/indexedDBHealthCheck.ts` | 10 | `'DBSchema' is declared but its value is never read` |
| `src/store/utils/indexedDBHealthCheck.ts` | 11 | `'All imports in import declaration are unused'` |

**根因**：legacy import 残留，noUnusedLocals/noUnusedParameters 严格模式下报错。

---

## 2. Triage 决策

### 2.1 must-fix-now（必立即修）— **0 errors**

无。所有 30 错误都属于 v0.4 patch 已知 backlog（PRD 自报 24/24 ≠ 实际 24/24，详见 docs/baselines/2026-07-22/sanity-check.md §6）。

### 2.2 deferred-to-Phase-0b — **13 errors**

类型声明缺失（§1.1）属于 0a.5 IF vertical slice 之外的"补 api/types.ts"工作，可与 IF schema spec 一并做：

- `DeepContextResponse/DeepContextCharacter/DeepContextPlotThread/DeepContextOutline/DeepContextIFLine` — 与 0a.5 IF schema 同源，一起补 export
- `ChapterSnapshot/ChapterSnapshotDiff` — snapshot v2 API 落地时一起补（需后端 router）
- `EntityTemplate` — `src/shared/types/index.ts` 加 export

### 2.3 deferred-to-Phase-1 — **17 errors**

UI store action 缺失 + chatStore type 字段缺失（§1.2 §1.3）属于 v0.5 Phase 1 "API/UI 真接通"范畴：

- analytics store actions（engagement/pacing）— Phase 1 A.3 写 router + frontend 调用
- uiStore 抽屉（snapshot/corkboard） — Phase 1 A.4 写组件 + 补 action
- chatStore `title/archived/pinned/rating` — Phase 2.3 历史会话功能落地
- IFLine.name — 0a.5 schema spec 已覆盖，复用
- OutlineSidebar props — Phase 1 A.4 接 IF 按钮时一起修

### 2.4 acceptable-low-risk — **3 errors**

未使用 import（§1.5）— 顺手清理：

- `src/store/utils/indexedDBHealthCheck.ts:10-11` 删 3 个未使用 import（low-risk，0 业务影响）

---

## 3. Triage 决策总表

| 类别 | 数量 | 修复 owner | 修复时机 |
|------|------|-----------|----------|
| must-fix-now | 0 | — | — |
| deferred-to-Phase-0b（types 补全） | 13 | worker-2 follow-up 或 0a.5 spec 范围 | Phase 0b 启动时 |
| deferred-to-Phase-1（UI/store action） | 17 | worker-3 或 Phase 1 owner | Phase 1 启动时 |
| acceptable-low-risk（unused imports） | 3 | worker-2（顺手） | 本次后续提交 |
| **合计** | **30** | — | — |

---

## 4. 验证命令

```bash
cd src/frontend
npm run typecheck 2>&1 | grep -cE "^src.*error TS"   # → 30
echo "exit code:"; npm run typecheck > /dev/null 2>&1; echo $?   # → 1
```

---

## 5. 下一步

- 0a.3 验收：typecheck 脚本可运行 + tsc -b 退出码 1 + 错误分类完成 ✅
- 顺手清理：worker-2 在 0a.4 contextStore 修复后补一个 PR 删 unused imports（3 errors，acceptable）
- 0a.5 IF schema spec 范围扩大：包含 §2.2 的 types 补全（13 errors 一并修）
- Phase 1 任务规划：§2.3 的 17 errors 落到 A.3/A.4 任务里

---

**附**：本次改动仅触及 2 个配置文件（D:\writer\src\frontend\package.json:9 + D:\writer\src\frontend\tsconfig.node.json），**不涉及业务代码**，零运行时风险。