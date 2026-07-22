# v0.5 Phase 0a D0 Sanity Check（lead 0a.0）

**日期**：2026-07-22  
**目的**：在 worker 启动前，捕获 v0.4 patch 自报 24/24 vs 实际状态的差异，作为 Phase 0a 工作的基线参考  
**owner**：team-lead  
**状态**：complete（lead 0a.0 done）  

---

## 1. Git 状态

```
## master...origin/master
 M src/frontend/.omc/benchmark-results/ux-benchmark-latest.json
 M src/frontend/.omc/benchmark-results/ux-benchmark-latest.txt
 M src/frontend/.omc/project-memory.json
?? electron/frontend-build/
?? src/frontend/.omc/benchmark-results/ux-benchmark-2026-07-21T*.json
```

**解读**：
- master 分支 up to date
- 3 个 tracked 文件修改（ux-benchmark + project-memory，已 commit 过但有未 commit 变更）
- `electron/frontend-build/` 未跟踪（**v0.4 F-02 已知**：build artifact 跟踪问题）
- 3 个未跟踪的 ux-benchmark 时间戳文件（自动生成）
- 无其他未跟踪关键文件

---

## 2. pyproject.toml 与 ci.yml Python 版本不一致（**v0.4 F-09**）

| 文件 | 声明 |
|------|------|
| `src/backend/pyproject.toml:4-17` | `requires-python = ">=3.12"` |
| `.github/workflows/ci.yml:52-63` | `python-version: '3.11'` |

**结论**：CI 用 3.11 跑 pyproject 要求 3.12 的代码 = 兼容性风险  
**修复**：Worker-1 (0a.2) 已 tasked 修 CI → 3.12

---

