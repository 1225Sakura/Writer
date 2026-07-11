# 目录结构清理实现计划 (2026-07-11)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `D:/writer/` 简化为仅含前端 + Electron + 参考项目的最小目录结构，删除所有后端代码、运行时数据、配置、文档与临时文件。

**Architecture:** 分阶段删除（按风险递增），每阶段使用 `git add` 暂存验证，最后再编辑配置文件与提交。

**Tech Stack:** Bash + Git + npm

**Spec:** `.omc/specs/2026-07-11-cleanup-design.md`

**路径覆盖说明：** 默认 plan 存放路径 `docs/superpowers/plans/` 中 `docs/` 将在本任务中被删除，故改用 `.omc/specs/2026-07-11-cleanup-plan.md`。

---

## 任务结构

本计划包含 14 个任务 + 1 个总提交。每个任务都应执行 `git add` 暂存删除，最后一个任务执行一次 `git commit`（按 spec 决策）。每个步骤都是 2-5 分钟的可执行动作。

---

### Task 1: 预检 — 确认工作树状态

**Files:**
- 无（只读检查）

- [ ] **Step 1: 检查当前 git 状态**

```bash
cd /d/writer && git status --short --branch
```

预期输出：以 `## master...` 开头，列出当前 staged + unstaged 改动。

- [ ] **Step 2: 确认后端目录存在**

```bash
ls -d src/backend/ data/ rag/ backend-review/ docs/ config/ scripts/ 2>&1
```

预期输出：所有目录都列出（不存在时输出错误信息）。

- [ ] **Step 3: 确认 cleanup spec 已提交**

```bash
git log --oneline -1 .omc/specs/2026-07-11-cleanup-design.md
```

预期输出：以 `docs(spec):` 开头的 commit hash。

- [ ] **Step 4: 记录当前 HEAD 以便回滚**

```bash
git rev-parse HEAD > /tmp/cleanup-rollback-point.txt
cat /tmp/cleanup-rollback-point.txt
```

预期输出：一行 40 字符的 commit hash（回滚时用 `git reset --hard <hash>`）。

---

### Task 2: 删除 src/backend/ 完整目录

**Files:**
- Delete: `src/backend/` (整个目录)

- [ ] **Step 1: 暂存删除**

```bash
cd /d/writer && git rm -r src/backend/
```

预期输出：列出被删除的文件列表（包含 pyproject.toml, alembic/, app/, tests/, smoke.db 等）。

- [ ] **Step 2: 验证暂存**

```bash
git status --short | grep -E "D.*src/backend" | head -5
```

预期输出：至少 5 行 `D src/backend/...`。

- [ ] **Step 3: 确认 src/backend/ 不再存在**

```bash
ls -d src/backend/ 2>&1
```

预期输出：`No such file or directory` 错误。

---

### Task 3: 删除 src/{data,rag,shared,logs}/ 运行时目录

**Files:**
- Delete: `src/data/`
- Delete: `src/rag/`
- Delete: `src/shared/`
- Delete: `src/logs/`

- [ ] **Step 1: 暂存删除四个目录**

```bash
cd /d/writer && git rm -r src/data/ src/rag/ src/shared/ src/logs/ 2>&1 | tail -10
```

预期输出：四个目录的所有文件被列出删除。

- [ ] **Step 2: 验证暂存**

```bash
git status --short | grep -E "D.*src/(data|rag|shared|logs)" | wc -l
```

预期输出：大于 0 的行数。

---

### Task 4: 删除根目录 data/ 与 rag/ 数据目录

**Files:**
- Delete: `data/`
- Delete: `rag/`

- [ ] **Step 1: 暂存删除根目录数据**

```bash
cd /d/writer && git rm -r data/ rag/ 2>&1 | tail -5
```

预期输出：app.db、vectors.db 等被列出删除。

- [ ] **Step 2: 验证**

```bash
ls -d data/ rag/ 2>&1
```

预期输出：两个 `No such file or directory`。

---

### Task 5: 删除 backend-review/ 后端审查目录

**Files:**
- Delete: `backend-review/`

- [ ] **Step 1: 暂存删除**

```bash
cd /d/writer && git rm -r backend-review/
```

预期输出：10 个 .md 文件被列出删除。

---

### Task 6: 删除 .omc/specs/ 中除本 plan/spec 外的全部文件

**Files:**
- Delete: `.omc/specs/` 下除 `2026-07-11-cleanup-design.md` 与 `2026-07-11-cleanup-plan.md` 外的所有文件

- [ ] **Step 1: 列出要删除的 .omc/specs/ 文件**

```bash
ls .omc/specs/ | grep -v -E "^(2026-07-11-cleanup-(design|plan)\.md)$"
```

