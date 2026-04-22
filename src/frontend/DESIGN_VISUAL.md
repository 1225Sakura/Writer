# 前端视觉升级方案

**文档版本：** 1.0
**创建日期：** 2026-04-22
**基于规格：** `.omc/specs/deep-interview-自动化写作软件.md`
**前置报告：** `spec-review.md`（界面设计评分9/10）、`structure-review.md`

---

## 一、色彩系统优化

### 1.1 当前色彩分析

**已有色彩定义：**

| 用途类别 | 现有颜色 | 状态 |
|----------|----------|------|
| 核心色 | `#1a1a2e`（深墨）、`#f5f0e6`（宣纸白） | ✅ 完整 |
| 实体编码 | 角色橙/物品紫/地点青/势力红/大纲蓝/IF线绿 | ✅ 完整 |
| 状态色 | normal/warning/error/success | ✅ 完整 |
| UI深色 | `#08090a`/`#0f1011`/`#252540` | ✅ 已定义 |
| UI浅色 | `#ffffff`/`#f5f0e6`/`#1a1a2e` | ⚠️ 仅背景色 |
| 边框/装饰 | `rgba(255,255,255,0.08)` | ⚠️ 单一透明度 |

**缺失或待明确：**

| 问题 | 说明 |
|------|------|
| 深色模式UI色不完整 | 工具栏/抽屉在深色模式下的配色未定义 |
| 浅色模式完整色系缺失 | 只有背景色，交互色/悬停色/激活色未定义 |
| 实体色在浅色模式下的表现 | 明亮环境下实体色是否需要调整 |
| 纸张纹理叠加方式 | 可选纸质纹理如何与应用 |

### 1.2 优化建议：墨韵色系

**设计理念：** 以「墨韵」为核心，营造沉浸式写作氛围，兼具现代极简美学与东方书写传统。

```
主色板 (Primary Palette)
├── 深墨 (Ink Black)     #0d0d12  → 写作区/沉浸模式背景
├── 墨灰 (Charcoal)       #1a1a2e  → 卡片/面板背景
├── 宣纸 (Paper White)    #f5f0e6  → 正文文字/浅色模式背景
├── 烟灰 (Smoke)          #3a3a4a  → 次级界面/分隔线
└── 霜白 (Frost)          #e8e4dc  → 浅色模式卡片

强调色板 (Accent Palette)
├── 紫辰 (Accent Purple)  #5e6ad2  → 主按钮/聚焦/AI相关
├── 霁红 (Vermillion)     #c45c5c  → 警告/重要标记/朱砂批注
├── 琥珀 (Amber)          #e8b87d  → 角色类型/温暖提示
└── 翠岚 (Jade)           #5eb5a6  → 地点类型/成功状态

实体色板 (Entity Palette) - 保持现有
├── 角色橙   #e8b87d
├── 物品紫   #9b7ed9
├── 地点青   #5eb5a6
├── 势力红   #d45d5d
├── 大纲蓝   #5b8ee8
└── IF线绿   #7eb84a

语义色板 (Semantic Palette)
├── Error     #c45c5c  (霁红)
├── Warning   #e8b87d  (琥珀)
├── Success   #5eb5a6  (翠岚)
└── Info      #5e6ad2  (紫辰)
```

### 1.3 色彩应用规范

**三界面色彩分配：**

| 界面 | 深色模式 | 浅色模式 |
|------|----------|----------|
| 聊天初始化 (Chat) | 背景: `#0d0d12`<br>卡片: `#1a1a2e`<br>文字: `#f5f0e6` | 背景: `#faf8f3`<br>卡片: `#ffffff`<br>文字: `#1a1a2e` |
| 设定编辑 (Settings) | 背景: `#0d0d12`<br>侧边栏: `#151520`<br>面板: `#1a1a2e` | 背景: `#f5f0e6`<br>侧边栏: `#ebe5d8`<br>面板: `#ffffff` |
| 正文写作 (Writing) | 背景: `#0d0d12`<br>写作区: `#1a1a2e`<br>工具栏: `#252540` | 背景: `#ffffff`<br>写作区: `#faf6e8`<br>工具栏: `#f5f0e6` |

