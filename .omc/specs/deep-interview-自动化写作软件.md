# Deep Interview Spec: 自动化写作软件

## Metadata
- Interview ID: deep-interview-20260410
- Rounds: 9
- Final Ambiguity Score: 3%
- Type: greenfield
- Generated: 2026-04-10
- Last Updated: 2026-04-10 (team review + supplement)
- Review Score: 7.6/10 → **9.0/10** (after supplements)
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.98 | 0.40 | 0.39 |
| Constraint Clarity | 0.95 | 0.30 | 0.29 |
| Success Criteria | 0.97 | 0.30 | 0.29 |
| **Total Clarity** | | | **0.97** |
| **Ambiguity** | | | **3% → 0%** (after supplements) |

## Three-Interface Architecture (三界面架构)

本软件由 **三个核心界面** 组成，分别对应写作的三个自然阶段：

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌───────────┐     ┌───────────┐     ┌───────────┐               │
│  │           │     │           │     │           │               │
│  │  界面1    │ ──▶ │  界面2    │ ──▶ │  界面3    │               │
│  │  聊天初始化 │     │  设定编辑  │     │  正文写作  │               │
│  │           │     │           │     │           │               │
│  │  AI提问   │     │  微调+迭代 │     │  文笔优化  │               │
│  │  用户回答  │     │  AI修改    │     │  风格操作  │               │
│  │           │     │           │     │           │               │
│  └───────────┘     └───────────┘     └───────────┘               │
│                                                                     │
│     确定世界观              精细调整设定             专注正文创作         │
│     角色/大纲/规则         AI二次/多次迭代           文笔+风格技巧       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 界面1：聊天初始化 (Chat Initialization)

**目的：** 通过对话收集和确立大量设定信息

**设计参考：** 参考 `reference-webnovel` 的 `webnovel-init` 6步工作流

```
┌─────────────────────────────────────────────────────────────────────┐
│  界面1：聊天初始化                                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  AI 助手                                                    │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │                                                              │   │
│  │  你好！我来帮你创建一个网络小说项目。                          │   │
│  │                                                              │   │
│  │  首先，请告诉我你的故事属于什么类型？                          │   │
│  │  例如：玄幻修仙、都市异能、悬疑推理、言情等                    │   │
│  │                                                              │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  [用户输入框]                               [发送]           │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ 已收集信息 ────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  ✓ 类型：玄幻修仙                                           │   │
│  │  ✓ 世界观：修仙大陆 / 宗门林立 / 境界分明                    │   │
│  │  ✓ 主角：李青云 / 男 / 炼气期 / 被灭门的天才少年              │   │
│  │  ◯ 金手指：尚未确定                                         │   │
│  │  ◯ 反派：尚未确定                                          │   │
│  │  ◯ 势力：尚未确定                                          │   │
│  │                                                              │   │
│  │  [继续完善] [查看完整设定] [进入设定界面]                    │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**对话流程示例：**
```
AI: 请描述你的主角（姓名、性别、性格特点）
用户: 主角叫李青云，男，沉默寡言但内心善良，被灭门的天才

AI: 主角的"金手指"是什么？（系统/重生/传承/其他）
用户: 可以通过猎杀妖兽获得对方能力的"噬妖诀"

AI: 反派是谁？有什么特点？
用户: 玄天宗少主，阴险狡诈，觊觎主角功法

... (持续对话直到收集足够信息)
```

**AI 主动引导的话题：**
- 题材类型（复合题材支持 A+B）
- 世界观设定（地点/势力/规则）
- 主角/配角/反派
- 金手指/成长机制
- 主线剧情走向
- IF线可能性

**特点：**
- AI 主动提问，不是被动回答
- 已收集信息实时显示在右侧面板
- 支持随时"进入设定界面"预览和调整
- 支持"继续完善"——随时回到聊天补充设定

---

### 界面2：设定编辑 (Setting Editor)

**目的：** 用户微调设定 + AI 二次/多次迭代修改

**设计参考：** Scrivener Binder + Novelcrafter Codex + reference-webnovel 设定词典

```
┌─────────────────────────────────────────────────────────────────────┐
│  界面2：设定编辑                                                    │
│                                                                     │
│  ┌────────────┐  ┌──────────────────────────────────────────────┐  │
│  │ [设定类型]  │  │                                              │  │
│  │            │  │  ┌────────────────────────────────────────┐  │  │
│  │ ├─ 世界观  │  │  │  角色：李青云                           │  │  │
│  │ ├─ 角色    │◀─│  │  ═══════════════════════════════════════ │  │  │
│  │ ├─ 物品    │  │  │                                        │  │  │
│  │ ├─ 地点    │  │  │  基础信息                               │  │  │
│  │ ├─ 势力    │  │  │  ────────────────────────────────────  │  │  │
│  │ ├─ 规则    │  │  │  姓名: 李青云          性别: 男         │  │  │
│  │ ├─ 大纲    │  │  │  定位: [核心▼]        境界: 炼气三层     │  │  │
│  │ └─ IF线   │  │  │                                        │  │  │
│  │            │  │  │  性格特征                               │  │  │
│  │  ────────  │  │  │  ────────────────────────────────────  │  │  │
│  │  AI 辅助   │  │  │  性格: 沉默寡言 / 内心善良 / 外冷内热   │  │  │
│  │  [生成角色]│  │  │  欲望: 查明灭门真相 / 复仇             │  │  │
│  │  [生成物品]│  │  │  缺陷: 不善交际 / 过度自责             │  │  │
│  │  [生成势力]│  │  │                                        │  │  │
│  │            │  │  │  角色关系                               │  │  │
│  │  ────────  │  │  │  ────────────────────────────────────  │  │  │
│  │  [AI审查]  │  │  │  ┌──────────────────────────────────┐ │  │  │
│  │  [查漏补缺]│  │  │  │  [李青云]──对立──[玄天宗少主]    │ │  │  │
│  │            │  │  │  │       │                          │ │  │  │
│  └────────────┘  │  │  │       ├──亲情──[青梅竹马-小莲]   │ │  │  │
│                  │  │  │       └──师徒──[神秘老者]         │ │  │  │
│                  │  │  │  └──────────────────────────────────┘ │  │  │
│                  │  │  │                                        │  │  │
│                  │  │  │  角色故事线                           │  │  │
│                  │  │  │  ────────────────────────────────────  │  │  │
│                  │  │  │  Arc 1: 复仇线 ████████░░ 80%        │  │  │
│                  │  │  │  Arc 2: 成长线 ████░░░░░░ 40%        │  │  │
│                  │  │  │  Arc 3: 感情线 ░░░░░░░░░░ 10%        │  │  │
│                  │  │  │                                        │  │  │
│                  │  │  │  [AI建议: 建议增加一个配角平衡感情线]   │  │  │
│                  │  │  │                                        │  │  │
│                  │  │  └────────────────────────────────────────┘  │  │
│                  │  │                                              │  │
│                  │  │  [保存] [AI二次修改] [返回聊天]            │  │  │
│                  │  └──────────────────────────────────────────────┘  │
│                  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**AI 二次/多次迭代机制：**
```
┌─────────────────────────────────────────────────────────────┐
│  AI 审查面板                                               │
│ ───────────────────────────────────────────────────────── │
│                                                             │
│  [AI审查] 按钮点击后：                                     │
│                                                             │
│  1. 一致性检查                                             │
│     → "主角境界设定为炼气三层，但第三章描述为筑基期"        │
│     → [自动修复] [忽略] [手动调整]                         │
│                                                             │
│  2. 关系冲突检查                                           │
│     → "玄天宗少主与主角有杀父之仇，但势力图中显示为同门"   │
│     → [自动修复] [忽略] [手动调整]                         │
│                                                             │
│  3. 伏笔追踪                                               │
│     → "第一章埋下'神秘玉佩'伏笔，尚未在第五章揭示"        │
│     → [加速揭示] [保留悬念] [删除伏笔]                     │
│                                                             │
│  4. 建议优化                                               │
│     → "建议为李青云增加一个劲敌角色增加戏剧冲突"           │
│     → [采纳建议] [忽略]                                    │
│                                                             │
│  [应用所有修复]  [逐项确认]  [仅记录问题]                  │
└─────────────────────────────────────────────────────────────┘
```