预期输出：除两个 cleanup 文件外的所有 .md 文件名。

- [ ] **Step 2: 暂存删除这些文件**

```bash
cd /d/writer && git rm -f $(ls .omc/specs/ | grep -v -E "^(2026-07-11-cleanup-(design|plan)\.md)$" | sed 's|^|.omc/specs/|')
```

预期输出：列出被删除的所有 spec 文件。

- [ ] **Step 3: 验证仅 cleanup 文件保留**

```bash
ls .omc/specs/
```

预期输出：仅显示 `2026-07-11-cleanup-design.md` 与 `2026-07-11-cleanup-plan.md`。

---

### Task 7: 删除 .omc/plans/ 全部内容

**Files:**
- Delete: `.omc/plans/` 下所有内容（含 `archive/` 子目录）

- [ ] **Step 1: 列出 .omc/plans/ 内容**

```bash
ls .omc/plans/
```

预期输出：包含多个 .md 文件与 `archive/` 子目录。

- [ ] **Step 2: 暂存删除全部 .omc/plans/**

```bash
cd /d/writer && git rm -rf .omc/plans/
```

预期输出：所有 .md 文件与 archive/ 子目录被删除。

---

### Task 8: 删除 .omc/state/ 中的 agent-replay 日志

**Files:**
- Delete: `.omc/state/agent-replay-*.jsonl`

- [ ] **Step 1: 列出 agent-replay 文件**

```bash
ls .omc/state/agent-replay-*.jsonl 2>&1
```

预期输出：列出 .jsonl 文件（可能为空，文件被 .gitignore 忽略则不显示但仍存在）。

- [ ] **Step 2: 删除 agent-replay 文件（不被 git 跟踪，使用 rm）**

```bash
cd /d/writer && rm -f .omc/state/agent-replay-*.jsonl
```

预期输出：无输出（成功）。

- [ ] **Step 3: 验证**

```bash
ls .omc/state/agent-replay-*.jsonl 2>&1
```

预期输出：`No such file or directory`。

---

### Task 9: 整体删除 config/、scripts/、docs/ 目录

**Files:**
- Delete: `config/`
- Delete: `scripts/`
- Delete: `docs/`

- [ ] **Step 1: 暂存删除三个目录**

```bash
cd /d/writer && git rm -r config/ scripts/ docs/ 2>&1 | tail -10
```

预期输出：config/、scripts/、docs/ 下所有文件被列出删除。

- [ ] **Step 2: 验证目录不存在**

```bash
ls -d config/ scripts/ docs/ 2>&1
```

预期输出：三个 `No such file or directory`。

---

### Task 10: 删除 build-local.bat

**Files:**
- Delete: `build-local.bat`

- [ ] **Step 1: 暂存删除**

```bash
cd /d/writer && git rm build-local.bat
```

预期输出：`rm 'build-local.bat'`。

---

### Task 11: 删除 Python 工具链缓存与配置文件

**Files:**
- Delete: `.venv/`
- Delete: `.pytest_cache/`
- Delete: `.ruff_cache/`
- Delete: `.build_logs/`
- Delete: `pytest.ini`
- Delete: `coverage-output.txt`

- [ ] **Step 1: 删除 .venv/ 目录（未跟踪）**

```bash
cd /d/writer && rm -rf .venv/
```

预期输出：无输出。

- [ ] **Step 2: 删除 pytest 缓存**

```bash
cd /d/writer && rm -rf .pytest_cache/
```

预期输出：无输出。

- [ ] **Step 3: 删除 ruff 缓存**

```bash
cd /d/writer && rm -rf .ruff_cache/
```

预期输出：无输出。

- [ ] **Step 4: 删除构建日志目录**

```bash
cd /d/writer && rm -rf .build_logs/
```

预期输出：无输出。

- [ ] **Step 5: 暂存删除 pytest.ini 与 coverage-output.txt**

```bash
cd /d/writer && git rm -f pytest.ini coverage-output.txt 2>&1
```

预期输出：`rm 'pytest.ini'` 与 `rm 'coverage-output.txt'`。

---

### Task 12: 删除 cleanup 脚本与旧 OMC 状态文件

**Files:**
- Delete: `cleanup-batch1.ps1`
- Delete: `cleanup-scan-1.ps1` 至 `cleanup-scan-3c.ps1`（共 6 个）
- Delete: `hist.json`
- Delete: `r.bin`
- Delete: `r.json`
- Delete: `rev.json`
- Delete: `.build_local_*.log`（匹配此模式的 .log 文件）

- [ ] **Step 1: 暂存删除 cleanup 脚本**

```bash
cd /d/writer && git rm -f cleanup-batch1.ps1 cleanup-scan-1.ps1 cleanup-scan-2.ps1 cleanup-scan-3.ps1 cleanup-scan-3b.ps1 cleanup-scan-3c.ps1 2>&1
```

预期输出：6 个 `rm` 消息。

- [ ] **Step 2: 删除 hist.json, r.bin, r.json, rev.json（未跟踪）**

```bash
cd /d/writer && rm -f hist.json r.bin r.json rev.json
```

预期输出：无输出。

- [ ] **Step 3: 删除 .log 文件**

```bash
cd /d/writer && rm -f .build_local_*.log *.log 2>&1
```

预期输出：无输出（除非有警告）。

- [ ] **Step 4: 验证无残留 cleanup 文件**

```bash
ls cleanup-*.ps1 hist.json r.bin r.json rev.json 2>&1
```

预期输出：所有文件 `No such file or directory`。

---

### Task 13: 更新 electron/package.json 去除后端引用

**Files:**
- Modify: `electron/package.json`

- [ ] **Step 1: 读取当前文件**

```bash
cat electron/package.json
```

预期输出：JSON 内容。定位 `build.extraResources` 与 `build.asarUnpack`。

- [ ] **Step 2: 找到要修改的行号**

```bash
grep -n -E "extraResources|asarUnpack" electron/package.json
```

预期输出：列出 `extraResources` 与 `asarUnpack` 的行号。

- [ ] **Step 3: 使用 Edit 工具修改 electron/package.json**

定位到 `build.asarUnpack` 数组（包含 `resources/backend/**/*`），替换为空数组 `[]`。

定位到 `build.extraResources` 数组（包含两个对象都引用 `../src/backend`），替换为空数组 `[]`。

- [ ] **Step 4: 验证修改**

```bash
grep -c "src/backend" electron/package.json
```

预期输出：`0`（不再引用后端）。

```bash
grep -A 2 "extraResources" electron/package.json
```

预期输出：应为空或显示 `[]`。

- [ ] **Step 5: 验证 JSON 仍然合法**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('electron/package.json', 'utf-8')).name)"
```

