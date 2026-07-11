---
title: D:/writer 目录结构清理设计 (2026-07-11)
description: 移除所有后端代码与后端运行时产物，仅保留前端 + Electron + 参考项目；为后续从零重建后端做准备
created: 2026-07-11
status: approved
---

# D:/writer 目录结构清理设计

## 背景

项目当前状态：完整的 v3.0.0 后端（FastAPI + Pydantic + LiteLLM，12 个 agents）于 2026-07-09 完成重写并通过 `src/backend/` 提交。但 2026-07-11 用户决定反转该决策：

> "重新从0开始建立后端，前端必须要保留"

本次任务仅完成**目录清理**，**不涉及新后端设计**（新后端由用户自行设计）。

## 目标

将 `D:/writer/` 简化为仅含前端栈的最小项目目录，为后续从零重建后端提供干净起点。

## 非目标

- 不设计新后端的架构
- 不迁移任何后端代码到保留位置
- 不删除 OMC 操作基础设施（`.omc/`、`.claude/`、`.github/`、`.agents/`）

## 最终目录结构

```
D:/writer/
├── src/frontend/         ← React 前端 (含 node_modules)
├── electron/             ← Electron 包装
│   ├── main.ts, preload.ts, package.json, tsconfig.json
│   ├── public/           ← 图标等静态资源
│   ├── node_modules/
│   ├── frontend-build/   ← 前端构建产物
│   ├── dist-electron/    ← electron 编译产物
│   └── release/          ← 安装包输出
├── read/                 ← 参考项目 (AI_NovelGenerator, FastAPI-Reference-App 等)
├── README.md             ← 项目说明 (重写)
├── .claude/              ← Claude Code 配置
├── .omc/                 ← OMC 操作基础设施
├── .github/、.agents/   ← CI 与 agent 定义
├── .gitignore            ← 移除后端特定模式
└── .git/
```

## 删除清单

### A. 后端代码与运行时（核心）

| 路径 | 说明 |
|------|------|
| `src/backend/` | 完整目录: `pyproject.toml`、`alembic/`、`alembic.ini`、`app/`、`tests/`、`smoke.db`、`.venv/`、`.env.example`、`.gitignore`、`.legacy_tests/`、`.pytest_cache/`、`.build_logs/`、`.ruff_cache/`、`.omc/`、README.md |
| `src/data/` | 测试与开发数据 (writer.db、test_*.db、archives、backups、cache、content、snapshots) |
| `src/rag/` | 向量库 (vectors.db) |
| `src/shared/` | 共享类型 (后端与前端共享) |
| `src/logs/` | 后端运行日志 |

### B. 根目录运行时数据

| 路径 | 说明 |
|------|------|
| `data/` | app.db、archives、backups、cache、content、e2e_test.db、snapshots、test_*.db |
| `rag/` | vectors.db |

### C. 后端文档与状态

| 路径 | 说明 |
|------|------|
| `backend-review/` | 10 个 .md 后端审查文档 |
| `.omc/specs/` | **除本 spec 外全部删除**（含 backend-redesign-2026-07-09、deep-interview-backend-*、deep-interview-agent-*、deep-interview-chat-*、deep-interview-frontend-*、deep-interview-writing-*、deep-interview-style-*、deep-interview-ecosystem-upgrade、deep-interview-full-*、deep-interview-model-api-config、deep-interview-self-use-mvp、deep-interview-setting-editor、deep-interview-system-management-fix、deep-interview-workflow-frontend-gaps、deep-interview-writer-backend、deep-interview-fix-ux-*、deep-interview-frontend-backend-fix 等）|
| `.omc/plans/` | **全部删除**（含 backend-*、agent-*、ralplan-*、frontend-*、full-*、model-api-config、phases-2-6-plan、phase1-context-kg-plan、ralplan-mvp-minimal、ralplan-technical-roadmap-v2、ralplan-self-use-mvp、ralplan-chat-*、ralplan-frontend-*、ralplan-writing-*、ralplan-setting-editor、ralplan-backend-*、test-baseline-*、writing-ui-overhaul、workflow-frontend-gaps-completion、writer-backend-completion 等）；含 `archive/` 子目录 |
| `.omc/state/agent-replay-*.jsonl` | agent 运行日志 |
| `.omc/state/hud-stdin-cache.json` | HUD 缓存（按 .gitignore 已忽略）|
| `.omc/state/sessions/` | 会话状态（按 .gitignore 已忽略）|