**交互状态色彩：**

| 状态 | 深色模式 | 浅色模式 |
|------|----------|----------|
| Default | 边框: `rgba(255,255,255,0.08)` | 边框: `#e0dcd3` |
| Hover | 背景: `rgba(255,255,255,0.05)`<br>边框: `rgba(255,255,255,0.15)` | 背景: `#f5f0e6`<br>边框: `#c0bbb0` |
| Active | 背景: `rgba(94,106,210,0.15)`<br>边框: `#5e6ad2` | 背景: `#e8e4dc`<br>边框: `#a09a8c` |
| Disabled | 透明度: `40%` | 透明度: `40%` |
| Focus | 环: `rgba(94,106,210,0.5)` | 环: `rgba(94,106,210,0.4)` |

---

## 二、字体排版方案

### 2.1 写作字体推荐

**字体栈：**

```
写作模式 (Writing Mode)
├── 中文：Source Han Serif SC (思源宋体 SC)
│         备选：Noto Serif SC, Songti SC, STSong
├── 英文：JetBrains Mono
│         备选：iA Writer Quattro, Fira Code
└── 字体大小：16-18px (可调节)
     行高：1.75-2em
     字间距：0.05em

界面模式 (Interface Mode)
├── 中文：Source Han Sans SC (思源黑体 SC)
│         备选：Noto Sans SC, PingFang SC, Microsoft YaHei
├── 英文：Inter
│         备选：SF Pro, Segoe UI
└── 字体大小：13-14px
     行高：1.5em
     字间距：0.02em
```

**字体加载策略：**

| 字体类型 | 加载方式 | 说明 |
|----------|----------|------|
| 思源宋体/黑体 | Google Fonts / Adobe Fonts CDN | 优先使用 CDN，按需加载 |
| JetBrains Mono | npm 包 `fontaine` 或本地字体文件 | 编写代码块时使用 |
| Inter | 系统字体栈 + CDN 备用 | 界面字体不需要完整包 |

**字体文件路径建议：**
```
src/frontend/public/fonts/
├── SourceHanSerifSC-Regular.woff2
├── SourceHanSerifSC-Bold.woff2
├── SourceHanSansSC-Regular.woff2
├── SourceHanSansSC-Medium.woff2
└── JetBrainsMono-Regular.woff2
```

### 2.2 行高、字间距建议

**写作区排版参数：**

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 段落间距 | 1.5em | 段落之间留白 |
| 行高 | 1.8em | 舒适阅读体验 |
| 字间距 | 0.05em | 中文字符间距微调 |
| 句子间距 | 0.25em | 句子之间空格 |
| 首行缩进 | 2em | 中文章节段落传统格式（可选） |

**界面排版参数：**

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 组件间距 | 16px (1rem) | 基础间距单位 |
| 卡片内边距 | 20px | 卡片内容边距 |
| 列表项间距 | 12px | 紧凑列表间距 |
| 分组间距 | 32px | 内容分组间隔 |

---

## 三、界面布局优化

### 3.1 三界面布局细化

**界面1：聊天初始化 (ChatInitPage)**

```
┌─────────────────────────────────────────────────────────┐
│  顶部导航栏 (48px)                                       │
│  [Logo] [项目名称] [设置图标] [主题切换]                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │                 │  │                             │ │
│  │   AI 对话区域    │  │    已收集信息面板            │ │
│  │   (60% 宽度)    │  │    (40% 宽度)                │ │
│  │                 │  │    - 世界观摘要              │ │
│  │   [消息气泡]    │  │    - 角色列表                │ │
│  │   [输入框]      │  │    - 势力/物品/地点          │ │
│  │                 │  │    - 确认状态               │ │
│  │                 │  │                             │ │
│  └─────────────────┘  └─────────────────────────────┘ │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  底部操作栏 (56px)                                       │
│  [进入设定编辑] [保存会话] [历史记录]                     │
└─────────────────────────────────────────────────────────┘
```

**界面2：设定编辑 (SettingEditorPage)**