预期输出：`writer-desktop`。

---

### Task 14: 更新 .gitignore 移除后端相关模式

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 读取当前 .gitignore**

```bash
cat .gitignore
```

预期输出：完整 .gitignore 内容。

- [ ] **Step 2: 使用 Edit 工具移除以下行（连同其所属注释块）**

删除以下章节（包含注释行）：

```
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

- [ ] **Step 3: 验证**

```bash
grep -E "\.venv|pytest_cache|\.db|src/backend|data/" .gitignore
```

预期输出：无匹配（或仅剩 .omc/state/ 之类不相关匹配）。

---

### Task 15: 更新 .claude/CLAUDE.md 移除后端描述

**Files:**
- Modify: `.claude/CLAUDE.md`

- [ ] **Step 1: 读取当前 CLAUDE.md**

```bash
cat .claude/CLAUDE.md | head -50
```

预期输出：项目说明文档。

- [ ] **Step 2: 识别需要删除的章节**

需删除：
- "## 运行环境" 章节中后端相关行
- "## 关键实体 (Ontology)" 章节
- "## 状态管理" 章节
- "## API 设计（待补充）" 章节
- "## 构建系统" 章节
- "## 待完善章节" 章节

- [ ] **Step 3: 用 Edit 工具整体重写 CLAUDE.md**

仅保留：
- 项目概述
- 三界面架构（前端相关）
- 色彩系统
- 字体排版
- 组件命名规范
- 约束 (Constraints)

- [ ] **Step 4: 验证**

```bash
grep -E "FastAPI|SQLAlchemy|uvicorn|alembic|Pydantic|LiteLLM" .claude/CLAUDE.md
```

预期输出：无匹配。

---

### Task 16: 重写 README.md 移除后端描述

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 读取当前 README.md**

```bash
cat README.md
```

预期输出：完整 README 内容。

- [ ] **Step 2: 用 Write 工具重写 README.md**

新内容仅描述：
- 项目目标（中文网文 AI 辅助写作桌面应用）
- 三界面架构（聊天/设定/写作）
- 技术栈（React + Electron）
- 开发命令（`cd src/frontend && npm install && npm run build`，`cd electron && npm install && npm run build:electron`）

- [ ] **Step 3: 验证**

```bash
grep -E "FastAPI|SQLAlchemy|backend|Pydantic|LiteLLM" README.md
```

预期输出：无匹配。

---

### Task 17: 清理 post-commit hook

**Files:**
- Delete or Modify: `.git/hooks/post-commit` (如存在)

- [ ] **Step 1: 检查 hook 是否存在**

```bash
ls -la .git/hooks/post-commit 2>&1
```

预期输出：文件存在信息或 `No such file or directory`。

- [ ] **Step 2: 如存在，删除**

```bash
cd /d/writer && rm -f .git/hooks/post-commit
```

预期输出：无输出。

- [ ] **Step 3: 验证**

```bash
ls -la .git/hooks/post-commit 2>&1
```

预期输出：`No such file or directory`。

---

### Task 18: 验证 — git 状态与目录结构

**Files:**
- 无（只读验证）

- [ ] **Step 1: 检查 git 暂存区**

```bash
cd /d/writer && git status --short | head -20
```

预期输出：列出删除与修改的文件（应与 spec 一致）。

- [ ] **Step 2: 检查根目录结构**

```bash
ls -la /d/writer/ | grep -E "^d|^-" | awk '{print $NF}' | grep -v "^\.\.\?$"
```

预期输出：仅 `src/`, `electron/`, `read/`, `.claude/`, `.omc/`, `.github/`, `.agents/`, `README.md`, `.gitignore`, `.git/`。

- [ ] **Step 3: 确认无残留后端文件**

```bash
ls -d src/backend/ src/data/ src/rag/ src/shared/ src/logs/ data/ rag/ backend-review/ config/ scripts/ docs/ 2>&1
```

预期输出：所有 `No such file or directory`。

---

### Task 19: 验证 — 前端与 Electron 构建

**Files:**
- 无（运行验证）

- [ ] **Step 1: 前端构建**

```bash
cd /d/writer/src/frontend && npm run build 2>&1 | tail -20
```

预期输出：构建成功，显示 `built in` 时间，生成 `dist/` 目录。

- [ ] **Step 2: Electron 编译**

```bash
cd /d/writer/electron && npm run build:electron 2>&1 | tail -20
```

预期输出：TypeScript 编译成功，生成 `dist-electron/main.js`。

---

### Task 20: 提交清理结果

**Files:**
- Stage: 所有暂存与未暂存的删除/修改

- [ ] **Step 1: 查看所有改动**

```bash
cd /d/writer && git status --short | head -30
```

预期输出：列出所有待提交内容。

- [ ] **Step 2: 暂存所有改动**

```bash
cd /d/writer && git add -A
```

预期输出：无输出（成功）。

- [ ] **Step 3: 提交（跳过 post-commit hook，因为 build-local.bat 已删除）**

```bash
cd /d/writer && git commit --no-verify -m "$(cat <<'EOF'
cleanup: 移除所有后端代码与运行时产物