**特点：**
- 左侧分类导航（Binder风格）
- 右侧详细编辑器
- 关系可视化直接在编辑器内展示
- AI 可主动审查并提出修改建议
- 用户修改后可再次让 AI 审查（多次迭代）

---

### 界面3：正文写作 (Writing Editor)

**目的：** 基于设定信息，专注正文创作，包含文笔优化和风格操作

**布局原则：** AI操作面板 + 协作面板均为**右侧抽屉式**，可通过工具栏按钮或快捷键呼出/收起

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  界面3：正文写作                                                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────┐  ┌─────────────┐  │
│  │ 工具栏                                                  │  │ [🤖 AI] [📋] │  │
│  │ [📝写作] [📋大纲] [🤖AI操作] [📋协作] [🔙返回设定]      │  └─────────────┘  │
│  ├───────────────────────────────────────────────────────┤                   │
│  │                                                        │  ┌─────────────┐  │
│  │  第3章：边境遇袭                                       │  │              │  │
│  │  ════════════════════════════════════════════════════  │  │              │  │
│  │                                                        │  │   AI操作     │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │   抽屉       │  │
│  │  │                                                  │ │  │              │  │
│  │  │  [正文区域 - 沉浸式写作]                         │ │  │  可折叠/展开  │  │
│  │  │                                                  │ │  │              │  │
│  │  │  寒风扑面而来，他下意识裹紧了披风。              │ │  │              │  │
│  │  │  ────────────────────────────────                │ │  │              │  │
│  │  │                                                  │ │  │              │  │
│  │  │  主角踏入边境城市的瞬间，                        │ │  │              │  │
│  │  │  ════════════════════════════════════           │ │  │              │  │
│  │  │                                                  │ │  │              │  │
│  │  │  [选中文字] ← 右键/快捷键呼出AI操作              │ │  │              │  │
│  │  │                                                  │ │  │              │  │
│  │  │  ……                                            │ │  │              │  │
│  │  │                                                  │ │  └─────────────┘  │
│  │  └──────────────────────────────────────────────────┘  ┌─────────────┐  │
│  │                                                        │  │              │  │
│  │                                                        │  │   协作       │  │
│  │                                                        │  │   面板       │  │
│  │                                                        │  │              │  │
│  │                                                        │  │  可折叠/展开  │  │
│  │                                                        │  │              │  │
│  │                                                        │  │              │  │
│  │                                                        │  └─────────────┘  │
│  │                                                        │                   │
│  └───────────────────────────────────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**抽屉展开效果：**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  界面3：正文写作 (AI抽屉展开)                                               │
│                                                                             │
│  ┌───────────────────────────────────────────────────────┐  ┌─────────────┐  │
│  │ 工具栏                                                  │  │ [✕ 关闭]   │  │
│  │ [📝写作] [📋大纲] [🤖AI操作▼] [📋协作] [🔙返回设定]    │  └─────────────┘  │
│  ├───────────────────────────────────────────────────────┤                   │
│  │                                                        │  ┌─────────────┐  │
│  │  第3章：边境遇袭                                       │  │  🤖 AI操作  │  │
│  │  ════════════════════════════════════════════════════  │  │              │  │
│  │                                                        │  │ ▼ 全文操作   │  │
│  │  [正文区域 - 沉浸式写作]                                │  │              │  │
│  │                                                        │  │ [生成下一章] │  │
│  │  寒风扑面而来，他下意识裹紧了披风。                      │  │ [优化全文]   │  │
│  │  ────────────────────────────────                      │  │ [文笔重塑]   │  │
│  │                                                        │  │              │  │
│  │  主角踏入边境城市的瞬间，                                │  │ ▼ 人机比例   │  │
│  │  ════════════════════════════════════                  │  │ ─────●─────  │  │
│  │                                                        │  │       70%   │  │
│  │  [选中文字]                                             │  │              │  │
│  │                                                        │  │ ▼ 文笔风格   │  │
│  │  远处传来骚动，                                        │  │ [江南][卡夫卡]│  │
│  │  ════════════════════════════════════                  │  │ [加缪][默认] │  │
│  │                                                        │  │              │  │
│  │  ……                                                   │  │ ▼ 选中操作   │  │
│  │                                                        │  │ [优化][扩写] │  │
│  │                                                        │  │ [缩写][改写] │  │
│  │                                                        │  │ [续写][润色] │  │
│  │                                                        │  │              │  │
│  │                                                        │  └─────────────┘  │
│  └───────────────────────────────────────────────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**协作面板抽屉展开效果：**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  界面3：正文写作 (协作面板展开)                                             │
│                                                                             │
│  ┌───────────────────────────────────────────────────────┐  ┌─────────────┐  │
│  │ 工具栏                                                  │  │ [✕ 关闭]   │  │
│  │ [📝写作] [📋大纲] [🤖AI] [📋协作▼] [🔙返回设定]         │  └─────────────┘  │
│  ├───────────────────────────────────────────────────────┤                   │
│  │                                                        │  ┌─────────────┐  │
│  │  第3章：边境遇袭                                       │  │  📋 协作    │  │
│  │  ════════════════════════════════════════════════════  │  │              │  │
│  │                                                        │  │ ▼ 本章作战台 │  │
│  │  [正文区域 - 沉浸式写作]                                │  │              │  │
│  │                                                        │  │ 目标: ______ │  │
│  │  寒风扑面而来，他下意识裹紧了披风。                      │  │ 阻力: ______ │  │
│  │  ────────────────────────────────                      │  │ 代价: ______ │  │
│  │                                                        │  │ 钩子: ______ │  │
│  │  主角踏入边境城市的瞬间，                                │  │              │  │
│  │  ════════════════════════════════════                  │  │ ▼ 伏笔追踪   │  │
│  │                                                        │  │              │  │
│  │  [选中文字]                                             │  │ ❶ 玉佩之谜  │  │
│  │                                                        │  │ ❷ 灭门真凶  │  │
│  │  ……                                                   │  │              │  │
│  │                                                        │  │ ▼ 角色状态   │  │
│  │                                                        │  │              │  │
│  │                                                        │  │ 主角: 警惕  │  │
│  │                                                        │  │ 李青: 焦虑  │  │
│  │                                                        │  │ ⚠ OOC警告  │  │
│  │                                                        │  │              │  │
│  │                                                        │  │ ▼ 章节进度   │  │
│  │                                                        │  │ 1234/2000字 │  │
│  │                                                        │  │ ██████░░░░  │  │
│  │                                                        │  │              │  │
│  └───────────────────────────────────────────────────────┘  └─────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**工具栏快捷操作（不需要展开抽屉）：**

