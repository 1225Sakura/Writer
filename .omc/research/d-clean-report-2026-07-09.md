# D-clean 报告 — 2026-07-09

## 清理摘要

| 项目 | 释放 | 状态 |
|---|---|---|
| `src/backend/` | 611 KB | 已删除（54 个文件，含 alembic/env.py、pyproject.toml） |
| `src/backend-old/` | 133 MB | 已删除（5,700 个文件，完整旧后端） |
| `backend/` (root) | 1.3 MB | 已删除（简化版 34 routes） |
| `.omc/state/*` | （含 4 个 tracked 文件） | 已删除 |
| `.omc/sessions/*` | 多文件 | 已删除 |
| `.omc/phases/*` | 多文件 | 已删除 |
| `.omc/artifacts/*` | 多文件 | 已删除 |
| `.omc/notepad.md` | 799 B | 已删除 |
| `.omc/progress.txt` | 688 B | 已删除 |
| `.omc/prd.json` | 6.6 KB | 已删除 |
| `.omc/template-version.json` | 92 B | 已删除 |
| `.omc/project-memory.json` | 13 KB | 已删除 |
| `.omc/handoffs/*` | 5 个文件 | 已删除（regen 后会用） |

**总释放磁盘**: 约 **135 MB**（主要是 `src/backend-old/`）
**`:omc/`: 8.4 MB → 大幅缩水（保留 `plans/`, `specs/`, `research/`, `prd/`）

## Git 状态

- 当前 branch: `master`
- 与 `origin/master` 关系: **ahead 3**（未 reset — 这是任务硬性约束）
- 安全暂存: `stash@{0}: On master: D-clean-pre-2026-07-09-preserve`（含所有 uncommitted 修改 + untracked 文件，可由 lead 决定 drop/pop）
- 当前 `git status` 残留:
  - `M .gitignore`（已扩展 .omc 忽略规则；保留）
  - `M .claude/settings.local.json`（用户 worktree 配置；保留）
  - `M electron/dist-electron/main.js`（用户进行中的打包修复；保留）
  - `M electron/frontend-build/index.html`（构建产物；保留）
  - `M electron/package.json`（用户进行中的依赖更新；保留）
  - `M electron/release/win-unpacked/LICENSE.electron.txt`（构建产物；保留）
  - `M electron/release/win-unpacked/LICENSES.chromium.html`（构建产物；保留）
  - `M pytest.ini`（用户正在调整门槛；保留）
  - `M src/backend/alembic.ini`、`M src/backend/alembic/env.py`、`M src/backend/alembic/script.py.mako`（src/backend 已删，这些"D-from-deleted-dir"的文件无实体）
  - `M src/backend/tests/conftest.py`、`M src/backend/tests/test_auth.py`、`M src/backend/tests/test_health.py`（同上，父目录已删）
  - `M src/backend/.omc/state/last-tool-error.json`（同上）
  - `M src/frontend/.omc/project-memory.json`、`M src/frontend/.omc/state/last-tool-error.json`（前端 .omc state 修改；可选择保留或恢复 stash 时处理）
  - 大量 `D src/backend/*` 索引项（tracked files whose paths no longer exist）— D-0 团队需要在重新初始化时 `git rm` 或 commit

## 残留过期引用（仅记录，不修复 — 留给 D-7/D-8）

`tests/conftest.py` 及其下 21 个文件仍引用旧 `from backend.`：

```
tests/conftest.py
tests/factories.py
tests/integration/test_chapters_api.py
tests/test_agents.py
tests/test_ai_service.py
tests/test_architecture_imports.py
tests/test_bare_except_regression.py
tests/test_checkers.py
tests/test_checker_smoke.py
tests/test_error_handling.py
tests/test_export_import.py
tests/test_export_import_expanded.py
tests/test_middleware.py
tests/test_rate_limit.py
tests/test_security_roundtrip.py
tests/test_websocket.py
tests/unit/test_auth.py
tests/unit/test_base_agent.py
tests/unit/test_cache_service.py
tests/unit/test_models.py
tests/unit/test_schemas.py
```

D-7（运维端点 + 测试基线）和 D-8（最终集成）需要重写这 21 个文件或在 pytest.ini 中调整收集规则。

## 验证

- `src/` 内容: `TEST_REPORT.md, data, frontend, logs, rag, shared` — 无后端残留
- `src/backend-old/` 不存在: ✓
- `backend/` 不存在: ✓
- `src/backend/` 不存在: ✓（顶层 test_migration.db、__pycache__、`.spike/`、`=25.0.0`、`pyproject.toml`、`tests/e2e/`、`tests/integration/`、`tests/unit/` 都已随目录消失）
- `.omc/` 保留: `plans/`, `specs/`, `research/`, `prd/`（prd/ 在任务列表外，但内容为空时不再清理以免混淆）
- `.gitignore` 已更新（添加显式 `.omc/state/`、`sessions/`、`phases/`、`artifacts/`、`notepad.md`、`progress.txt`、`prd.json`、`project-memory.json`、`handoffs/`、`template-version.json` 忽略；保留 `!plans/`、`!specs/`、`!research/`）

## 未做的事（per 任务约束）

- **未执行 `git reset --hard origin/master`** — 硬性禁止
- **未修改** `src/frontend/`、`electron/`、`docs/`、`.claude/`（除 `.gitignore`）
- **未修改** `.omc/plans/`、`.omc/specs/`、`.omc/research/`
- **未修改** `pyproject.toml`、`package.json`、`requirements.txt`
- **未提交**（让 team-lead 统一处理）
- **未修改** 主 `CLAUDE.md` 或全局 `.claude/CLAUDE.md`

## 下一步（D-0 可开始）

1. D-0 worker 检查 `.omc/specs/` 和 `.omc/plans/` 获取新架构规格
2. D-0 worker 在 `src/backend/` 内重新初始化新结构（uv + Pydantic Settings + FastAPI 骨架）
3. D-7 worker 处理 21 个过期 `tests/*` 引用并调整 `pytest.ini`
4. lead 决定保留或丢弃 `stash@{0}`（包含所有原始修改 + untracked 文件作为安全备份）

## Lead 注意事项

- `git status` 现在仍有大量 `D src/backend/*` 索引条目。lead 在 D-0 重新初始化前可选择：
  - 选项 A：`git rm -r src/backend/` 然后提交清理
  - 选项 B：保留，让 D-0 直接覆盖
  - 选项 C：drop stash 后 `git reset --hard origin/master`（最激进）
- `stash@{0}` 包含本次清理前所有变更（含 21 个 tests 文件的修改状态），丢失前请确认

---

报告生成时间: 2026-07-09
生成者: worker-clean（OMC team "backend-redesign"，task #23）
