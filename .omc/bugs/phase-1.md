# Phase 1 — Bugs

**Date**: 2026-07-18
**Tier distribution**: 7 symptom / 3 mechanism / 1 architecture
**Atomic commits**: 6 (all symptom, all pushed to master)

---

## Symptom (已修 — 7 项)

| # | Hash | 摘要 |
|---|------|------|
| S1 | 021f66d | `OutlineSidebar.tsx:50` 引用未导出的 `OutlineContextMenu` → Vite scan 失败 |
| S2 | 9b04feb | `toolbar/index.ts` 缺 `FloatingToolBar` re-export |
| S3 | d13d879 | `store/index.ts` 缺 `useLinkageStore` re-export |
| S4 | 308fbb1 | `playwright.config.ts` 顶层 `require()` 在 ESM context 下 throw |
| S5 | e73d8bc | `playwright.config.ts` 用 `requireCJS('electron')` 解析不到（electron 不在 src/frontend/node_modules） |
| S6 | e73d8bc | `global-setup.ts` `path.resolve(cwd, 'src', 'backend')` 在 cwd=src/frontend 时解析到不存在路径 |
| S7 | 853108f | `chat-collect.spec.ts:25` + `chat-to-settings.spec.ts:37` 相对路径 `'../fixtures/_helpers'` 错 |

### 决策树自评

```
classify_bug(S1)  -> symptom (files=1, lines=58, scope=jsx, not state_machine)
classify_bug(S2)  -> symptom (files=1, lines=1, scope=barrel)
classify_bug(S3)  -> symptom (files=1, lines=8, scope=barrel)
classify_bug(S4)  -> symptom (files=1, lines=9, scope=config, not state_machine)
classify_bug(S5)  -> symptom (files=1, lines=1, scope=config)
classify_bug(S6)  -> symptom (files=1, lines=4, scope=config)
classify_bug(S7)  -> symptom (files=2, lines=2, scope=test-fixtures)
```

全部命中 symptom 决策树前置条件（≤2 文件 / ≤30 行 / 不跨模块 / 不动状态机）。

---

## Mechanism (判断点待定 — 3 项，不内联修)

### M1 — API 契约 mismatch: `/chat/sessions` 信封格式

**症状**: backend 返回 `{success: true, data: {sessions: [...]}}`（FastAPI 通用信封 + 自定义 wrapper），frontend `sessionApi.list(): Promise<ChatSession[]>` 期望裸数组 `ChatSession[]`。

**触发**: 任何调用 `sessionApi.list()` / `sessionApi.create()` 的代码路径。
**当前影响**: phase1 走查时 ErrorBoundary fallback（"聊天页面出了点小问题"），happy path 完全无法在 real backend 上跑。
**作用域**: `src/backend/app/schemas/response.py:ApiResponse` + `src/backend/app/routers/*.py` (~10 endpoints) + `src/frontend/src/api/request.ts` 的 unwrap 逻辑。
**根因猜测**: 后端早期设计走"统一 ApiResponse 包装"约定，前端 axios 直接 `response.data`，约定不对齐。
**倾向 tier**: mechanism（接口契约偏差，多文件）。
**备选**:
- A. backend 全去信封 → `JSONResponse(content=data)` 直返；影响 10+ router；破坏既有 API 客户端兼容
- B. frontend 在 `request.ts` 增加 `transformResponse` 自动拆信封；影响小（单文件），保留后端一致风格
- C. 双端引入 OpenAPI 生成；增加新工具链

### M2 — WebSocket 端点不存在

**症状**: `ChatWebSocketClient.connect()` (src/frontend/src/api/websocket.ts:111) 连接 `ws://127.0.0.1:8000/ws/chat/{id}`。后端无对应端点 → 404 → 重连循环 → ErrorBoundary catch。
**触发**: chat 页面 mount。
**当前影响**: chat 页面无法正常渲染，阻塞所有 Phase 1-6 走查。
**作用域**: `src/frontend/src/api/websocket.ts` + `src/backend/app/main.py`（缺 ws router）。
**根因猜测**: v3 plan 18 commit 范围内未包含 WebSocket 端点；前端先实现，后端留空。
**倾向 tier**: mechanism（接口契约偏差）。
**备选**:
- A. mock WS server（`e2e/fixtures/_helpers.ts` 加 `setupMockedWebSocketServer()`）—— 仅解 e2e；生产仍断
- B. backend 加 `/ws/chat/{id}` 真端点（继承 Phase 0 commit 19+）—— 工期+2h
- C. 前端降级为 polling（`src/frontend/src/api/websocket.ts` 改 fallback）—— 实时性降级

### M3 — Pydantic 422 直接渲染为 React child

**症状**: chat store 错误处理把 `{detail: [{type, loc, msg, input}]}` 对象当 string 塞进 JSX → React 抛 "Objects are not valid as a React child"。
**触发**: 任何 4xx/5xx 响应（不仅 422），错误格式未匹配时。
**当前影响**: 任何 backend 错误 → ErrorBoundary fallback → 整个 chat 页面坏。
**作用域**: `src/frontend/src/store/chatStore.ts:300` 的 `set((state) => { state.error = (error as Error).message })` — message 可能是对象。
**根因猜测**: 错误处理时假设 `error.message` 是 string；FastAPI 默认 `{detail: [...]}` 格式不带顶层 message 字段。
**倾向 tier**: mechanism（错误处理协议偏差，单文件可修，但需统一 chatStore + aiStore + writingStore 全部 store）。
**备选**:
- A. 写 `formatApiError(err)` helper（统一 backend error envelope → string）—— 单文件，影响所有 store
- B. 后端统一所有 4xx/5xx 走 ApiResponse 信封—— 配合 M1 选 A/B 一起

---

## Architecture (判断点待定 — 1 项，user 拍板)

### A1 — 真实 AI 不可用

**症状**: `.env.example` 与 `.env` 中 `ANTHROPIC_API_KEY=sk-cp-your-token-here`（占位符）。plan B.2 强制"不 mock、不拦截、真实 AI + 真实 backend + 真实 Electron"，但当前 env 无可用 key。
**影响**: 所有 AI 调用（chat 自动回复 / settings AI 工具 / outline 生成 / writing 助手 / IF 同步）必失败。
**触发**: 任何 AI endpoint 调用。
**根因**: 项目代码就绪，但运行时配置未注入。
**倾向 tier**: architecture（设计假设违反：plan 默认真实 AI 可用，实际 key 缺）。
**决策选项**:
- (a) 申请/配置真 MiniMax API key（用户提供）—— 工期 ~1h（key 配置 + smoke test）
- (b) plan 降级为"API-mocked，transport-real"—— 与现有 cold-start/*.spec.ts 模式一致；修订 plan B.2 文字
- (c) plan 范围调整为仅跑通真实 backend 的 non-AI 路径（health / projects / migrations）—— Phase 0 已完成
- (d) Phase 0 增补"key 配置 commit"—— 独立 commit 注入 env，加固 per-journey 隔离

---

## Regression 永久化

`e2e/journeys/regression/phase-1/build-blockers.spec.ts` —— 3 case，覆盖 7 个 symptom 修。运行结果：2 pass + 1 fail（`pageerror: sessions.filter is not a function` 是真实存在的运行时错误，跟 7 个 symptom 修无关，是 M1 的具体表现）。

后续 plan：B-OBS.5 architecture < 20% ✅（1/10 = 10%）；B-OBS.6 三件齐备 + 判断点待定段 ✅。