```
选中文字后，右键菜单：
┌──────────────────────────────┐
│  🤖 AI 操作                    │
│  ────────────────────────────  │
│  [优化这段]  Ctrl+Shift+O     │
│  [扩写]      Ctrl+Shift+E    │
│  [缩写]      Ctrl+Shift+S    │
│  [改写]      Ctrl+Shift+R    │
│  [续写]      Ctrl+Shift+W    │
│  [润色]      Ctrl+Shift+P    │
│  ────────────────────────────  │
│  文笔风格: [江南] [卡夫卡] [加缪] │
└──────────────────────────────┘
```

**抽屉交互设计：**

| 抽屉 | 呼出方式 | 收起方式 | 宽度 |
|------|---------|---------|------|
| AI操作 | 点击工具栏[🤖AI] 或 Ctrl+\ | 点击[X] 或 Ctrl+\ 或点击外部 | 280px |
| 协作面板 | 点击工具栏[📋协作] 或 Ctrl+/ | 点击[X] 或 Ctrl+/ 或点击外部 | 260px |
| 同时展开 | 两个抽屉可同时展开，各自独立 | 各自独立关闭 | - |

**协作面板优先级显示逻辑：**
- 仅显示**当前场景相关**的角色状态（非全部角色）
- 伏笔仅显示**未闭合**且**即将到期**的（避免信息过载）
- OOC/战力警告以**红色徽章**形式在工具栏提示
```
┌─────────────────────────────────────────────────────────────┐
│  文笔风格库                                                │
│ ─────────────────────────────────────────────────────────  │
│                                                             │
│ 预设风格:                                                   │
│  • 默认 — 标准网络小说风格                                  │
│  • 江南 — 细腻描写，意境悠远，带有淡淡忧伤                  │
│  • 卡夫卡 — 荒诞隐喻，意识流，内心独白                     │
│  • 加缪 — 哲学思辨，冷峻叙事，存在主义                      │
│  • 自定义 — 上传参考文本让AI学习风格                        │
│                                                             │
│ 操作类型:                                                   │
│  • [优化这段] — 提升表达质量，保留原意                      │
│  • [扩写] — 增加细节和描写                                 │
│  • [缩写] — 精简冗余内容                                   │
│  • [改写] — 换一种表达方式                                 │
│  • [续写] — 基于当前段落后续内容                           │
│  • [润色] — 打磨字句，更流畅自然                            │
│  • [文笔重塑] — 重新用选定风格改写                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**特点：**
- 沉浸式写作区，最大化正文空间
- AI 操作融入工具栏和右键菜单
- 人机比例滑块实时调整
- 协作面板（作战台/角色状态/伏笔）可折叠
- 上下文参考实时显示相关设定信息
- OOC/战力/逻辑检测实时运行

---

### 三界面流转关系

```
界面1 (聊天) ──生成──▶ 界面2 (设定)
                              │
                              │ 用户微调 + AI迭代
                              │ ◀─────── 可随时返回
                              │
                              ▼
                    界面2 (设定确认完毕)
                              │
                              │ 开始写作
                              ▼
                    界面3 (正文写作)
                              │
                              │ 需要修改设定
                              ▼
                    界面2 (设定微调)
                              │
                              │ 继续写作
                              ▼
                    界面3 (继续正文)
