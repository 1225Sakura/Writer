# Ralplan: 项目文档更新与整理

> **状态**: pending approval (共识已达成: Architect + Critic 通过)
> **日期**: 2026-05-28
> **模式**: --interactive --deliberate
> **版本**: v1.2 (Critic review incorporated — SSOT direction corrected)

---

## RALPLAN-DR 结构化审议

### Principles (原则)

1. **单一事实来源 (SSOT)** — 每个信息只在一个权威位置定义，其他文档引用而非复制
2. **一致性优先** — 色值、路径、API 端点等硬数据必须在所有文档中保持一致
3. **渐进式修复** — 先修复关键不一致，再重组结构，最后补充缺失内容
4. **可发现性** — 任何开发者应在 30 秒内找到所需文档
5. **与代码同步** — 文档必须反映当前代码状态，而非历史状态

### Decision Drivers (决策驱动)

1. **当前存在多处数据不一致** — 色值、API 路径、分支名在不同文档中冲突
2. **文档索引不完整** — `docs/index.md` 仅列出 10/27+ 文档
3. **部分文档内容过时** — AGENTS.md 仍标记 API 设计为"待补充"，但实际 API 文档已完善

### Viable Options (可行方案)

#### 方案 A: 三阶段渐进式修复 (推荐)

| 阶段 | 内容 | 文件数 | 风险 |
|------|------|--------|------|
| Phase 1: 修复不一致 | 统一色值、修复路径引用、更新分支名、同步 API 状态 | ~8 文件 | 低 |
| Phase 2: 结构重组 | 更新 index.md、合并重复设计文档、清理过时内容 | ~10 文件 | 低-中 |
| Phase 3: 补充缺失 | 补充 DEVELOPER.md、添加 CONTRIBUTING 更新、创建 docs/README 索引增强 | ~5 文件 | 低 |

**优点**: 风险最低，每阶段可独立验证，不影响代码功能
**缺点**: 耗时较长（三阶段）

#### 方案 B: 一次性全面重写

将所有文档统一重写为一套完整的文档体系。

**优点**: 最终结果最一致
**缺点**: 工作量大，风险高（可能遗漏现有有价值内容），不适合 --deliberate 模式

#### 方案 C: 仅修复关键不一致

只修复色值、路径、分支名等硬性错误，不做结构重组。

**优点**: 最快完成
**缺点**: 文档散乱问题未解决，可发现性仍然差

### Invalidated Options (排除方案)

- **方案 B 排除理由**: 在 --deliberate 模式下，一次性重写风险过高，且现有文档中有大量有价值的架构决策记录（如 ARCHITECTURE.md、services-boundary.md），不应被覆盖

---

## 详细执行计划

### Phase 1: 修复关键不一致 (高优先级)

#### 1.1 统一色彩系统

**问题**: 三处色彩定义不一致

| 色彩 | CLAUDE.md | docs/README.md (过时) | docs/AGENTS.md (过时) | design-tokens.css (SSOT) |
|------|-----------|----------------------|----------------------|--------------------------|
| 深墨色 | #1a1510 | #1a1a2e | #1a1a2e | #1a1510 |
| 宣纸白 | #f5eed6 | #f5f0e6 | #f5f0e6 | #f5eed6 |
| 朱砂红 | #8b3a3a | #c45c5c | #c45c5c | #8b3a3a |
| 角色橙 | #c9a06e | #e8b87d | #e8b87d | #c9a06e |
| 物品紫 | #8b7aaa | #9b7ed9 | #9b7ed9 | #8b7aaa |
| 地点青 | #6b9e8e | #5eb5a6 | #5eb5a6 | #6b9e8e |
| 势力红 | #a04848 | #d45d5d | #d45d5d | #a04848 |
| 大纲蓝 | #7088a8 | #5b8ee8 | #5b8ee8 | #7088a8 |
| IF线绿 | #7a9e58 | #7eb84a | #7eb84a | #7a9e58 |

**独立验证结果**: `design-tokens.css` 中的 CSS 变量（`--ink-100: #1a1510`, `--paper-100: #f5eed6`, `--vermillion-100: #8b3a3a`, `--color-character: #c9a06e` 等）与 CLAUDE.md 完全一致。docs/README.md 和 docs/AGENTS.md 中的色值是"复古书房视觉重构"之前的旧值。

**SSOT 链**: `design-tokens.css` → `CLAUDE.md` → `docs/README.md` / `docs/AGENTS.md`

**行动**: 更新 `docs/README.md` 和 `docs/AGENTS.md` 中的色彩系统表，使其与 `CLAUDE.md` 及 `design-tokens.css` 保持一致

#### 1.2 修复分支引用

**问题**: `docs/development/CONTRIBUTING.md` 引用 `main` 分支，实际使用 `master`

**行动**:
- 将 `main` 改为 `master`
- 删除不存在的 `develop` 分支引用
- 修正 `frontend/` 为 `src/frontend/`

#### 1.3 更新 AGENTS.md 过时内容

**问题**: AGENTS.md 仍包含：
- "API 设计（待补充）" — 实际 API 文档已完善（docs/API.md, docs/api/API_ENDPOINTS.md）
- "待完善章节" 列表中多项已在代码中实现