### D. 整体删除的目录

| 路径 | 说明 |
|------|------|
| `docs/` | 整体删除 (含 AGENTS.md、API.md、ARCHITECTURE.md、BACKEND_ARCHITECTURE.md、DEVELOPER.md、SECURITY_AUDIT.md 等所有内容) |
| `config/` | 整体删除 (backend/、ci/、dev/、electron/build.json.example、project/Makefile、project/VERSION、docker-compose.yml) |
| `scripts/` | 整体删除 (init_db.py、migrate_embeddings_to_vec.py、health_check.py、backup.py、restore.py、build.sh、local-build.ps1、export_project.py、import_project.py、version-bump.js、version-sync.js) |
| `build-local.bat` | 包装器，因 `scripts/local-build.ps1` 删除而失效 |
| `.venv/` | Python 虚拟环境 |
| `.pytest_cache/` | pytest 缓存 |
| `.ruff_cache/` | ruff 缓存 |
| `.build_logs/` | 旧构建日志目录 |

### E. 临时与杂项文件

| 路径 | 说明 |
|------|------|
| `pytest.ini` | Python 测试配置 |
| `coverage-output.txt` | 测试覆盖率报告 |
| `.build_local_20260423_122805.log` | 旧构建日志 |
| `cleanup-batch1.ps1`、`cleanup-scan-1.ps1`、`cleanup-scan-2.ps1`、`cleanup-scan-3.ps1`、`cleanup-scan-3b.ps1`、`cleanup-scan-3c.ps1` | 6 个清理脚本 |
| `hist.json`、`r.bin`、`r.json`、`rev.json` | 旧 OMC 状态文件 |

## 需要更新的文件

### 1. `electron/package.json`

删除 `build.extraResources` 中对 `../src/backend/.venv` 和 `../src/backend` 的引用，删除 `build.asarUnpack` 中 `resources/backend/**/*` 引用。否则 electron-builder 打包会因路径不存在报错。

**具体修改：** 删除 `extraResources` 整个数组（两个对象都引用已删除的 `src/backend/`），删除 `asarUnpack` 数组。

### 2. `.gitignore`

移除以下行（因对应的目录/文件不存在或将被删除）：

```gitignore
# Virtual Environment
venv/
ENV/
env/
.venv

# SQLite
*.db
*.sqlite
*.sqlite3

# Pytest
.pytest_cache/
tests/.pytest_cache/
.pytest_cache/
.pytest_cache/

# Database
src/backend/db/*.db
src/backend/.db

# Data
data/
```

### 3. `.claude/CLAUDE.md`（项目指令）

整体重写：移除"待完善章节"中的后端 API 描述、技术栈段落（FastAPI/SQLAlchemy/uvicorn 等）、"构建系统"段落（local-build.ps1、build-local.bat 相关），保留前端栈说明。

### 4. `README.md`

重写：移除后端相关章节（API 设计、AI 生成模式），仅描述前端 + Electron + 项目目标。

### 5. `.git/hooks/post-commit`

如存在，删除或修改（因 `build-local.bat` 已删除，hook 失去意义）。

## 保留的 OMC 基础设施