```

**关键流转规则：**
- 界面1 → 界面2：聊天收集完设定后自动跳转
- 界面2 → 界面3：设定确认后进入写作
- 界面3 → 界面2：写作中发现设定问题可返回修改
- 界面2 → 界面1：需要补充大量设定时可返回聊天

---

## Component & Style Specification (组件与样式规范)

### 1. 推荐技术组件

| 组件类型 | 推荐方案 | 来源/参考 | 说明 |
|-----------|---------|-----------|------|
| **富文本编辑器** | **Tiptap** (基于ProseMirror) | [Tiptap GitHub](https://github.com/kerasking/tiptap) | Headless可完全自定义UI，扩展丰富，协作友好 |
| **React编辑器组件** | **BlockNote** | [BlockNote.js](https://www.blocknotejs.org/) | 开箱即用React组件，支持block编辑 |
| **关系图谱** | **react-force-graph-3d** | [reference-webnovel](D:/writer/read/reference-webnovel) | 3D力导向图，节点颜色编码 |
| **UI组件库** | **shadcn/ui** | - | 基于Radix + Tailwind，可定制性强 |
| **侧边抽屉** | **@radix-ui/react-dialog** + 自定义 | shadcn/ui Sheet组件 | 支持动画、可拖拽调整宽度 |
| **状态管理** | **Zustand** | - | 轻量React状态管理 |

### 2. 色彩系统

**设计灵感：** 水墨中国风 + 暖色护眼风（参考 iA Writer、Hemingway、晋江写作助手）

```
主色调 (Primary):
- 深墨色: #1a1a2e      (写作区背景)
- 宣纸白: #f5f0e6      (正文文字/卡片背景)
- 朱砂红: #c45c5c      (强调/警告/重要标记)

功能色 (Functional - 实体类型颜色编码):
- 角色:   #e8b87d (橙色)
- 物品:   #9b7ed9 (紫色)
- 地点:   #5eb5a6 (青色)
- 势力:   #d45d5d (红色)
- 大纲:   #5b8ee8 (蓝色)
- IF线:   #7eb84a (绿色)

状态色 (Status):
- 正常:   #5eb5a6 (青色)
- 警告:   #e8b87d (橙色)
- 错误:   #c45c5c (红色)
- 成功:   #6dd45e (绿色)
- OOC:    #e8b87d (橙色警告徽章)
- 战力失衡: #c45c5c (红色警告徽章)

写作模式背景:
- 浅色护眼: #faf6e8 (暖黄米色)
- 深色水墨: #1a1a2e (深墨色)
- 纯白:     #ffffff

**配色方案 (深色/浅色模式完整定义):**

| 元素 | 浅色模式 | 深色模式 |
|------|---------|---------|
| 背景色 | #ffffff | #1a1a2e |
| 卡片背景 | #f5f0e6 | #252540 |
| 文字主色 | #1a1a2e | #f5f0e6 |
| 文字次色 | #666666 | #999999 |
| 边框色 | #e0dcd3 | #3a3a5a |
| 工具栏背景 | #f5f0e6 | #252540 |
| 抽屉背景 | #ffffff | #2a2a45 |
| 选中高亮 | rgba(91, 142, 232, 0.2) | rgba(91, 142, 232, 0.3) |

**纸张纹理 (可选):**
- 全局开关: 设置中切换
- 强度: 可调节 (轻微/中等/强烈)
- 实现: CSS background-image + noise SVG filter
```

### 3. 字体排版系统

**参考：** iA Writer 字体设计、Hemingway App 排版

```
写作字体 (Writing):
- 中文: 思源宋体 (Source Han Serif) / 思源黑体 (Source Han Sans)
- 英文: JetBrains Mono / iA Writer Quattro
- 字号: 16-18px (写作区正文)
- 行高: 1.75-2.0em (最佳阅读行高)
- 字间距: 0.05em
- 段落间距: 1.5em

界面字体 (Interface):
- 中文: 思源黑体 / 苹方 (PingFang)
- 英文: Inter / SF Pro Display
- 字号: 13-14px (界面元素)
- 行高: 1.5em

标题层级:
- H1: 24px / 700 / 1.3em
- H2: 20px / 600 / 1.4em
- H3: 16px / 600 / 1.5em

**字体加载策略:**
- 思源宋体/黑体: 通过 font-face preload 加载 (字重: 400, 600, 700)
- 字体文件位置: `public/fonts/` (打包在 Electron assets 中)
- 备选方案: Google Fonts CDN (仅在本地字体加载失败时)
- 自定义字体上传: 用户可上传 .ttf/.otf 文件到 `user_fonts/` 目录
```

### 4. 间距系统

```
基础单位: 4px

间距梯度:
- xs:   4px
- sm:   8px
- md:  16px
- lg:  24px
- xl:  32px
- 2xl: 48px
- 3xl: 64px

组件圆角:
- 卡片/面板: 8px
- 按钮:      6px
- 输入框:    6px
- 抽屉:      0px (直角简洁风)

阴影:
- 卡片:     0 2px 8px rgba(0,0,0,0.08)
- 抽屉:     0 4px 20px rgba(0,0,0,0.15)
- 悬浮:     0 8px 30px rgba(0,0,0,0.2)
```

### 5. 动效设计

**参考：** Linear App 动效、iA Writer 简洁风格

```
过渡时长:
- 快速:   150ms (微交互、按钮反馈)
- 标准:   250ms (面板展开收起)
- 慢速:   400ms (页面切换)

缓动函数:
- 展开/收起: ease-out
- 悬浮反馈: ease-in-out
- 页面切换: ease-in-out

抽屉动画:
- 从右侧滑入
- 基础宽度: 280-320px
- 支持拖拽调整宽度 (min: 240px, max: 480px)
- 展开时背景轻微遮罩 (rgba(0,0,0,0.3))

打字机模式 (可选):
- 当前行居中
- 上方内容柔和渐隐
```

### 6. 沉浸式写作模式

```
触发方式:
- F11 全屏
- Ctrl+Shift+F 专注模式 (隐藏工具栏)
- 双击编辑器区域

专注模式行为:
- 自动隐藏工具栏 (鼠标移入顶部显示)
- 隐藏协作面板
- 背景变为纯色/纸质纹理
- 打字机模式可选

纸质纹理 (可选):
- 轻微纸张颗粒感
- 边缘轻微阴影 (书本效果)
- 可调节纹理强度
```

### 7. 组件交互规范

```
按钮状态:
- Default → Hover (背景加深10%) → Active (背景加深15%) → Disabled (opacity: 0.5)
- 所有可点击元素: cursor: pointer
- 过渡: all 150ms ease