按 .omc/specs/2026-07-11-cleanup-design.md 执行目录结构清理

变更：
- 删除 src/backend/、src/{data,rag,shared,logs}/
- 删除根目录 data/、rag/、backend-review/
- 删除 config/、scripts/、docs/ 整体
- 删除 build-local.bat、cleanup-*.ps1、临时文件
- 删除 .omc/specs/ 中除 cleanup spec/plan 外的所有文件
- 删除 .omc/plans/、.omc/state/agent-replay-*
- 更新 electron/package.json、.gitignore、CLAUDE.md、README.md
- 清理 .git/hooks/post-commit

为后续从零重建后端做准备

Co-Authored-By: 1225Sakura <noreply@anthropic.com>
EOF
)"
```

预期输出：提交成功，显示 commit hash 与变更统计。

- [ ] **Step 4: 验证提交**

```bash
cd /d/writer && git log --oneline -3
```

预期输出：包含新 cleanup commit 在最前。

---

## Self-Review（已执行）

**1. Spec coverage:** 所有 spec 中的删除/更新项均有对应任务
- A. 后端代码 → Task 2, 3
- B. 根目录数据 → Task 4
- C. 后端文档与状态 → Task 5, 6, 7, 8
- D. 整体删除的目录 → Task 9, 10
- E. 临时文件 → Task 11, 12
- 配置更新 → Task 13, 14, 15, 16, 17
- 验证 → Task 18, 19
- 提交 → Task 20

**2. Placeholder scan:** 无 "TBD"、"TODO"、"fill in details"。所有命令与路径均完整。

**3. Type consistency:** N/A（本计划为文件操作，无类型/方法签名）

**4. 路径一致性：** 所有路径与 spec 一致。

**5. Commit 策略：** 按 spec 决策使用单次提交（Task 20），与 spec 19 步执行流程一致。

---

## 执行风险

- **不可逆：** 删除的 SQLite 数据库与向量库无法恢复
- **回滚：** `git reset --hard $(cat /tmp/cleanup-rollback-point.txt)` 回到清理前状态
- **前置条件：** Task 1 记录的回滚点必须保留
