# Phase 2.4 cold-start perf baseline

**日期**：2026-07-22  
**owner**：worker-2（Phase 2.4 frontend）  
**目的**：定义 cold-start Web Vitals 阈值并记录首次测量值，作为后续性能回归基线

---

## 1. 测量方式

| 项 | 说明 |
|---|---|
| 工具 | Playwright + chromium 项目 + `page.evaluate(() => performance.getEntriesByType('paint'))` |
| 路径 | `e2e/journeys/cold-start/cold-start.spec.ts` 第 4 个 `test`（Phase 2.4 新增） |
| 等待 | `goto('/')` 后 `waitForTimeout(1500)` 给 LCP observer flush 时间 |
| 注入 | renderer 端 `src/utils/performance.ts` 实时记录 FCP/LCP/CLS/FID/INP |

## 2. 阈值定义（来自 `src/utils/performance.ts`）

| Metric | good | needs-improvement | poor | CI 严格断言 |
|--------|------|-------------------|------|------------|
| FCP    | ≤ 1800ms | 1800-3000ms | > 3000ms | < 3000ms |
| LCP    | ≤ 2500ms | 2500-4000ms | > 4000ms | < 5000ms |
| CLS    | ≤ 100 (×1000) | 100-300 | > 300 | 未在 cold-start spec 断言（首屏布局由 Suspense fallback 占位） |
| FID    | ≤ 100ms | 100-300ms | > 300ms | 未断言（cold-start 无用户交互） |
| INP    | ≤ 200ms | 200-500ms | > 500ms | 未断言（cold-start 无用户交互） |

**CI 阈值**比 `good` 阈值宽松一档，对应 dev-mode Vite 第一次冷启动（含 on-demand tsx 编译 + Tiptap/Framer Motion 等大型依赖）。

## 3. 实测 baseline（dev-mode Vite, 2026-07-22）

| Metric | 测量值 | good 阈值 | 状态 |
|--------|--------|----------|------|
| FCP    | **待首次冷启动采集** | 1800ms | ⚠️ 数据待补 |
| LCP    | **待首次冷启动采集** | 2500ms | ⚠️ 数据待补 |
| CLS    | 0（首屏 Suspense fallback 静态） | 100 | ✅ |

> **如何采集实测 baseline**：
> 1. `cd src/frontend && npm run e2e:cold-start -- --project=chromium --reporter=list`
> 2. 在测试报告输出中查找 `cold-start Web Vitals stay within thresholds` 测试的 stdout
> 3. 或在 dev 模式启动后访问 `http://localhost:5173`，控制台运行：
>    ```js
>    performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint').startTime
>    performance.getEntriesByType('largest-contentful-paint').slice(-1)[0].renderTime
>    ```

## 4. 上报链路（Phase 2.4）

```
[PerformanceObserver]
  → performanceMonitor.recordMetric(name, value)
  → notifyObservers([metric])
  → main.tsx subscribe(metrics => Sentry.captureMessage('perf.metrics', { extra: metrics }))
  → @sentry/react → Sentry server (when VITE_SENTRY_DSN set)
```

- 当 `VITE_SENTRY_DSN` 未设置时，`performanceMonitor.subscribe` 仍注册但 `Sentry.captureMessage` 走 dynamic import + `if` 短路 → 实际不执行。
- 这意味着本地开发与 CI cold-start spec 不需要 Sentry DSN 即可运行。
- **生产构建**：通过 `.env.production` 注入 `VITE_SENTRY_DSN=...`，renderer 自动启用上报。

## 5. 后续工作

| Phase | 工作 |
|-------|-----|
| 2.5+ | 真实采集首次 baseline 数值并写入 §3 |
| 3     | Web Vitals per-route（`/chat`、`/settings`、`/writing`）细分 |
| 4     | 把 cold-start Web Vitals 加进 CI 必须门（PR-gate 阻塞 > poor 阈值） |
| 5     | Sentry 端配置 dashboard + alerting |

## 6. 已知问题

- `PerformanceObserver` 在 jsdom 下不可用；vitest 单测只能测 `recordMetric` 逻辑，不能测 observer 实际触发（已在 `utils/performance.ts` 用 `if (typeof window !== 'undefined')` 守护）。
- LCP 在 SPA Suspense fallback 占位时通常是 0；产品页面切换后才有意义。Phase 3 跨路由监控更精确。

---

**owner**：worker-2  
**待 0b.4+ 采集实测数据后归档**