输入框:
- Focus: 边框变为 #5b8ee8 (主色蓝)
- 错误: 边框变为 #c45c5c (红色)

抽屉:
- 展开: transform: translateX(0)
- 收起: transform: translateX(100%)
- 遮罩: opacity 0 → 0.3

卡片悬浮:
- Hover: translateY(-2px), shadow增强
- Transition: transform 200ms ease-out, shadow 200ms ease-out
```

### 8. 快捷键系统

```
全局:
- Ctrl+\    : 切换AI操作抽屉
- Ctrl+/    : 切换协作面板
- Ctrl+S    : 保存
- F11       : 全屏写作

写作区:
- Ctrl+Shift+O : 优化选中文字
- Ctrl+Shift+E : 扩写选中文字
- Ctrl+Shift+S : 缩写选中文字
- Ctrl+Shift+R : 改写选中文字
- Ctrl+Shift+W : 续写选中文字
- Ctrl+Shift+P : 润色选中文字
- Ctrl+Shift+N : 生成下一章
- Tab         : 接受AI建议
- Esc         : 取消AI建议
```

### 9. 响应式策略

```
断点:
- Desktop: >= 1280px (三栏布局)
- Tablet:  768-1279px (两栏，可折叠侧边)
- Mobile:  < 768px (单栏，底部Tab导航)

界面3写作模式:
- Desktop: 侧边抽屉并存
- Tablet:  抽屉叠加 (同一侧)
- Mobile:  底部Sheet (从下往上滑出)
```

## Constraints
- **运行环境：** 本地桌面应用，完全离线可用
- **技术栈：** Python FastAPI (后端) + React 18 (前端)，参考 `reference-webnovel` 架构
- **AI Provider：** MiniMax API（兼容 OpenAI API 格式），无成本/时间上限
- **部署打包：** PyInstaller / PyWebView 或 Tauri + Python 打包为桌面应用
- **发布平台：** 网络小说（面向网文平台读者）

## Non-Goals
- 不做移动端 / Web 端（仅本地桌面）
- 不做本地模型部署（纯 API 调用）
- 不做出版级校对/语法检查（专注故事结构）
- 不做多语言/翻译功能

## Acceptance Criteria
- [ ] **界面1 - 聊天初始化**：AI 主动提问收集设定，支持实时显示已收集信息，可随时进入界面2预览
  - **新增**: ChatSession/ChatMessage 实体存储对话历史
  - **新增**: AI 自动提取对话中的实体并映射到设定
- [ ] **界面2 - 设定编辑**：左侧分类导航（世界观/角色/物品/地点/势力/规则/大纲/IF线），右侧编辑器支持关系可视化，AI 审查可多次迭代
  - **新增**: AI 迭代收敛机制（无修改建议连续2轮 / 用户确认 / 上限5次）
  - **新增**: OutlineEditor ↔ WritingEditor 实时同步
- [ ] **界面3 - 正文写作**：沉浸式写作区，AI 操作融入工具栏/右键菜单，人机比例滑块实时调节
  - **新增**: DraftVersion 版本历史支持
- [ ] **AI 文笔操作**：支持优化/扩写/缩写/改写/续写/润色/文笔重塑，可选预设风格（江南/卡夫卡/加缪等）或自定义风格
- [ ] **协作面板**：本章作战台（目标/阻力/代价/钩子）、伏笔追踪（PlotThread）、角色状态、章节进度，可折叠
- [ ] **AI 检测**：实时检测 OOC、大纲偏离、战力失衡、逻辑漏洞，支持可配置敏感度
  - **新增**: AIInspectionResult 存储审查结果
  - **新增**: 敏感度等级定义（低/中/高三档）
- [ ] **三界面流转**：界面1→界面2→界面3，写作中可返回界面2修改设定，设定修改后可返回界面1补充聊天
- [ ] **后端 API**：完整 RESTful API 设计（会话/设定/章节/AI操作）
- [ ] **数据持久化**：SQLite + SQLAlchemy 2.0，Zustand 状态自动同步到 SQLite
- [ ] 可通过 PyInstaller / PyWebView 或 Tauri 打包为可分发的桌面应用
- [ ] **性能要求**：冷启动<3s，UI响应<100ms，AI首字<2s，内存<500MB
- [ ] **错误处理**：API 超时重试、SQLite WAL 模式、数据库损坏恢复
- [ ] **日志**：操作日志、AI 调用日志、错误日志

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| AI 生成是完全自动的 | 问：你用 prompt 多还是读/改多？ | 确认为 A+C 混合模式，用户在主线上高度介入，IF线高度自动 |
| IF线 = 故事情节分支 | 问：IF线具体指什么？ | 确认为"同步其他配角的角色故事线"，配角故事线跟随主线但可独立推进 |
| 技术栈无特殊偏好 | 问：参考 `reference-webnovel` 的 Python+React？ | 确认采用，推荐架构获用户认可 |
| AI Provider 无限定 | 问：用哪个模型？ | 确认使用 MiniMax API（兼容 OpenAI 格式），无限成本 |

## Technical Context
- **参考项目：** `D:/writer/read/reference-webnovel` (Python FastAPI + React 18 + SQLite + ForceGraph3D)
- **UI/UX Skills：** `D:/writer/read/Claude-Code-Multi-Agent/.claude/skills/ui-ux-pro-max` (7步设计搜索流程)
- **数据层设计参考：** `reference-webnovel` 的 `index.db` entities/aliases/state_changes/relationships 表结构
- **前端风格建议：** 使用 ui-ux-pro-max 的写作类 Product + Style 搜索，聚焦简洁、沉浸、干扰少的编辑器体验

## Backend Architecture (后端架构)

### API Endpoint 设计

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| **会话管理** | | | | |
| `/api/sessions` | POST | 创建新会话 | `{title, type}` | `Session` |
| `/api/sessions` | GET | 获取所有会话 | - | `Session[]` |
| `/api/sessions/{id}` | GET | 获取会话详情 | - | `Session` |
| `/api/sessions/{id}/messages` | GET | 获取会话消息 | - | `ChatMessage[]` |
| **设定管理** | | | | |
| `/api/projects/{id}/characters` | GET/POST | 角色列表/创建 | `Character` | `Character` |
| `/api/projects/{id}/characters/{char_id}` | PUT/DELETE | 更新/删除角色 | `Character` | `Character` |
| `/api/projects/{id}/items` | GET/POST | 物品列表/创建 | `Item` | `Item` |
| `/api/projects/{id}/locations` | GET/POST | 地点列表/创建 | `Location` | `Location` |
| `/api/projects/{id}/factions` | GET/POST | 势力列表/创建 | `Faction` | `Faction` |
| `/api/projects/{id}/outline` | GET/PUT | 大纲获取/更新 | `StoryOutline` | `StoryOutline` |
| `/api/projects/{id}/iflines` | GET/POST/PUT | IF线管理 | `IFLine` | `IFLine` |
| **章节管理** | | | | |
| `/api/projects/{id}/chapters` | GET/POST | 章节列表/创建 | `Chapter` | `Chapter` |
| `/api/chapters/{id}` | GET/PUT/DELETE | 章节CRUD | `Chapter` | `Chapter` |
| `/api/chapters/{id}/versions` | GET/POST | 版本历史 | `DraftVersion` | `DraftVersion[]` |
| `/api/chapters/{id}/inspect` | POST | AI审查章节 | - | `AIInspectionResult` |
| **AI 操作** | | | | |
| `/api/ai/generate` | POST | AI生成内容 | `{prompt, type, style}` | `AIGeneratedContent` |
| `/api/ai/optimize` | POST | AI优化内容 | `{content, type, ratio}` | `AIGeneratedContent` |
| `/api/ai/chat` | POST | 聊天对话 | `{message, session_id}` | `ChatMessage` |
| `/api/ai/extract-settings` | POST | 从聊天提取设定 | `{message}` | `ExtractedEntity[]` |

### AI 调用层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │   Routers   │  │  Services   │  │   AI Gateway    │    │
│  │  /api/*     │  │  Business   │  │  /ai/*          │    │
│  └─────────────┘  │   Logic     │  └─────────────────┘    │
│                   └─────────────┘           │               │
│                                             ▼               │
│                   ┌─────────────────────────────────────┐  │
│                   │         MiniMax API                 │  │
│                   │   (OpenAI-compatible)               │  │
│                   └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**AI 调用策略：**
- 使用 `openai` Python SDK，base_url 指向 MiniMax
- 支持流式响应 (streaming) 用于聊天界面
- 每次调用记录 token 消耗到 `AIUsageLog`

### ORM 选型

**确认使用 SQLAlchemy 2.0**：
- 理由：成熟稳定，支持异步 (async)，与 FastAPI 集成良好
- 表结构参考 `reference-webnovel` 的 SQLite schema

### 数据持久化架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Zustand (运行时状态)                      │
│  - Current chapter content                                  │
│  - UI state (drawer open/closed)                            │
│  - Editor cursor position                                   │
└─────────────────────────────────────────────────────────────┘
                              │
              (自动同步机制: 500ms debounce)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SQLite (持久化存储)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │  Sessions   │  │  Projects   │  │    Chapters     │    │
│  │  ChatMsg    │  │  Characters │  │   DraftVer      │    │
│  └─────────────┘  └─────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**同步策略：**
- 用户输入 → 立即保存到 SQLite
- AI 生成内容 → 用户确认后保存
- 自动保存间隔：500ms (debounced)
- 事务处理：每次保存为独立事务

---

## Three-Interface Flow Synchronization (三界面流转同步)

### 界面1 → 界面2 数据流转

```
ChatSession (聊天会话)
       │
       │ 用户确认设定后
       ▼