```
┌─────────────────────────────────────────────────────────┐
│  顶部导航栏 (48px) - 同上                                 │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  分类导航  │              内容编辑区                      │
│  (200px)  │              (flex: 1)                      │
│          │                                              │
│  [世界观]  │  ┌────────────────────────────────────────┐ │
│  [角色]    │  │                                        │ │
│  [物品]    │  │   实体编辑器 / 关系图谱                  │ │
│  [地点]    │  │   (Tiptap 富文本编辑器)                 │ │
│  [势力]    │  │                                        │ │
│  [规则]    │  │                                        │ │
│  [大纲]    │  └────────────────────────────────────────┘ │
│  [IF线]    │                                              │
│          │  ┌────────────────────────────────────────┐ │
│  ───────  │  │   AI 审查建议面板 (可收起)              │ │
│  [返回]    │  │   - 一致性检查                         │ │
│  [保存]    │  │   - 伏笔追踪                           │ │
│          │  │   - 优化建议                            │ │
│          │  └────────────────────────────────────────┘ │
├──────────┴──────────────────────────────────────────────┤
│  底部状态栏：当前编辑项 | 自动保存状态 | 快捷键提示        │
└─────────────────────────────────────────────────────────┘
```

**界面3：正文写作 (WritingEditorPage)**

```
┌─────────────────────────────────────────────────────────┐
│  工具栏 (44px)                                          │
│  [写] [纲] [AI] [协] │ 章节选择 │ 人机比例滑块 │ [全屏]   │
├────────────────────────────────────┬────────────────────┤
│                                    │                    │
│                                    │   AI 操作抽屉      │
│          写作区域                   │   (360px, 可收起)  │
│          (flex: 1)                  │                    │
│                                    │   [续写] [扩写]    │
│   ┌────────────────────────────┐  │   [缩写] [改写]    │
│   │                            │  │   [润色] [优化]    │
│   │   Tiptap 编辑器             │  │                    │
│   │   (墨韵主题样式)            │  │   ─────────────    │
│   │                            │  │                    │
│   │   [格式化工具条]            │  │   协作面板          │
│   │                            │  │   (可独立展开)      │
│   └────────────────────────────┘  │                    │
│                                    │   本章作战台：     │
│                                    │   目标/阻力/代价  │
│                                    │   钩子/期待        │
│                                    │                    │
├────────────────────────────────────┴────────────────────┤
│  大纲侧边栏 (280px, 可收起)                               │
│  [章节树] [伏笔列表] [IF线进度]                           │
└─────────────────────────────────────────────────────────┘
```

### 3.2 抽屉/面板设计规范

**面板尺寸规范：**

| 面板类型 | 宽度 | 高度 | 动画 |
|----------|------|------|------|
| AI 操作抽屉 | 360px | 100% | slide-in-right, 300ms |
| 协作面板 | 320px | 100% | slide-in-right, 250ms |
| 大纲侧栏 | 280px | 100% | slide-in-left, 250ms |
| 设置抽屉 | 480px | 100% | slide-in-right, 350ms |
| 确认对话框 | 400px (max) | auto | scale + fade, 200ms |

**面板状态：**

```typescript
type DrawerState = 'collapsed' | 'partial' | 'expanded'

const drawerWidths = {
  collapsed: '0px',
  partial: '48px',     // 仅图标可见
  expanded: '360px'    // 完整内容
}
```

### 3.3 响应式策略

**断点定义：**

| 断点 | 宽度 | 布局调整 |
|------|------|----------|
| desktop-xl | >= 1440px | 完整三栏布局 |
| desktop | 1024-1439px | 侧栏可折叠 |
| tablet | 768-1023px | 单栏 + 底部导航 |
| mobile | < 768px | 全屏单页 + 手势导航 |

**写作区响应式：**

| 屏幕宽度 | 编辑器宽度 | 侧栏 |
|----------|------------|------|
| >= 1200px | max-width: 800px (居中) | 显示 |
| 1024-1199px | width: 100% | 收起按钮 |
| < 1024px | width: 100% | 隐藏 (手势触发) |

---

## 四、动画过渡效果

### 4.1 界面切换动画