| 路径 | 状态 |
|------|------|
| `.omc/specs/` | 仅保留本 spec 文档 (2026-07-11-cleanup-design.md)，其他全部删除 |
| `.omc/plans/` | 全部删除（目录保留但内容清空） |
| `.omc/research/` | 入口保留 |
| `.omc/sessions/`、`phases/`、`artifacts/`、`handoffs/` | 运行基础设施，保留 |
| `.omc/state/` | 操作状态，按 .gitignore 忽略 |
| `.omc/notepad.md`、`project-memory.json` | 状态文件，按 .gitignore 忽略 |
| `.omc/template-version.json`、`prd/` | 按 .gitignore 忽略 |
| `.claude/` | Claude Code 配置，全部保留 |
| `.github/` | GitHub workflows，保留 |
| `.agents/` | Agent 定义，保留 |

## 执行流程

按以下顺序执行（每步用 `git add` 检查暂存区状态）：

1. **预检**：`git status --short --branch` 确认当前工作树状态
2. **删除后端代码**：`git rm -r src/backend/`（删除已跟踪文件）
3. **删除后端运行时**：`git rm -r src/data/ src/rag/ src/shared/ src/logs/`
4. **删除根目录数据**：`git rm -r data/ rag/` 或 `rm -rf data/ rag/`（如未跟踪）
5. **删除 .omc/specs/ 与 .omc/plans/**：`rm -f` 删除 .omc/specs/ 下除 2026-07-11-cleanup-design.md 外的所有文件；`rm -f` 与 `rm -rf` 删除 .omc/plans/ 全部内容（含 archive/ 子目录）
6. **删除状态**：`rm -f` 删除 .omc/state/agent-replay-*.jsonl
7. **删除后端审查**：`git rm -r backend-review/`
8. **删除配置/脚本/文档目录**：`git rm -r config/ scripts/ docs/`
9. **删除 build-local.bat**：`git rm build-local.bat`
10. **删除缓存与临时**：`rm -rf .venv/ .pytest_cache/ .ruff_cache/ .build_logs/`；`rm -f` 删除 `*.log`、`cleanup-*.ps1`、`hist.json`、`r.bin`、`r.json`、`rev.json`、`pytest.ini`、`coverage-output.txt`
11. **更新 electron/package.json**：编辑删除 `extraResources` 与 `asarUnpack`
12. **更新 .gitignore**：编辑移除后端相关模式
13. **更新 .claude/CLAUDE.md**：编辑移除后端描述
14. **更新 README.md**：编辑重写为前端栈说明
15. **更新 post-commit hook**：删除或修改
16. **验证**：`git status --short` 确认无未预期的暂存/未跟踪条目
17. **运行前端构建**（验证未破坏）：`cd src/frontend && npm run build` → 确认 `dist/` 生成
18. **运行 electron 编译**：`cd electron && npm run build:electron` → 确认 `dist-electron/main.js` 生成
19. **提交**：`git add -A && git commit -m "cleanup: 移除所有后端代码与运行时产物"`

## 风险与回滚

- **不可逆风险**：删除的 SQLite 数据库与向量库无法恢复（仅当用户后悔且想取回时不可逆；本次任务用户明确同意删除）
- **可逆风险**：删除配置文件（`electron/package.json`、`.gitignore`、CLAUDE.md、README.md）有 git 历史可回滚
- **回滚命令**：`git reset --hard HEAD@{1}` 回到清理前状态

## 验证标准

清理完成后，必须满足：

1. `git status` 显示的工作树状态与"最终目录结构"一致
2. `ls -la` 根目录仅显示保留项（src、electron、read、.claude、.omc、.github、.agents、README.md、.gitignore、.git）
3. `cd src/frontend && npm run build` 成功
4. `cd electron && npm run build:electron` 成功
5. `git diff HEAD` 显示仅配置文件修改，无未预期删除

## 不在范围内（后续任务）

- 新后端的技术栈选型
- 新后端的目录结构设计
- 新后端的 API 契约
- 前后端数据流
- 任何 `.omc/specs/` 中新后端的设计文档
