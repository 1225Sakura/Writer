---
title: v2 §F Open Questions — User Decisions Log
date: 2026-07-21
status: all 8 decisions = (a)
related: docs/plans/ralplan-comprehensive-audit-2026-07-21.md, docs/plans/v2/addendum-2026-07-21.md
---

# v2 §F Open Questions — User Decisions

> 8 条 v2 final open questions 全部选择 **(a)**。原 spec §9.2 5 条暂保留现状（未在本次裁决范围）。
> 用户裁决时间：2026-07-21
> 触发后续：原 spec v0.3.1 → v0.4 patch（D.1.* + D.2.* + D.3.* 并入）

---

## Q1. plan/specs/research 是否迁出 `.omc/`？

**决策：(a)** 完全迁出 `.omc/`，新建顶层 `docs/plans/` `docs/specs/` `docs/research/`

**已执行动作**（2026-07-21）：
- ✅ `mkdir -p docs/plans docs/specs docs/research`
- ✅ `mv .omc/plans/ralplan-comprehensive-audit-2026-07-21.md docs/plans/`
- ✅ `mv .omc/plans/v2/addendum-2026-07-21.md docs/plans/v2/`
- ✅ `rmdir .omc/plans/v2` + `rmdir .omc/plans`（目录已清空）
- ✅ `.gitignore` 第 64 行注释更新：`plans/specs/research tracked in docs/`
- ✅ `.gitignore` 第 75-77 行删除：`!.omc/plans/` `!.omc/specs/` `!.omc/research/` 例外

**新路径**：
- 原 spec：`docs/plans/ralplan-comprehensive-audit-2026-07-21.md`（原 `.omc/plans/`）
- v2 addendum：`docs/plans/v2/addendum-2026-07-21.md`（原 `.omc/plans/v2/`）

---

## Q2. provider keychain 主密钥放置策略

**决策：(a)** P0-Sec1a 完成前，P0-Sec5 暂用独立 secret 文件 + 标注 TODO

**含义**：
- P0-Sec5（provider 修复）不等 P0-Sec1a（auth infra）1 周
- P0-Sec5 启动时使用独立 secret 文件存 AES key（dev only）
- 标注 TODO：等 P0-Sec1a 完成 OS keychain 后迁移
- 避免序列化推迟

**生效位置**：v2 addendum §D.2.3 + spec v0.4 patch

---

## Q3. P0-Sec5 双 schema 设计接受度

**决策：(a)** 双 schema（masked 列表 + 单独端点返完整 key）

**含义**：
- `AIProviderOut`（列表用）：只返 masked_key（`sk-***` + last 4 chars）
- `ProviderKeyOut`（编辑用）：单独端点 `/providers/{id}/key` 返完整 key
- 前端编辑表单从 `/providers/{id}/key` 拉取完整 key
- 完整 key 不进日志、不进前端 store 持久层、不进 IndexedDB

**贴 P-MINIMAL-SECRET**：spec 当前 D.1.5 单 schema `Optional` 不够——日志/前端持久层仍可能泄漏完整 key

**生效位置**：v2 addendum §D.2.1 + spec v0.4 patch P0-Sec5

---

## Q4. 跨平台 safeStorage 实测窗口

**决策：(a)** P0-Sec1a 阶段须在 Linux/macOS/Windows 三平台各跑一次 CI

**含义**：
- GitHub Actions matrix 三个 runner（windows-latest / macos-latest / ubuntu-latest）
- 每平台验证：safeStorage.isEncryptionAvailable()、backend 类型（basic_text 检测）、ciphertext v10/v11 prefix
- Linux basic_text 明文回退时 fail build（spec §8 风险表升级）
- 三平台实测成本 < 1 天（CI 配置 + 检测脚本）

**生效位置**：v2 addendum §D.1.8 / §D.2.13 + spec v0.4 patch P0-CI

---

## Q5. P0-CI pre-commit hook 强制度

**决策：(a)** CI-only 阻断

**含义**：
- pre-commit hook 通过 GitHub Actions / GitLab CI 阻断
- 本地开发者不强制安装（不阻断 commit）
- README 文档化推荐安装
- 与 v2 C.2 (engineer pushback) 一致：避免本地强制导致 onboarding friction

**生效位置**：v2 addendum §D.2.11 + spec v0.4 patch P0-CI

---

## Q6. 本地 Ollama 是否纳入 P0-Sec2 白名单

**决策：(a)** 加 `127.0.0.1:11434` 例外

**含义**：
- P0-Sec2 SSRF 防御层加 dev override：`WRITER_ALLOW_LOCAL_OLLAMA=1` 或类似机制
- 仅 127.0.0.1:11434 单 host 例外（不开 0.0.0.0 通配）
- 生产 build 默认 disable，本地 dev 模式 enable
- 与 v2 D.1.4 现有方案一致

**生效位置**：v2 addendum §D.1.4 / §D.2.12 + spec v0.4 patch P0-Sec2

---

## Q7. P0-Sec7/8/9 三个新增项是否全部进 P0

**决策：(a)** 全部进 P0

**含义**：
- P0-Sec7：CSP（§5.2 P1-Sec7 提前到 P0）
- P0-Sec8：correlation_id middleware + 错误脱敏统一层（原 P1-Sec8 提前）
- P0-Sec9：npm audit CI 阻断（原 P1-CI2 拆分出的 CI 阻断部分）
- **总 P0 工作量**：原 6-8 周 → **7.5-9.5 周**（+1.5 周）
- 这是用户明确接受的延期

**生效位置**：v2 addendum §D.3 + spec v0.4 patch

---

## Q8. P0-Sec1b 14 PR → 4 PR 是否接受

**决策：(a)** 接受 4 PR 合并（C.2 推荐）

**含义**：
- 14 个 router 鉴权挂载从 14 PR → 4 PR（每 PR 含 3-4 router）
- 推翻 spec 原方案（spec 原 14 router 各自独立 PR）
- 理由：单人接手者 14 PR 开销过大；4 PR reviewable 单元更大但 overhead 更小
- 风险：单 router bug 影响 3-4 个同 PR router；通过 Playwright auth-baseline.spec.ts 每 router 单独测试兜底

**生效位置**：v2 addendum §D.2.4 + spec v0.4 patch P0-Sec1b

---

## 后续动作协议

1. ✅ 路径迁移（Q1）已完成
2. ⏳ **触发原 spec v0.3.1 → v0.4 patch**
   - D.1.* 全部并入（11 硬阻塞）
   - D.2.* 按用户裁决并入（9 建议改）
   - D.3.* 新增 3 P0 项（Sec7/8/9）
3. ⏳ v0.4 patch 通过 Planner→Architect→Critic 评审闭环
4. ⏳ 用户最终批准 v0.4 → 进入实施阶段

## 注意事项

- Q1 的迁移已物理完成；原 `.omc/plans/` 目录已删除
- 所有 v2 §F 决策一旦进 v0.4 patch 即不可单独回退（需新 spec 修订）
- v2 addendum 自身不再更新 §F 章节；本文档为决策凭证
- 用户对原 spec §9.2 5 条 open question 未在本次裁决——保留现状