**行动**:
- 将 API 设计部分改为引用 `docs/API.md`
- 更新"待完善章节"状态，标记已完成项

#### 1.4 增强 DEVELOPER.md 命令引用

**问题**: `docs/DEVELOPER.md` 引用 `scripts/init_db.py`（该路径实际存在，但不是推荐方式）

**行动**: 在现有 `scripts/init_db.py` 引用旁添加推荐的现代 CLI 命令 (`python cli.py db init`)，并更新其他过时命令

### Phase 2: 结构重组 (中优先级)

#### 2.1 更新 docs/index.md

**问题**: 仅列出 10/27+ 文档

**行动**: 创建完整的文档索引，分类为：
- 核心文档 (README, AGENTS, ARCHITECTURE)
- API 文档
- 设计文档
- 开发文档
- 运维文档

#### 2.2 清理 DESIGN.md 定位

**问题**: `docs/design/DESIGN.md` 是 Notion 设计系统参考文档，不是 Writer 项目自身设计

**行动**:
- 重命名为 `DESIGN-SYSTEM-REFERENCE.md` 或移至 `docs/reference/`
- 在 index.md 中明确标注其为参考文档

#### 2.3 为重叠架构文档添加交叉引用（不合并）

**问题**: `docs/ARCHITECTURE.md`、`docs/BACKEND_ARCHITECTURE.md`、`docs/design/OVERALL-ARCHITECTURE.md` 三者有内容重叠但服务不同受众

**Architect 评估**: 三篇文档定位不同：
- `ARCHITECTURE.md` — 架构决策记录 (ADR)，Living document
- `BACKEND_ARCHITECTURE.md` — 后端实现指南（分层架构、服务、事件系统）
- `OVERALL-ARCHITECTURE.md` — 战略规划文档（路线图、风险分析、功能矩阵）

**行动**:
- 保持三篇文档独立，不合并
- 在每篇文档顶部添加"相关文档"交叉引用
- 明确标注每篇文档的定位和边界

### Phase 3: 补充缺失 (低优先级)

#### 3.1 增强 DEVELOPER.md

**行动**: 扩充为完整的开发者入门指南，包含：
- 环境搭建步骤
- 常用 CLI 命令速查
- 调试技巧
- 测试运行方法

#### 3.2 更新 CONTRIBUTING.md

**行动**:
- 修正分支策略为实际使用的 Git Flow
- 添加代码审查清单
- 更新测试覆盖率要求

#### 3.3 文档维护机制（轻量级）

**Architect 建议**: 对于单人开发的本地桌面应用，正式的 `MAINTENANCE.md` 维护指南可能过度工程化

**行动**: 不创建独立维护文档，改为：
- 在 `docs/index.md` 底部添加简短的"文档更新原则"小节（3-5 条规则）
- 在 Follow-ups 中记录：如项目扩展为多人协作，再考虑独立维护指南

---

## Pre-Mortem (前置风险分析)

### 场景 1: SSOT 方向判断错误导致文档被覆写为过时值

**风险**: 如果错误地以 docs 为准更新 CLAUDE.md，会将正确的色值替换为旧值
**缓解**: 执行前独立验证 design-tokens.css 中的实际色值（已通过 Critic 审查确认）

### 场景 2: 文档重组导致外部链接失效

**风险**: 如果有外部引用指向当前文档路径
**缓解**: 本项目为本地桌面应用，无外部文档托管，风险极低

### 场景 3: 过度整理导致有价值内容丢失

**风险**: 合并/重命名过程中遗漏重要信息
**缓解**: 使用 git 跟踪所有变更，每阶段单独提交

---

## Expanded Test Plan (扩展测试计划)

### 验证步骤

| 测试类型 | 验证内容 | 方法 |
|----------|---------|------|
| **色值正确性** | CLAUDE.md 色值与 design-tokens.css 一致 | grep `design-tokens.css` 中的色值，与 CLAUDE.md 比对 |
| **文档一致性** | docs/README.md 和 docs/AGENTS.md 色值与 CLAUDE.md 一致 | grep 色值字符串，交叉比对三个文件 |
| **链接检查** | index.md 中所有链接指向存在的文件 | 脚本验证每个链接路径 |
| **路径检查** | 文档中引用的文件路径存在 | glob 验证 |
| **内容检查** | AGENTS.md 不再包含"待补充"标记 | grep 关键词 |
| **分支检查** | 无文档引用不存在的分支 | grep 分支名 |

---

## ADR (架构决策记录)

**Decision**: 采用三阶段渐进式修复方案

**Drivers**:
1. 当前存在多处数据不一致需要修复
2. 文档可发现性差（索引不完整）
3. 部分内容已过时

**Alternatives considered**:
- 一次性全面重写 — 风险过高，可能丢失有价值的 ADR
- 仅修复关键不一致 — 不解决结构性问题

**Why chosen**: 渐进式方案风险最低，每阶段可独立验证，适合 --deliberate 模式

**Consequences**:
- 需要三轮执行
- 每阶段需要独立验证
- 最终文档体系更清晰、一致、可维护

**Follow-ups**:
- 添加 CI grep 检查：验证 docs/README.md 色值与 `design-tokens.css` 一致（防止再次漂移）
- 如项目扩展为多人协作，考虑创建独立的文档维护指南