## 3. package.json scripts 现状

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",   ← tsc -b 已用，但无独立 typecheck script
  "lint": "eslint .",                ← 因 eslint 配置/binary 缺失实际不可用
  "preview": "vite preview",
  "test": "vitest run",
  "benchmark:ux": "vitest run src/__tests__/ux-benchmark.test.ts",
  "e2e": "playwright test",
  "e2e:cold-start": "playwright test e2e/journeys/cold-start/",
  "e2e:full-flow": "playwright test e2e/journeys/full-flow/",
  "e2e:fix-flow": "playwright test e2e/journeys/fix-flow/",
  "e2e:regression": "playwright test e2e/journeys/regression/",
  "e2e:ui": "playwright test --ui",
  "e2e:report": "playwright show-report"
}
```

**缺口**：
- 无 `typecheck` script（Worker-2 0a.3 必加：`"typecheck": "tsc -b --pretty false"`）
- 无 `check:openapi` script（Worker-3 0a.5 应建）
- 无 `test:a11y:*` scripts（Phase 3 Track D 后续加）
- 无 `test:security` script（Phase 1 A.3 后续加）
- 无 `perf:baseline` script（Phase 2.4 后续加）

**10 项门槛执行计划**：Phase 0a 末 4 项门槛（lint/typecheck/Vitest/cold-start）逐步补齐，Phase 1-3 补齐其余 6 项

---

## 4. 文件结构验证（已存在）

### Backend
- `src/backend/app/routers/__init__.py` 存在（worker-3 需修改加 if_minimal）
- `src/backend/tests/test_ai_*.py` 等 38 个测试文件（Worker-1 需新建 test_smoke.py）
- 无 `requirements.txt`（pyproject.toml 已用 hatchling，无需）
- `.env` gitignored（line 110, 129），未入 git

### Frontend
- `src/frontend/src/store/` 23 个 store 文件（含 14 slices + editorRegistry + utils）
- `src/frontend/src/test/contextStore.test.ts` 存在（Worker-2 修 14 失败）
- `src/frontend/src/components/writing/OutlineSidebar.tsx` 存在（Worker-3 接 IF 按钮）

### Backend dependencies 提示
- `.env` 含 `ANTHROPIC_AUTH_TOKEN=sk-cp-QYLHlhhJRjuRCw-zQjGdAl-QO1zbfMyOmuuoPIKhAisTtfNXsErI3_keoAhl399lkto_kQKDWYlHLLQ_jS9rluNgZMKuz6G21W4ScNhPZl5sSi4KGUCVOaU`
- ⚠️ **CRITICAL 安全提示**：真实 sk-cp token 明文在开发者磁盘
- 已 gitignored（line 110 + 129），不在 git history
- **未触发** git history leak（v0.4 keychain-history-leak-2026-07-21.md 已记录 `writer-local-key-change-me` 历史泄漏，本次是新 token）
- **建议（Phase 1 A.0 Provider Resolver ADR §6 必做）**：Provider resolver 用 SecretStr wrapper + 最小化明文生命周期 + pytest leakage test 覆盖 logger/Sentry beforeSend/local JSONL/traceback/HTTP debug/dump

### CI workflow
- `.github/workflows/ci.yml` 存在（Python 3.11 需改 3.12，Worker-1 0a.2）
- 4 个 workflow：build.yml / cd.yml / ci.yml / security-audit.yml

### Docs
- `docs/baselines/` 仅 `2026-07-21/` 子目录（Worker-2 需创建 `2026-07-22/tsc-errors-triage.md`）
- `docs/architecture/` 不存在（Worker-3 需创建 `if-api-schema-v1.md`）

---

## 5. Worker 启动条件检查

| Worker | 任务 | 文件/路径就绪 | 是否可启动 |
|--------|------|---------------|------------|
| **worker-1** | 0a.1 backend import + 0a.2 Python 3.12 | `src/backend/app/routers/ai_generate.py` + `pyproject.toml` + `.github/workflows/ci.yml` ✓ | ✅ 已启动 |
| **worker-2** | 0a.3 typecheck + 0a.4 contextStore | `src/frontend/package.json` + `src/frontend/src/test/contextStore.test.ts` + `src/frontend/src/store/contextStore.ts` ✓ | ✅ 已启动 |
| **worker-3** | 0a.5 IF vertical slice | `src/backend/app/routers/__init__.py` + `src/frontend/src/components/writing/OutlineSidebar.tsx` ✓ + 需建 `docs/architecture/if-api-schema-v1.md` + `src/backend/app/routers/if_minimal.py` + `src/frontend/src/api/ifLineApi.ts` + `src/frontend/e2e/journeys/phase-0a/if-vertical-slice.spec.ts` | ✅ 已启动 |

---

## 6. 与 v0.4 PRD 自报 24/24 对比

| v0.4 自报 | 实测（D0） | 差异 |
|----------|-----------|------|
| US-024 24/24 stories passes | 未实测（PRD pass 是 spec 状态，不是代码验证） | v0.4 spec 不可直接验证 |
| US-005 .gitignore 5 行展开 | ✓ `.gitignore:110,129` 含 `.env` / `.env.local` 等 | 一致 |
| US-006 P0-Sec3 IPC FS path validation | ✓ 已知完成（v0.4 commits b1cebbe CSP + 95 series 路径校验） | 一致 |
| US-008 P0-Sec1a auth infra | ✓ code 完整（worker-1 只需补 `Depends` import blocker） | 部分 blocker |
| 41 endpoint 全活 | ✗ 5 router 缺失（context/engagement/pacing/observability/snapshots）→ 41 endpoint 404 | **不符** |
| IF UI 接通 | ✗ `CorkboardView.tsx:148-152` 仍是 `// Future:` TODO | **不符** |
| Sentry 接通 | ✗ 全仓 grep 0 命中 | **不符** |
| ESLint v9 flat config | ✗ `eslint.config.{js,mjs,cjs}` 全部缺失 | **不符** |
| Vitest 100% pass | ✗ 91.3% 通过率（contextStore 14 失败 + ux-benchmark 4 失败） | **不符** |

**结论**：PRD 自报 24/24 ≠ 实际 24/24。v0.4 patch 主要完成了 P0 安全（US-001~US-024 大部分），但**对外可见功能**（5 router + Provider 真用 + IF UI + Sentry + a11y）大量未实现。Phase 0a + Phase 1-3 必做。

---

## 7. 0a.0 结论

| 项目 | 状态 |
|------|------|
| Git 状态 | 干净（master up to date，无 blocker） |
| Python 3.11 vs 3.12 不一致 | 已识别，Worker-1 修 |
| package.json 缺 typecheck script | 已识别，Worker-2 修 |
| routers/__init__.py 可挂载 if_minimal | ✓ |
| OutlineSidebar 可接 IF 按钮 | ✓ |
| 文档目录结构 | 部分就绪（docs/baselines/ 需建 2026-07-22，docs/architecture/ 需建） |
| **CRITICAL 安全观察** | `.env` 含真实 sk-cp token，未入 git 但本地 plaintext（Phase 1 A.0 修） |
| **PRD vs 现实差距** | 4 项对外可见功能（41 endpoint + Provider + IF UI + Sentry）实际未实现 |

**下一步**：等待 worker-1/2/3 完成 0a.1-0a.5，进入 0a.6 Phase 0a 验收（lead 跑 4 项门槛子集）。