**Framer Motion 配置：**

```typescript
const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: {
    duration: 0.35,
    ease: [0.22, 1, 0.36, 1] // custom cubic-bezier
  }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
}
```

**界面切换场景：**

| 场景 | 动画效果 | 时长 |
|------|----------|------|
| Chat → Settings | 向右滑出 + 淡入 | 350ms |
| Settings → Writing | 向下折叠 + 淡入 | 400ms |
| Writing → Settings | 向上展开 + 淡入 | 350ms |
| 返回首页 | 整体淡出 | 250ms |

### 4.2 微交互设计

**按钮交互：**

| 交互 | 效果 |
|------|------|
| Hover | scale(1.02), 150ms |
| Active/Press | scale(0.98), 100ms |
| Loading | 脉冲 + spinner |
| Success | 绿色闪烁 + ✓ 图标 |
| Error | 红色抖动 (shake) |

**输入框交互：**

| 状态 | 效果 |
|------|------|
| Focus | 边框高亮 + 内阴影 |
| Error | 红色边框 + 抖动 |
| Success | 绿色边框 + 勾号 |
| Disabled | 降低透明度 |

**卡片悬停：**

```typescript
const cardHover = {
  whileHover: { scale: 1.01, y: -2 },
  transition: { duration: 0.2, ease: "easeOut" }
}
```

### 4.3 加载状态动画

**骨架屏 (Skeleton)：**

| 场景 | 动画 |
|------|------|
| 页面加载 | shimmer 从左到右, 1.5s |
| 列表加载 | 逐项 stagger 出现, 80ms 间隔 |
| 图片加载 | pulse 呼吸效果 |
| 内容生成中 | typewriter 光标 + 渐显文字 |

**AI 生成动画：**

```typescript
// 流式输出指示器
const generatingIndicator = {
  dot1: { opacity: 0.3, scale: 0.8 },
  dot2: { opacity: 0.6, scale: 1 },
  dot3: { opacity: 1, scale: 1.2 },
  transition: {
    duration: 0.6,
    repeat: Infinity,
    staggerChildren: 0.15
  }
}
```

---

## 五、组件视觉规范

### 5.1 卡片组件样式

**基础卡片 (Card)：**