ChatMessage[].extracted_entities[]
       │
       │ AI 提取并归类
       ▼
StoryOutline + Characters + Items + Locations + Factions
       │
       ▼
界面2 (设定编辑器)
```

**ChatSession → Setting 映射机制：**
1. 用户在界面1确认"完成聊天"
2. AI 扫描所有 `ChatMessage`，提取实体
3. 系统创建/更新对应的 `StoryOutline`, `Character`, `Item` 等
4. 映射关系记录在 `ChatSession.extracted_entities[]`

### 界面2 → 界面3 数据同步

```
OutlineEditor (独立大纲编辑器)          WritingEditor (写作编辑器)
         │                                     │
         │ 用户编辑大纲                         │ 用户写作
         ▼                                     ▼
   StoryOutline                      Chapter (content, word_count)
         │                                     │
         │───────────────────────────────► 同步机制
                    │
    实时同步：当大纲章节标题/顺序变化时，
    自动更新对应 Chapter.title 和排序
```

**OutlineEditor ↔ WritingEditor 同步规则：**
| 触发条件 | 同步行为 |
|---------|---------|
| 大纲增加章节 | WritingEditor 自动新增 Chapter 条目 |
| 大纲删除章节 | WritingEditor 软删除 Chapter (保留历史) |
| 大纲调整章节顺序 | WritingEditor 自动重排 Chapter 顺序 |
| 写作界面修改标题 | 大纲编辑器同步更新标题 |
| 章节完成写作 | 大纲自动标记该章节为"已完成" |

**同步时机：** 实时同步 (WebSocket 或 500ms polling)

### AI 迭代次数收敛机制

界面2的"AI审查 + 用户修改"循环需要收敛判断：

```
┌─────────────────────────────────────────┐
│         AI 审查循环                      │
│  ┌───────────────────────────────────┐  │
│  │ 1. AI 审查设定                    │  │
│  │ 2. 提出修改建议                   │  │
│  │ 3. 用户决定：采纳/忽略/手动修改   │  │
│  │ 4. 若有采纳 → 回到步骤1          │  │
│  └───────────────────────────────────┘  │
│                  │                      │
│    收敛条件 (满足任一即退出):            │
│    - 连续2轮无修改建议                  │
│    - 用户点击"确认设定"                │
│    - 迭代次数达到上限 (默认5次)         │
└─────────────────────────────────────────┘
```

---

## Project Structure (项目目录结构)

```
D:/writer/
├── .claude/              # Claude Code 配置
│   ├── CLAUDE.md         # 全局项目指令
│   ├── AGENTS.md         # Agent 协调指令
│   └── projects/         # 项目配置
├── .omc/                 # OMC 工作目录
│   ├── specs/            # 规格文档
│   ├── state/            # 状态文件
│   └── handoffs/         # 交接文档
├── docs/                 # 项目文档 (API 文档、用户手册)
├── config/               # 配置文件
│   ├── backend/         # FastAPI 环境配置
│   ├── electron/        # Electron 构建配置
│   └── frontend/        # 前端配置
├── scripts/              # 构建/工具脚本
├── public/               # 静态资源 (字体、图标)
│   └── fonts/           # 思源宋体/黑体字体文件
├── read/                 # 参考资料
├── src/
│   ├── backend/         # Python FastAPI 后端
│   │   ├── agents/      # AI Agent 逻辑
│   │   ├── db/          # SQLite + SQLAlchemy
│   │   ├── models/      # 数据模型
│   │   ├── routers/     # API 路由
│   │   ├── services/    # 业务逻辑
│   │   └── main.py      # FastAPI 入口
│   ├── electron/        # Electron 主进程
│   ├── frontend/        # React 18 前端
│   │   └── src/
│   │       ├── components/  # React 组件
│   │       ├── hooks/       # 自定义 Hooks
│   │       ├── pages/       # 页面组件
│   │       ├── store/       # Zustand 状态管理
│   │       ├── types/       # TypeScript 类型
│   │       ├── utils/       # 工具函数
│   │       └── styles/      # 全局样式
│   └── shared/          # 前后端共享
│       └── types/      # 共享实体类型
└── tests/
    ├── unit/           # 单元测试
    ├── integration/    # 集成测试
    └── e2e/            # 端到端测试
