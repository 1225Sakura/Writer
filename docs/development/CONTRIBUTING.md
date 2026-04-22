# Contributing to 自动化写作软件

感谢您对本项目的兴趣！请遵循以下指南参与贡献。

---

## 开发环境

### 技术栈

- **后端：** Python 3.11+ / FastAPI
- **前端：** React 18 / TypeScript
- **存储：** SQLite
- **AI：** MiniMax API (OpenAI 兼容格式)
- **打包：** PyInstaller / PyWebView 或 Tauri

### 本地运行

```bash
# 克隆仓库
git clone <repo-url>
cd writer

# 安装后端依赖
pip install -r requirements.txt

# 安装前端依赖
cd frontend && npm install

# 运行开发服务器
# 后端
uvicorn main:app --reload
# 前端
npm run dev
```

---

## 分支管理

- `main` — 生产分支，仅通过 PR 合并
- `develop` — 开发分支，所有功能合并至此
- `feature/*` — 功能分支，命名如 `feature/chat-init-ui`
- `fix/*` — 修复分支，命名如 `fix/ooc-detection`

---

## Commit 规范

格式：`<type>(<scope>): <description>`

| type | 说明 |
|------|------|
| feat | 新功能 |
| fix | 修复bug |
| docs | 文档更新 |
| style | 代码格式（不影响功能） |
| refactor | 重构 |
| test | 测试相关 |
| chore | 构建/工具相关 |

示例：
```
feat(interface1): add chat initialization UI
fix(ooc): correct OOC detection threshold
refactor(style): migrate to shadcn/ui components
```

---

## Pull Request 流程

1. Fork 仓库并创建功能分支
2. 确保代码通过所有测试 (`pytest`, `npm test`)
3. 填写 PR 描述，说明改动内容和关联 Issue
4. 等待代码审查（至少 1 人 approve）
5. 合并到 `develop` 分支

---

## 代码规范

### Python
- 遵循 PEP 8
- 使用 type hints
- 异步优先（FastAPI）

### React/TypeScript
- 遵循项目现有的组件结构
- 使用 Functional Components + Hooks
- 组件文件用 PascalCase（如 `WritingEditor.tsx`）
- 工具函数用 camelCase（如 `useWritingStore.ts`）

### CSS/Tailwind
- 使用 shadcn/ui 组件库
- 遵循色彩系统（见 CLAUDE.md）
- 优先使用设计系统 token

---

## 测试要求

| 层级 | 工具 | 覆盖率目标 |
|------|------|-----------|
| 单元测试 | pytest / Vitest | 80%+ |
| 集成测试 | pytest / Playwright | 核心流程 |
| E2E测试 | Playwright | 三界面流转 |

---

## Issue 规范

- 提交前先搜索是否已有相同 Issue
- 使用模板（Bug Report / Feature Request）
- 描述清晰，包含复现步骤或使用场景
- 关联三界面架构（界面1/界面2/界面3）

---

## 行为准则

- 尊重所有参与者
- 保持讨论聚焦在技术和产品层面
- 代码审查基于质量，不基于个人偏好
