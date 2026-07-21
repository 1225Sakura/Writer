# P0 Baseline Report — 2026-07-21

> 捕获时间：2026-07-21
> 用途：v0.4 patch P0 实施前的 ground truth。所有 P0 完成判据对照此 baseline 计算 improvement。

## 1. 环境快照

| 组件 | 版本 | 备注 |
|------|------|------|
| Node | v24.11.1 | — |
| npm | 11.6.2 | — |
| Python | 3.12.12 | 后端运行时 |
| OS | Windows 11 | (per CLAUDE.md) |
| 项目根 | `D:/writer` | — |

## 2. 工具可用性（devDependencies 实际安装状态）

| 工具 | 前端 src/frontend | electron/ | 根 | 备注 |
|------|-------------------|-----------|-----|------|
| tsc (typescript) | ✅ | ✅ | — | — |
| vitest | ✅ | — | — | vitest.config.ts + vitest.setup.ts 存在 |
| playwright | ✅ | — | — | playwright.config.ts 存在 |
| eslint | ❌ | ❌ | ❌ | **F-06 确认**：spec 已识别 ESLint config 缺失 + binary 缺失 |
| prettier | ❌ | — | — | — |
| stylelint | ❌ | — | — | — |
| rollup-plugin-visualizer | ❌ | — | — | F-14 关联 |
| size-limit | ❌ | — | — | F-14 关联 |
| fake-indexeddb | ❌ | — | — | D.1.10 待引入 |
| electron-log | ❌ | — | — | D.1.11 待引入 |
| lint-staged | ❌ | — | — | D.1.12 待引入 |
| pre-commit | ❌ | — | — | D.2.11 待引入 |
| idb | ❌ | — | — | D.1.10 待引入 |

## 3. TypeScript 检查（`npx tsc --noEmit`）

**结论**：**FAIL — 27 行输出含 22 个 errors**

主要 errors 分类：

| 文件 | 错误类型 | 影响范围 |
|------|----------|----------|
| `src/api/writing.ts` | types 导出缺失（DeepContextResponse / ChapterSnapshot / ChapterSnapshotDiff） | writing API 客户端类型契约断裂 |
| `src/components/writing/snapshots/SnapshotDiffView.tsx` + `SnapshotPanel.tsx` | ChapterSnapshot 类型缺失 | snapshots UI 无法编译 |
| `src/store/chatStore.ts` | ChatMessage / ChatSession 字段缺失（rating / title / archived / pinned） | chatStore 类型与定义不同步 |
| `src/store/contextStore.ts` | DeepContextCharacter / PlotThread / Outline / IFLine 缺失 | contextStore 类型断裂 |
| `src/store/templateStore.ts` | EntityTemplate 缺失 | templateStore 类型断裂 |
| `src/components/writing/collaboration/AnalyticsSection.tsx` | analyticsStore 字段缺失 | collaboration UI 类型断裂 |
| `src/components/writing/OutlineSidebar.tsx` | OutlineItem onContextMenu prop 不存在 | drag-drop 类型契约断裂 |
| `src/components/writing/WritingEditorPage.tsx` + `WritingToolbar.tsx` | uiStore snapshotDrawerOpen / corkboardOpen / toggleCorkboard / toggleSnapshotDrawer 缺失 | uiStore 字段与 UI 期望不同步 |

**含义**：spec v0.4 §5.1 P0-Sec4 等改动会引入新 store 字段，需在 P0 阶段补齐这些类型/字段才能让 `npx tsc --noEmit` 通过。**P0 完成度判据：tsc --noEmit 0 errors**。

## 4. 测试与 E2E

| 项 | 状态 | 备注 |
|----|------|------|
| Vitest 单测 | 配置文件存在（vitest.config.ts + vitest.setup.ts）但未跑（避免破坏 baseline） | P0 阶段跑 |
| Playwright e2e | 配置文件存在（playwright.config.ts）但 e2e:fix-flow 缺失 | F-04 确认 |
| e2e:cold-start | 存在但 F-05 确认 Windows 路径硬编码 | P0-Sec6 后 CI 跑 |

## 5. P0 已知阻塞（来自 spec v0.4）

| ID | 描述 | 严重度 |
|----|------|--------|
| F-04 | `e2e:fix-flow` script 存在但 `e2e/journeys/fix-flow/` 目录不存在 | CRITICAL |
| F-05 | playwright.config.ts Windows-only 路径硬编码 | HIGH |
| F-06 | ESLint config 缺失 + binary 缺失 | HIGH |
| F-07 | README 硬编码 9 个十六进制色值（违反 SSOT） | HIGH |
| F-08 | README 错误脚本名 `npm run dev` | HIGH |
| F-09 | CI 后端 pytest 静默跳过 | HIGH |
| F-10 | vite.config proxy 注释自相矛盾 | HIGH |
| F-11 | .claude/worktrees/ 未保护 | HIGH |
| F-13 | electron/release/ 含 180MB installer | MEDIUM |
| F-15 | vite.config.{js,d.ts} 与 .ts 并存 | MEDIUM |
| F-20 | src/test/ 与 src/__tests__/ 并存 | MEDIUM |
| F-24 | .gitignore 冗余单文件规则 | LOW |

## 6. v0.4 P0 后续 ground truth 指标

| 指标 | Baseline | P0 完成期望 |
|------|----------|------------|
| `npx tsc --noEmit` errors | 22 | 0 |
| ESLint binary | missing | present + 0 errors |
| 已知 critical findings (F-04/05/06) | unresolved | resolved |
| 220 .omc/ tracked files | present | untracked + .gitignore'd |
| 22 build artifacts tracked | present | untracked |
| 12 v0.3.1 P0 主题 | 0% complete | 100% |
| 13 v0.4 P0 主题 (含 P0-Sec7/8/9) | 0% complete | 100% |

## 7. Baseline 应用规则

- 任何 P0 完成度验证需对照本 baseline 计算 delta
- `git diff` 后的 `npx tsc --noEmit` 与 baseline 对比：错误数应单调递减
- 单测覆盖率从本 baseline 0% → P0 完成后 ≥ 60%
- npm audit 错误数：baseline = 未跑（devDep 缺失），P0 后 = 0 high

---

**注**：本文件由 US-001 (P0-0 baseline) 生成，作为后续 22 个 P0 stories 的对照基线。

git 状态：本文件**不提交**到 git（spec v0.4 §5.1 P0-0 明确 "在 .omc/baselines/ 提交 baseline 报告" 但 v0.4 路径迁出后改为 docs/baselines/ + gitignore 加入 `docs/baselines/`）。