# CLAUDE.md — 自动化写作软件 (Auto Novel Writer)

## 项目概述

本项目是一款面向中文网络小说作者的本地桌面写作软件，通过 AI 辅助完成从世界观构建、角色设定到正文创作的全流程。

**核心功能：** 三界面架构（聊天初始化 → 设定编辑 → 正文写作），支持文笔风格调节、人机协作比例控制、IF 线同步写作。

**技术栈：** Python FastAPI (后端) + React 18 (前端) + SQLite (本地存储) + MiniMax API (AI)

**参考架构：** `D:/writer/read/reference-webnovel`

---

## 运行环境

- **平台：** 本地桌面应用（Windows/macOS/Linux）
- **打包：** PyInstaller / PyWebView 或 Tauri + Python
- **网络：** 完全离线可用（API 调用依赖网络）

---

## 三界面架构

### 界面1：聊天初始化 (Chat Initialization)
- AI 主动提问，收集世界观、角色、金手指、反派等设定
- 实时显示已收集信息面板
- 支持随时进入界面2预览

### 界面2：设定编辑 (Setting Editor)
- 左侧分类导航（世界观/角色/物品/地点/势力/规则/大纲/IF线）
- 右侧编辑器支持关系可视化
- AI 审查可多次迭代（一致性检查、伏笔追踪、建议优化）

### 界面3：正文写作 (Writing Editor)
- 沉浸式写作区，最大化正文空间
- AI 操作抽屉（右侧）+ 协作面板抽屉（右侧），可独立展开/收起
- 工具栏：写作/大纲/AI操作/协作/返回设定
- 人机比例滑块实时调节
- 快捷键：Ctrl+Shift+O(优化) / E(扩写) / S(缩写) / R(改写) / W(续写) / P(润色)

---

## 色彩系统

| 类型 | 色值 | 用途 |
|------|------|------|
| 深墨色 | #1a1a2e | 写作区背景（深色模式） |
| 宣纸白 | #f5f0e6 | 正文文字/卡片背景 |
| 朱砂红 | #c45c5c | 强调/警告/重要标记 |
| 角色橙 | #e8b87d | 角色类型编码 |
| 物品紫 | #9b7ed9 | 物品类型编码 |
| 地点青 | #5eb5a6 | 地点类型编码 |
| 势力红 | #d45d5d | 势力类型编码 |
| 大纲蓝 | #5b8ee8 | 大纲类型编码 |
| IF线绿 | #7eb84a | IF线类型编码 |

---

## 字体排版

- **写作字体：** 思源宋体 (中文) / JetBrains Mono (英文)，16-18px，行高 1.75-2em
- **界面字体：** 思源黑体 / Inter，13-14px，行高 1.5em
- **基础单位：** 4px

---

## 关键实体 (Ontology)

| 实体 | 说明 |
|------|------|
| StoryOutline | 故事线，包含章节 |
| IFLine | IF线，同步配角角色故事线 |
| Chapter | 章节，属 StoryOutline |
| Character | 角色，属 IFLine |
| CharacterStory | 角色故事线 |
| WritingStyle | 文笔风格（江南/卡夫卡/加缪/默认/自定义） |
| AIGeneratedContent | AI 生成内容，含质量分 |

---

## 状态管理

- 使用 Zustand 管理 React 状态
- 数据存储于本地 SQLite，参考 `reference-webnovel` 的 entity/relationship 模型

---

## 快捷键

| 操作 | 快捷键 |
|------|--------|
| 切换AI抽屉 | Ctrl+\ |
| 切换协作面板 | Ctrl+/ |
| 保存 | Ctrl+S |
| 全屏写作 | F11 |
| 优化/扩写/缩写/改写/续写/润色 | Ctrl+Shift+O/E/S/R/W/P |

---

## 约束 (Constraints)

- 仅本地桌面应用，不做移动端/Web端
- 不部署本地模型，纯 API 调用
- 不做出版级校对/语法检查
- 不做多语言/翻译功能

---

## AI 生成模式

**A+C 混合模式：**
- 主线：用户 prompt → AI 生成 → 用户确认
- IF线/配角线：AI 自动生成 → 用户偶尔介入
- 人机比例可调（滑块控制）

---

## 组件参考

- 富文本编辑器：Tiptap / BlockNote
- 关系图谱：react-force-graph-3d
- UI组件库：shadcn/ui (Radix + Tailwind)
- 侧边抽屉：@radix-ui/react-dialog (shadcn/ui Sheet)
- 状态管理：Zustand
- ORM：SQLAlchemy 或 Drizzle（待定）

---

## API 设计（待补充）

| 端点 | 方法 | 说明 |
|------|------|------|
| /api/chat/session | POST | 创建聊天会话 |
| /api/chat/messages | GET/POST | 获取/发送聊天消息 |
| /api/settings | GET/PUT | 读取/更新设定 |
| /api/chapters | CRUD | 章节管理 |
| /api/ai/generate | POST | AI 生成内容 |
| /api/ai/review | POST | AI 审查设定 |
| /api/styles | GET | 获取文笔风格 |

---

## 构建系统

### 本地自动化构建

项目配置了 Git hooks 实现本地自动构建：

- **post-commit hook**: 每次 `git commit` 后自动触发完整构建
  - 位置: `.git/hooks/post-commit`
  - 执行: `build-local.bat` → `scripts\local-build.ps1`
  - 日志: `.build_logs/commit_<timestamp>.log`

- **构建脚本**:
  - `build-local.bat` - Windows 构建入口（调用 PowerShell）
  - `scripts\local-build.ps1` - PowerShell 构建脚本
  - `scripts\build.sh` - Linux/macOS 构建脚本

### 构建流程

1. 前端构建 (`src/frontend` npm run build)
2. 复制产物到 `electron/frontend-build`
3. Electron TypeScript 编译
4. electron-builder 打包
5. 输出: `electron/release/Writer Setup 1.0.0.exe`

### 构建产物

| 文件 | 说明 |
|------|------|
| `Writer Setup 1.0.0.exe` | Windows 安装程序 (85MB) |
| `win-unpacked/Writer.exe` | 便携版 (无需安装) |

---

## 待完善章节

| 缺失内容 | 状态 | 说明 |
|----------|------|------|
| ChatMessage/ConversationSession 实体 | 待补充 | 界面1聊天对话数据模型 |
| AIInspectionResult 实体 | 待补充 | AI审查结果存储 |
| PlotThread/Foreshadowing 实体 | 待补充 | 伏笔追踪数据模型 |
| DraftVersion/EditHistory | 待补充 | 写作版本管理 |
| API Endpoint 详细设计 | 待补充 | 请求/响应格式 |
| 错误处理与边界情况 | 待补充 | 网络中断、API超时等 |
| 数据备份与迁移策略 | 待补充 | SQLite 备份方案 |
| 日志与可观测性 | 待补充 | 运行日志、用户操作日志 |
| 安全与隐私 | 待补充 | 本地数据加密 |