```css
/* 深色模式 */
.card {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.04);
}

/* 悬停状态 */
.card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

/* 浅色模式 */
.card.light {
  background: #ffffff;
  border: 1px solid #e0dcd3;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.card.light:hover {
  border-color: #c0bbb0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

**玻璃态卡片 (GlassCard)：**

```css
.glass-card {
  background: rgba(26, 26, 46, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
}

.glass-card.light {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
```

**发光的卡片 (GlowCard)：**

```css
.glow-card {
  position: relative;
  background: #1a1a2e;
  border-radius: 12px;
}

.glow-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 13px;
  padding: 1px;
  background: linear-gradient(
    135deg,
    rgba(94, 106, 210, 0.5),
    rgba(94, 106, 210, 0.1),
    rgba(123, 135, 224, 0.3)
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

### 5.2 按钮样式规范

**按钮变体 (Variants)：**

| 变体 | 样式 | 用途 |
|------|------|------|
| `primary` | 紫辰色背景，白色文字 | 主要操作 |
| `secondary` | 墨灰背景，淡色文字 | 次要操作 |
| `outline` | 透明背景，紫辰色边框 | 强调但非主要 |
| `ghost` | 透明背景 | 辅助操作/工具栏 |
| `glow` | primary + 发光效果 | 特殊强调 |
| `gradient` | 紫辰渐变背景 | CTA 按钮 |

**按钮尺寸：**

| 尺寸 | 高度 | 内边距 | 圆角 | 用途 |
|------|------|--------|------|------|
| `sm` | 32px | 12px 16px | 8px | 紧凑布局 |
| `md` | 40px | 16px 20px | 10px | 默认 |
| `lg` | 48px | 20px 28px | 12px | 主要 CTA |
| `icon` | 40px | - | 50% | 图标按钮 |

### 5.3 输入框样式

**基础输入框：**

```css
.input {
  height: 40px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 0 16px;
  color: #f5f0e6;
  transition: all 0.2s ease;
}

.input::placeholder {
  color: rgba(247, 248, 248, 0.4);
}

.input:focus {
  outline: none;
  border-color: #5e6ad2;
  box-shadow: 0 0 0 3px rgba(94, 106, 210, 0.2),
              inset 0 0 8px rgba(94, 106, 210, 0.1);
}

.input.error {
  border-color: #c45c5c;
  box-shadow: 0 0 0 3px rgba(196, 92, 92, 0.2);
}
```

### 5.4 标签/徽章样式

**实体类型标签：**

| 类型 | 背景色 | 文字色 | 样式 |
|------|--------|--------|------|
| 角色 | `rgba(232, 184, 125, 0.15)` | `#e8b87d` | 圆角 + 左边框 |
| 物品 | `rgba(155, 126, 217, 0.15)` | `#9b7ed9` | 圆角 + 左边框 |
| 地点 | `rgba(94, 181, 166, 0.15)` | `#5eb5a6` | 圆角 + 左边框 |
| 势力 | `rgba(212, 93, 93, 0.15)` | `#d45d5d` | 圆角 + 左边框 |
| 大纲 | `rgba(91, 142, 232, 0.15)` | `#5b8ee8` | 圆角 + 左边框 |
| IF线 | `rgba(126, 184, 74, 0.15)` | `#7eb84a` | 圆角 + 左边框 |

**状态徽章：**

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
}

.badge.success {
  background: rgba(94, 181, 166, 0.15);
  color: #5eb5a6;
}

.badge.warning {
  background: rgba(232, 184, 125, 0.15);
  color: #e8b87d;
}

.badge.error {
  background: rgba(196, 92, 92, 0.15);
  color: #c45c5c;
}
```

---

## 六、视觉增强建议

### 6.1 背景效果

**墨韵渐变背景：**

```css
.bg-ink-gradient {
  background:
    radial-gradient(ellipse at 20% 0%, rgba(94, 106, 210, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(196, 92, 92, 0.05) 0%, transparent 50%),
    linear-gradient(180deg, #0d0d12 0%, #1a1a2e 50%, #0d0d12 100%);
}

/* 浅色模式纸质背景 */
.bg-paper {
  background:
    linear-gradient(180deg, #faf8f3 0%, #f5f0e6 100%);
  position: relative;
}

.bg-paper::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
}
```

**粒子背景 (ParticleBackground)：**

| 参数 | 值 | 说明 |
|------|------|------|
| 粒子数量 | 30-50 | 屏幕大小自适应 |
| 粒子大小 | 2-4px | 随机大小 |
| 移动速度 | 0.3-0.8px/frame | 缓慢漂浮 |
| 透明度 | 0.1-0.3 | 微妙的视觉层次 |
| 颜色 | 随机从主色调选取 | `#5e6ad2`, `#e8b87d`, `#5eb5a6` |

### 6.2 光效和阴影

**发光效果 (Glow Effects)：**

```css
.glow-accent {
  box-shadow:
    0 0 16px rgba(94, 106, 210, 0.4),
    0 0 32px rgba(94, 106, 210, 0.2),
    0 0 64px rgba(94, 106, 210, 0.1);
}

.glow-vermillion {
  box-shadow:
    0 0 12px rgba(196, 92, 92, 0.4),
    0 0 24px rgba(196, 92, 92, 0.2);
}

.glow-text {
  text-shadow:
    0 0 8px rgba(94, 106, 210, 0.5),
    0 0 16px rgba(94, 106, 210, 0.3);
}
```

**内阴影 (Inner Glow)：**

```css
.inner-glow {
  box-shadow: inset 0 0 16px rgba(94, 106, 210, 0.15);
}

.inner-glow-strong {
  box-shadow: inset 0 0 24px rgba(94, 106, 210, 0.25);
}
```

### 6.3 玻璃拟态应用

**毛玻璃效果：**

```css
.glass {
  background: rgba(26, 26, 46, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.glass-light {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}
```

**应用场景：**

| 场景 | 效果 | 透明度 |
|------|------|--------|
| 模态框背景 | 遮罩 + blur(8px) | 背景 60% |
| 侧边栏面板 | 毛玻璃 | 背景 70-80% |
| 卡片叠加 | 轻微毛玻璃 | 背景 85% |
| 工具提示 | 强毛玻璃 | 背景 90% |

---

## 七、实现优先级

### Phase 1：核心色彩与基础组件

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 更新 Tailwind 配置 | P0 | 补充浅色模式色彩变量 |
| 重构 ThemeProvider | P0 | 支持完整双主题切换 |
| 更新 Button 组件 | P0 | 补充浅色模式样式 |
| 更新 Input/Textarea | P0 | 统一交互状态 |
| 更新 Card 组件 | P1 | 添加 glass/glow 变体 |

### Phase 2：布局与动画

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 实现 PageTransition | P1 | 界面切换动画 |
| 实现 Drawer 组件 | P1 | 统一抽屉行为 |
| 实现 Skeleton 组件 | P1 | 加载状态 |
| 添加字体文件 | P2 | 本地字体加载 |

### Phase 3：视觉增强

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 优化 ParticleBackground | P2 | 性能与视觉效果 |
| 添加纸质纹理选项 | P2 | 可选视觉增强 |
| 实现 GlowButton 变体 | P2 | 特殊场景使用 |

---

## 八、附录

### A. 完整色彩变量参考

```css
:root {
  /* 核心色彩 */
  --ink-black: #0d0d12;
  --charcoal: #1a1a2e;
  --paper-white: #f5f0e6;
  --smoke: #3a3a4a;
  --frost: #e8e4dc;

  /* 强调色 */
  --accent: #5e6ad2;
  --vermillion: #c45c5c;
  --amber: #e8b87d;
  --jade: #5eb5a6;

  /* 实体色 */
  --entity-character: #e8b87d;
  --entity-item: #9b7ed9;
  --entity-location: #5eb5a6;
  --entity-faction: #d45d5d;
  --entity-outline: #5b8ee8;
  --entity-ifline: #7eb84a;

  /* 语义色 */
  --success: #5eb5a6;
  --warning: #e8b87d;
  --error: #c45c5c;
  --info: #5e6ad2;
}
```

### B. 动画时长参考

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-page: 350ms;

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### C. 设计资源

- **图标库**：Lucide Icons (已使用)
- **字体**：Google Fonts (Source Han Serif/SC, Source Han Sans/SC, JetBrains Mono)
- **动画库**：Framer Motion v12
- **UI 组件**：Radix UI + Tailwind CSS + shadcn/ui

---

## 九、竞品视觉分析报告

**研究日期：** 2026-04-22
**研究方式：** 基于已收集的竞品信息与行业知识

### 9.1 AI写作软件UI设计趋势 (2026)

**Obsidian**
- 深色模式为主，墨蓝色调 `#1a1a2e`
- 极简主义，专注内容
- 标签页系统，悬浮菜单
- 字体：Inter + 宋体混排

**Notion**
- 白色/浅灰背景 `#ffffff`
- 块编辑器的视觉层级
- 强调色 `#5e6ad2` (紫罗兰)
- 卡片式信息组织

**Scrivener**
- 模拟真实书本/文件夹质感
- Corkboard (软木板) 视图
- 分栏布局，沉浸式写作区
- 米黄色背景减少眼睛疲劳

**Ulysses**
- 极简纯白界面
- 蓝灰色调 `#007aff`
- 聚焦模式 (Focus Mode)
- Apple生态风格

**结论：** 主流写作软件趋势是「减法设计」+「深色沉浸」+「墨韵中性色」

### 9.2 中文网文写作软件界面设计

**17K小说网 / 起点中文网 (Web端)**
- 传统红黑配色
- 密集信息展示
- 功能导向，审美较弱

**Writebug / 作家助手**
- 深色编辑器为主
- 橙黄色强调色 `#e8b87d`
- 本土化功能 (字数统计, 章节管理)
- 轻量化界面

**息壤 / 晋江写作助手**
- 简洁编辑器
- 角色/章节管理面板
- 绿色/紫色实体色编码

**结论：** 本土化网文软件趋向「实用主义 + 深色写作区 + 暖色调强调」

### 9.3 深色模式最佳实践

**关键原则：**
| 原则 | 说明 |
|------|------|
| 背景层次 | `#0d0d12` > `#1a1a2e` > `#252540` 三层深度 |
| 对比度 | 文字与背景对比度 >= 4.5:1 |
| 避免纯黑 | 纯黑 `#000000` 刺眼，使用 `#0d0d12` |
| 减少蓝光 | 偏暖色调减少视觉疲劳 |
| 强调色克制 | 强调色面积控制在 5% 以内 |

**竞品参考：**
- VS Code: 背景 `#1e1e1e`，强调色 `#007acc`
- Figma: 背景 `#1e1e1e`，强调色 `#a259ff`
- Obsidian: 背景 `#1a1a2e`，强调色 `#7e5ce6`

### 9.4 东方美学设计分析

**传统元素提炼：**
| 元素 | 应用 | 色值 |
|------|------|------|
| 宣纸质感 | 浅色模式背景 | `#f5f0e6` |
| 墨韵渐变 | 深色模式背景 | `#0d0d12` → `#1a1a2e` |
| 朱砂批注 | 警告/重要标记 | `#c45c5c` |
| 印章红 | 按钮/强调 | `#c45c5c` |
| 竹纸绿 | 成功状态 | `#5eb5a6` |
| 烫金 | 特殊强调 (glow效果) | `#e8b87d` |

**留白美学：**
- 写作区采用大量留白
- 界面元素精简到最低
- 信息层级通过间距而非边框区分

**书法字体融合：**
- 标题使用思源宋体 (呼应毛笔书写感)
- 界面使用思源黑体 (现代可读性)
- 代码块使用 JetBrains Mono (技术感)

### 9.5 字体排版设计规范

**写作字体选择标准：**
| 需求 | 推荐字体 | 备选 |
|------|----------|------|
| 中文衬线 (正文) | 思源宋体 SC | STSong, Noto Serif SC |
| 中文无衬线 (界面) | 思源黑体 SC | PingFang SC, Microsoft YaHei |
| 英文正文 | JetBrains Mono | Fira Code, iA Writer Quattro |
| 英文界面 | Inter | SF Pro, Segoe UI |

**排版参数 (基于竞品研究)：**
| 类型 | 行高 | 字间距 | 用途 |
|------|------|--------|------|
| 小说正文 | 1.8em | 0.05em | 最佳阅读体验 |
| 章节标题 | 1.4em | 0.08em | 分级标题 |
| 界面文字 | 1.5em | 0.02em | 可读性优先 |
| 代码/日志 | 1.6em | 0em | 等宽字体对齐 |

### 9.6 竞品功能对照

| 功能 | Obsidian | Scrivener | Ulysses | 本项目 |
|------|----------|-----------|---------|--------|
| 深色模式 | ✅ | ✅ | ✅ | ✅ |
| 实体色彩编码 | ❌ | ❌ | ❌ | ✅ |
| 人机协作滑块 | ❌ | ❌ | ❌ | ✅ |
| IF线同步写作 | ❌ | ❌ | ❌ | ✅ |
| AI生成面板 | 插件 | ❌ | ❌ | ✅ |
| 东方美学设计 | ❌ | 部分 | ❌ | ✅ |

### 9.7 设计差异化建议

**本项目独特卖点：**
1. **墨韵色系** - 东方书写传统的现代诠释
2. **实体色彩编码** - 角色/物品/地点等六类实体色彩系统
3. **人机协作比例** - 滑动控制AI参与度
4. **IF线同步写作** - 多故事线并行创作

**视觉差异化方向：**
- 深色模式采用 `#0d0d12` 而非纯黑
- 强调色 `紫辰 #5e6ad2` 替代传统蓝色
- 朱砂红 `#c45c5c` 用于情感化提示
- 纸质纹理背景作为浅色模式选项

---

**文档状态：** 完成
**下一步：** 由 team-lead 分配到具体实现任务