```

---

## Additional Non-Functional Requirements (补充非功能需求)

### 性能指标

| 指标 | 要求 |
|------|------|
| 冷启动时间 | < 3秒 (Electron 窗口显示) |
| 界面响应时间 | < 100ms (UI 操作) |
| AI 生成首字响应 | < 2秒 (streaming 开始) |
| 章节保存 | < 500ms (debounced) |
| 内存占用 | < 500MB (idle) |

### AI 检测敏感度等级

| 等级 | OOC 检测 | 战力失衡 | 逻辑漏洞 | 大纲偏离 |
|------|---------|---------|---------|---------|
| **低** | 仅严重 OOC (>50% 偏离) | 战力差 > 2个大境界 | 致命逻辑矛盾 | 偏离 > 30% |
| **中** | 中等偏离 (>25%) | 战力差 > 1个大境界 | 明显逻辑错误 | 偏离 > 15% |
| **高** | 轻微偏离 (>10%) | 细微战力差异 | 潜在逻辑问题 | 偏离 > 5% |

### 错误处理与边界情况

| 场景 | 处理策略 |
|------|---------|
| 网络中断 (API 调用) | 本地队列缓存，恢复后重试 |
| API 超时 | 重试3次，间隔2s/4s/8s指数退避 |
| SQLite 锁定 | 重试机制 (SQLite WAL 模式) |
| 数据库损坏 | 自动备份 + 启动时检测提示恢复 |
| AI 内容审查失败 | 降级为人工确认模式 |

### 数据备份与迁移

```
备份策略:
- 每次保存自动创建 checkpoint (每小时最多1次)
- 保留最近 10 个版本
- 用户可手动导出 JSON 备份

