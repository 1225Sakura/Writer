# Auto Novel Writer — AI 辅助网络小说写作平台

面向中文网络小说作者的本地桌面写作软件，通过 AI 辅助完成从世界观构建、角色设定到正文创作的全流程。

## 项目目标

为中文网文作者提供沉浸式、AI 协作的本地写作环境。无需联网即可使用全部界面与编辑功能，AI 辅助（生成/优化/检查）通过外部 API 提供。

## 三界面架构

| 界面 | 功能 |
|------|------|
| **聊天初始化 (Chat Initialization)** | AI 主动提问，收集世界观、角色、金手指等设定；实时显示已收集信息面板，支持随时进入下一界面 |
| **设定编辑 (Setting Editor)** | 左侧分类导航（世界观/角色/物品/地点/势力/规则/大纲/IF 线）+ 右侧编辑器 + 关系可视化；支持 AI 审查多轮迭代 |
| **正文写作 (Writing Editor)** | 沉浸式写作区，AI 操作抽屉 + 协作面板抽屉独立展开/收起；工具栏覆盖写作/大纲/AI 操作/协作/返回设定 |

### 写作界面功能

#### 编辑器核心体验
- **Corkboard 视图** — 章节卡片拖拽排序，类似 Scrivener
- **版本快照系统** — 自动快照 + 手动标记 + Diff 对比
- **焦点模式** — 当前段落高亮，其他段落半透明模糊
- **打字机模式** — 光标始终保持在屏幕中央
- **数据仪表盘** — 字数目标环、写作热力图、Session 统计

#### AI 协作系统
- **无选中触发 AI** — 光标位置直接触发续写/优化
- **专业 Diff 对比** — 并排视图 + 逐行高亮 + 部分接受/拒绝
- **Ghost Text** — Tab 接受的内联 AI 建议
- **命令面板** — 输入 `/` 触发 AI 操作
- **深度上下文感知** — AI 考虑前后章节、角色状态、伏笔线

#### 写作辅助面板
- **面板联动** — 点击伏笔/角色自动跳转到对应段落
- **剧情追踪器** — 伏笔线状态管理（埋设/发展/揭示/回收）
- **IF 线管理** — IF 线与主线进度对比
- **角色故事线** — 角色弧光可视化 + OOC 检测
- **分析面板** — 章节节奏分析 + 读者吸引力评分 + 情感曲线

#### 工具栏与导航
- **浮动工具条** — 写作模式下可展开的快捷操作
- **章节切换器** — Ctrl+Shift+Up/Down 快速切换
- **快捷键体系** — Ctrl+Shift+O/E/S/R/W/P 六大 AI 操作
- **沉浸模式** — F11 全屏，隐藏所有 chrome

## 技术栈

| 层 | 技术 |
|----|------|
| **前端框架** | React 18 + TypeScript + Vite |
| **UI 组件** | shadcn/ui + Radix + Tailwind CSS |
| **富文本编辑器** | Tiptap (ProseMirror) |
| **状态管理** | Zustand |
| **动画** | Framer Motion |
| **桌面壳层** | Electron + electron-builder |

数据全部保存在本地（Electron 内置存储），AI 能力通过外部 API 调用（用户在界面内配置）。

## 快捷键

| 操作 | 快捷键 |
|------|--------|
| 优化 | `Ctrl+Shift+O` |
| 扩写 | `Ctrl+Shift+E` |
| 缩写 | `Ctrl+Shift+S` |
| 改写 | `Ctrl+Shift+R` |
| 续写 | `Ctrl+Shift+W` |
| 润色 | `Ctrl+Shift+P` |
| 切换 AI 抽屉 | `Ctrl+\` |
| 切换协作面板 | `Ctrl+/` |
| 保存 | `Ctrl+S` |
| 全屏写作 | `F11` |
| 上一章 | `Ctrl+Shift+Up` |
| 下一章 | `Ctrl+Shift+Down` |

## 色彩系统

| 类型 | 色值 | 用途 |
|------|------|------|
| 深墨色 | `#1a1510` | 写作区背景（深色模式） |
| 宣纸白 | `#f5eed6` | 正文文字/卡片背景 |
| 朱砂红 | `#8b3a3a` | 强调/警告/重要标记 |
| 角色橙 | `#c9a06e` | 角色类型编码 |
| 物品紫 | `#8b7aaa` | 物品类型编码 |
| 地点青 | `#6b9e8e` | 地点类型编码 |
| 势力红 | `#a04848` | 势力类型编码 |
| 大纲蓝 | `#7088a8` | 大纲类型编码 |
| IF 线绿 | `#7a9e58` | IF 线类型编码 |

## 主题

支持 6 种主题切换：
- 深色 (Dark)
- 浅色 (Light)
- 护眼 (Eye-care)
- 深蓝 (Deep Blue)
- 复古 (Sepia)
- 森林 (Forest)

## 项目结构

```
writer/
├── src/
│   └── frontend/           # React 前端
│       ├── src/
│       │   ├── components/
│       │   │   ├── writing/      # 写作界面组件
│       │   │   │   ├── corkboard/     # Corkboard 视图
│       │   │   │   ├── snapshots/     # 版本快照
│       │   │   │   ├── dashboard/     # 数据仪表盘
│       │   │   │   ├── ai/            # AI 协作组件
│       │   │   │   ├── linkage/       # 面板联动
│       │   │   │   ├── toolbar/       # 工具栏
│       │   │   │   ├── collaboration/ # 协作面板
│       │   │   │   ├── editor/        # 编辑器子组件
│       │   │   │   └── immersive/     # 沉浸模式
│       │   │   ├── chat/         # 聊天界面
│       │   │   ├── settings/     # 设定编辑器
│       │   │   └── shared/       # 共享组件
│       │   ├── store/            # Zustand 状态管理
│       │   ├── api/              # 外部 API 调用
│       │   ├── hooks/            # 自定义 Hooks
│       │   └── styles/           # CSS 样式
│       └── package.json
└── electron/               # Electron 桌面壳层
    ├── main/               # 主进程
    ├── preload/            # 预加载脚本
    └── package.json
```

## 开发

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装与构建

```bash
# 1. 构建前端
cd src/frontend
npm install
npm run build

# 2. 构建 Electron 桌面应用
cd ../../electron
npm install
npm run build:electron
```

构建产物位于 `electron/release/`：

| 文件 | 说明 |
|------|------|
| `Writer Setup 1.0.0.exe` | Windows 安装程序 (~180MB) |
| `win-unpacked/Writer.exe` | 便携版 (无需安装) |

### 开发模式

```bash
# 启动前端开发服务器（热重载）
cd src/frontend
npm run dev

# 启动 Electron 并连接开发服务器
cd electron
npm run dev
```

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT License