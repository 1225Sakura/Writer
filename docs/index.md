# Documentation Index

Documentation for Auto Novel Writer (自动化写作软件).

---

## 核心文档

- [README.md](./README.md) — 项目概述、快速开始、API 文档、色彩系统
- [AGENTS.md](./AGENTS.md) — Agent 系统文档、三界面架构、关键实体
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 架构决策记录 (ADR)：BaseAgent、缓存、Provider 路由
- [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) — 后端实现指南：三层架构、服务、事件系统
- [DEVELOPER.md](./DEVELOPER.md) — 开发者入门指南、环境搭建、常用命令
- [services-boundary.md](./services-boundary.md) — services/ 与 core/services/ 边界说明

## API 文档

- [API.md](./API.md) — API 端点完整文档（请求/响应格式、示例）
- [api/API_ENDPOINTS.md](./api/API_ENDPOINTS.md) — API 端点规范

## 设计文档

- [design/OVERALL-ARCHITECTURE.md](./design/OVERALL-ARCHITECTURE.md) — 战略规划文档（路线图、风险分析、功能矩阵）
- [design/agent-system.md](./design/agent-system.md) — Agent 系统与 AI 工作流架构设计
- [design/api-design.md](./design/api-design.md) — API 设计文档
- [design/data-model.md](./design/data-model.md) — 数据模型设计
- [design/service-layer.md](./design/service-layer.md) — 服务层设计
- [design/code-review.md](./design/code-review.md) — 代码审查报告
- [design/reference-analysis.md](./design/reference-analysis.md) — 参考架构分析
- [design/test-strategy.md](./design/test-strategy.md) — 测试策略
- [design/security-performance.md](./design/security-performance.md) — 安全与性能设计
- [design/industry-research.md](./design/industry-research.md) — 行业调研
- [design/DESIGN-SYSTEM-REFERENCE.md](./design/DESIGN-SYSTEM-REFERENCE.md) — 设计系统参考 (Notion)

## 开发文档

- [development/CONTRIBUTING.md](./development/CONTRIBUTING.md) — 贡献指南、分支管理、Commit 规范
- [development/DEPLOY.md](./development/DEPLOY.md) — 服务器部署指南
- [development/VISUAL_UPGRADE.md](./development/VISUAL_UPGRADE.md) — 视觉升级文档

## 运维文档

- [operations/LOGS.md](./operations/LOGS.md) — 日志系统文档

## 专项文档

- [CLI.md](./cli/CLI.md) — 命令行接口文档
- [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) — 安全审计报告
- [ARCHITECTURE_EVALUATION.md](./ARCHITECTURE_EVALUATION.md) — 目录结构重组评估报告
- [MIGRATE_FROM_DATABASE_SERVICE.md](./MIGRATE_FROM_DATABASE_SERVICE.md) — 从 database_service 迁移指南

---

## 文档更新原则

1. **色值以代码为准** — 色彩系统的 SSOT 是 `src/frontend/src/styles/design-tokens.css`，文档必须与其一致
2. **API 变更同步文档** — 修改 API 端点时，同步更新 `docs/API.md` 和 `docs/api/API_ENDPOINTS.md`
3. **架构变更记录 ADR** — 重大架构决策记录在 `docs/ARCHITECTURE.md`
4. **交叉引用而非复制** — 相关文档之间使用链接引用，不复制内容
5. **每季度审查** — 检查文档与代码的一致性，更新过时内容