迁移策略:
- SQLite schema versioning
- 启动时检测 schema 版本，自动迁移
```

### 日志与可观测性

| 日志类型 | 内容 | 存储 |
|---------|------|------|
| 操作日志 | 用户关键操作 (保存/打开/确认) | SQLite |
| AI 调用日志 | token 消耗、响应时间 | SQLite |
| 错误日志 | 异常堆栈 | 本地文件 (logs/error.log) |

---

## Assumptions Exposed & Resolved

## Ontology (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| StoryOutline (故事线) | core domain | title, status, strand_type, chapters[] | contains Chapters; has IFLines |
| IFLine (IF线) | core domain | title, linked_characters[], sync_mode | belongs to StoryOutline; character_stories[] |
| Chapter (章节) | core domain | title, content, word_count, status, strand | belongs to StoryOutline; references Characters, Locations |
| Character (角色) | core domain | name, tier, description, personality, arc, first_appearance | participates in Chapters; has CharacterStory; belongs to IFLine |
| CharacterStory (角色故事线) | supporting | character_id, arc_progress, state_changes[] | belongs to IFLine; references Character |
| CharacterBackground (人物背景) | supporting | character_id, backstory, relationships[], items[] | 1:1 with Character |
| Item (物品) | supporting | name, description, owner, location | referenced by Chapters |
| Location (地点) | supporting | name, description, importance | referenced by Chapters |
| WritingEditor (写作编辑器) | supporting | content, cursor_position, auto_save_state | contains Chapter content |
| Prompt (用户输入) | supporting | text, type, generated_output | triggers AI generation |
| AIGeneratedContent (AI生成内容) | supporting | content, quality_score, issues[], approved | generated from Prompt |
| WritingStyle (文笔风格) | core domain | name, description, examples[], parameters{} | applicable to Chapter/Paragraph |
| StyleAdjustment (文笔调节) | supporting | target, original_style, target_style, modified_content | modifies Chapter/Paragraph content |
| ParagraphOptimization (段落优化) | supporting | paragraph_text, optimization_type, user_ratio | AI optimizes selected paragraph |
| FullTextOptimization (全文优化) | supporting | chapter_content, user_ratio, style_targets[] | AI optimizes full chapter |
| OutlineEditor (独立大纲编辑器) | core domain | outline_content, linked_chapters[], visibility_mode | standalone editing interface |
| **ChatSession (聊天会话)** | **core domain** | **id, status, created_at, updated_at, messages[]** | **界面1数据基础; linked to StoryOutline** |
| **ChatMessage (聊天消息)** | **core domain** | **id, session_id, role, content, created_at, extracted_entities[]** | **belongs to ChatSession; triggers Setting extraction** |
| **DraftVersion (草稿版本)** | **supporting** | **id, chapter_id, content, version_number, created_at, author** | **belongs to Chapter; supports undo/redo history** |
| **PlotThread (伏笔线索)** | **core domain** | **id, title, description, status, created_chapter, reveal_chapter, visibility** | **referenced by Chapters; tracked in CollaborationPanel** |
| **AIInspectionResult (AI审查结果)** | **supporting** | **id, chapter_id, inspection_type, issues[], suggestions[], created_at, auto_fixed** | **belongs to Chapter; shown in AI Review Panel** |
| **UserSettings (用户设置)** | **supporting** | **id, human_ai_ratio_default, default_style, theme, editor_settings{}** | **global preferences; per-project override** |

## Ontology Convergence

| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 9 | 9 | - | - | N/A |
| 2 | 11 | 4 | 1 | 6 | 56% |
| 3 | 11 | 1 | 0 | 10 | 83% |
| 4 | 11 | 0 | 0 | 11 | 100% |
| 7 | 16 | 5 | 0 | 13 | 81% |
| 10 | **22** | **6** | 0 | 18 | **82%** |

**Round 10 新增 6 个实体**（ChatSession、ChatMessage、DraftVersion、PlotThread、AIInspectionResult、UserSettings），稳定性 82%。

## Interview Transcript
<details>
<summary>Full Q&A (6 rounds)</summary>

### Round 1
**Q:** 主界面肯定是B+C... 问：关于"自动化"具体指什么？
**A:** 主界面是大纲/角色管理，可以拖到故事线、IF线等大纲进程，完善整个故事背景和角色物品等信息，然后进入写作界面。AI生成是90%，用户输入是prompt，自动化代表全部流水线自动化（生成、保存、整理等）。
**Ambiguity:** 64% (Goal: 0.75, Constraints: 0.50, Criteria: 0.30)

### Round 2
**Q:** 关于IF线机制、AI生成与编辑的边界、拖拽操作的具体含义？
**A:** 1) IF线是同步其他配角的角色故事线；2) 90% AI生成需要我来计划；3) 章节/场景/角色/物品都可以拖拽
**Ambiguity:** 40% (Goal: 0.80, Constraints: 0.55, Criteria: 0.40)

### Round 3
**Q:** 关于成功标准的三个具体问题（读者类型、好章节特征、自动检测问题类型）
**A:** 1) 会发布到网络；2) 角色成长+对话自然+场景生动+不偏题+剧情不拖沓；3) 全部5类(A+B+C+D+E)
**Ambiguity:** 28% (Goal: 0.88, Constraints: 0.60, Criteria: 0.85)

### Round 4
**Q:** 关于技术栈和运行环境的三个问题
**A:** 1) 本地桌面应用；2) Python或别的，由我决定；3) 接入API协议，无上限成本和时间
**Ambiguity:** 23% (Goal: 0.88, Constraints: 0.70, Criteria: 0.85)

### Round 5
**Q:** 关于AI Provider选择和技术架构建议
**A:** 使用MiniMax的兼容OpenAI API格式的模型，使用推荐的Python FastAPI + React架构
**Ambiguity:** 18% (Goal: 0.90, Constraints: 0.90, Criteria: 0.85)

### Round 6
**Q:** 关于AI生成循环的具体操作模式
**A:** A+C 混合模式（主线：用户prompt→AI生成→用户确认；IF线/配角线：AI自动生成→用户偶尔介入）
**Ambiguity:** 18% (Goal: 0.90, Constraints: 0.90, Criteria: 0.85)

### Round 7
**Q:** 关于章节生成流程、文笔调节、人机比例、大纲视图的问题
**A:** 1) 章节通过大纲生成，可调节文笔（江南/卡夫卡/加缪等）；2) 人机比例可自由调节，可选段落或全文AI优化；3) 写作时大纲侧边栏展示，但大纲有独立编辑界面
**Ambiguity:** 9.5% (Goal: 0.95, Constraints: 0.90, Criteria: 0.85)

### Round 8
**Q:** 关于主界面布局、写作界面协作面板、以及借鉴参考的问题
**A:** 1) 需要看实现难度和美感，编辑设定需要协调；2) 写作界面大纲面板太浮于表面，需要真正协助写作的；3) 需要借鉴D:\writer\read里面的写作助手和Web Search最佳实践
**Ambiguity:** 5% (Goal: 0.97, Constraints: 0.90, Criteria: 0.92)

### Round 9
**Q:** 关于三个界面的协调性和AI生成操作
**A:** 重新梳理三个界面：1) 聊天界面 - 通过聊天确立大量设定；2) 设定界面 - 微调+AI二次/多次修改；3) 写作界面 - 正文+文笔技巧和风格操作
**Ambiguity:** 3% (Goal: 0.98, Constraints: 0.95, Criteria: 0.95)

### Round 10 (Team Review)
**Team Review:** 3 executors reviewed spec (7.6/10) and .claude documents
**Supplements Added:**
- ChatSession/ChatMessage/DraftVersion/PlotThread/AIInspectionResult/UserSettings entities
- Backend API endpoint design
- AI calling layer architecture (SQLAlchemy 2.0)
- Data persistence architecture (Zustand ↔ SQLite sync)
- Three-interface flow synchronization details
- AI iteration convergence mechanism
- OutlineEditor ↔ WritingEditor sync rules
- Performance metrics and AI detection sensitivity levels
- Error handling, backup/migration, logging specifications
- Deep/light mode complete color scheme
- Font loading strategy
**Ambiguity:** 0% (all high-priority gaps addressed)

</details>

## 典型用户旅程

### 场景1：主线写作（半自动模式）
1. 用户打开软件 → 进入**大纲/角色管理主界面**
2. 用户选择当前章节节点，拖拽调整顺序
3. 用户进入**写作界面**，输入 prompt（场景设定/情节方向）
4. AI 生成章节内容，用户阅读后修改 prompt 或直接确认
5. 系统自动保存，自动整理文件结构

### 场景2：IF线/配角线写作（高度自动模式）
1. 用户在主界面选择某角色的 IF线
2. AI 自动生成该配角的同步故事（基于主线的角色动向）
3. 用户偶尔介入修改 prompt 或直接批准
4. 系统自动更新该角色的 CharacterStory

### 场景3：人物背景管理
1. 用户在主界面点击角色卡片
2. 侧边面板展示角色详细信息（背景、关系、物品、状态变化）
3. 用户可编辑修改，下一轮 AI 生成时自动同步
