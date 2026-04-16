# UI/UX 完整修复计划

**项目路径:** `D:/writer`
**计划生成日期:** 2026-04-16
**审查依据:** 团队审查结果

---

## 执行摘要

当前完成度评估显示界面功能框架已基本就绪，但存在 **P0 阻断级交互缺失** 和 **P1 数据硬编码** 问题。本计划按优先级排列，共 **6 个修复步骤**，目标将交互完成度从 3/10 提升至 8/10。

---

## 问题清单与优先级

### P0 阻断问题 (必须修复)

| ID | 问题 | 文件位置 | 影响 |
|----|------|----------|------|
| P0-1 | AIOperationDrawer 6个AI操作按钮无onClick | AIOperationDrawer.tsx:41-43, 97-102 | 写作区AI功能完全不可用 |
| P0-2 | CategoryNav "AI辅助生成"按钮无onClick | CategoryNav.tsx:75-81 | 界面2无法触发AI辅助 |
| P0-3 | SettingEditorPage "AI生成关系"按钮无onClick | SettingEditorPage.tsx:36-41 | 关系图谱无法生成 |
| P0-4 | AISuggestionPanel.handleApplyFix 仅打日志 | AISuggestionPanel.tsx:68-71 | 自动修复功能空实现 |
| P0-5 | "AI正在输入..." 文本残留 | AIGuidePanel.tsx:35 | AI化文案残留 |

### P1 次要问题 (应当修复)

| ID | 问题 | 文件位置 | 影响 |
|----|------|----------|------|
| P1-1 | WritingCanvas "第1章" 硬编码 | WritingCanvas.tsx:70 | 状态栏无法反映真实章节 |
| P1-2 | WritingCanvas "文笔风格: 默认" 硬编码 | WritingCanvas.tsx:76 | 状态栏无法反映真实风格 |
| P1-3 | CollaborationPanel mockCharacterStates | CollaborationPanel.tsx:141-144 | 角色状态为假数据 |
| P1-4 | EntityEditor 大纲编辑器 TODO | EntityEditor.tsx:289 | 大纲分类无实质功能 |

---

## 修复步骤

### Step 1: 修复 AIOperationDrawer 按钮交互 (P0-1)

**目标:** 为6个AI操作按钮绑定实际功能

**涉及按钮:**
- 生成下一章 (line 41)
- 优化全文 (line 42)
- 文笔重塑 (line 43)
- 优化/扩写/缩写/改写/续写/润色 (lines 97-102)

**修复方式:**
1. 定义 `handleOperation(operation: string)` 函数
2. 根据 operation 类型调用对应 AI 服务
3. 全局操作使用 `useWritingStore` 的 `generateNextChapter()` / `optimizeFullText()` / `reshapeStyle()`
4. 选中操作调用 `useWritingStore` 的 `optimizeSelection()` / `expandSelection()` 等
5. 按钮点击后显示 loading 状态，完成后 toast 通知

**验收标准:**
- [ ] 点击 "生成下一章" 触发内容生成
- [ ] 点击 "优化全文" 触发全文优化
- [ ] 选中文字后点击 "优化/扩写/缩写/改写/续写/润色" 触发对应操作
- [ ] 操作过程中按钮显示 loading 状态
- [ ] 操作完成后 toast 提示用户

---

### Step 2: 修复 CategoryNav AI辅助生成按钮 (P0-2)

**目标:** 为 "AI辅助生成" 按钮绑定功能

**修复方式:**
1. 定义 `handleAIGenerate()` 函数
2. 根据当前 `settingsCategory` 调用对应生成逻辑
3. 生成的实体类型映射:
   - world -> `generateWorldSetting()`
   - character -> `generateCharacter()`
   - item -> `generateItem()`
   - location -> `generateLocation()`
   - faction -> `generateFaction()`
   - rule -> `generateRule()`
   - outline -> `generateOutline()`
   - ifline -> `generateIFLine()`

**验收标准:**
- [ ] 点击按钮触发对应分类的实体生成
- [ ] 生成内容添加到对应 store
- [ ] 生成后列表自动刷新显示新内容

---

### Step 3: 修复 SettingEditorPage AI生成关系按钮 (P0-3)

**目标:** 为关系图谱旁边的 "AI生成关系" 按钮绑定功能

**修复方式:**
1. 定义 `handleGenerateRelations()` 函数
2. 调用 `useSettingsStore` 的 `generateRelations()` 方法
3. 基于现有角色、势力自动分析并生成关系图谱数据

**验收标准:**
- [ ] 点击按钮触发关系生成
- [ ] RelationGraph 组件自动刷新显示新关系
- [ ] 生成完成后 toast 提示

---

### Step 4: 修复 AISuggestionPanel 自动修复 (P0-4)

**目标:** 实现 handleApplyFix 实际逻辑

**修复方式:**
1. 调用 AI 服务进行一致性修复
2. 根据 suggestion.type 分发到不同修复逻辑:
   - consistency -> 调用 `fixConsistencyIssue(id)`
   - relationship -> 调用 `fixRelationshipIssue(id)`
   - foreshadowing -> 调用 `revealForeshadowing(id)`
3. 修复成功后更新 store 中的实体数据

**验收标准:**
- [ ] 点击自动修复按钮实际修改数据
- [ ] 修复后 UI 自动刷新显示修复结果
- [ ] 无法自动修复的建议保持原样（不调用API）

---

### Step 5: 重命名 AI 化文案并实现去AI化 (P0-5 + P1-1 + P1-2 + P1-3)

**目标:** 清除 AI 化文案残留，修复硬编码数据

**文案修改清单:**

| 文件 | 原文本 | 修改后 | 说明 |
|------|--------|--------|------|
| AIGuidePanel.tsx:35 | "AI正在输入..." | "正在输入..." | 移除AI标识 |
| AISuggestionPanel.tsx:84 | "AI审查建议" | "审查建议" | 移除AI标识 |
| AIOperationDrawer.tsx | "AI操作" section | "写作操作" | 中性化描述 |
| CategoryNav.tsx:80 | "AI辅助生成" | "智能生成" | 软化AI标识 |
| SettingEditorPage.tsx:38 | "AI生成关系" | "生成关系" | 移除AI标识 |

**硬编码修复:**

| 文件位置 | 原值 | 修复方式 |
|----------|------|----------|
| WritingCanvas.tsx:70 | "第 1 章" | 从 store 读取 `currentChapter` 或显示 "未设置章节" |
| WritingCanvas.tsx:76 | "文笔风格: 默认" | 从 store 读取 `writingStyle` 显示对应标签 |
| CollaborationPanel.tsx:141 | `'正常' as string` | 从实际章节剧情中读取角色状态 |

**验收标准:**
- [ ] 所有 "AI" 前缀文案已替换为中性表述
- [ ] 状态栏数据从 store 动态读取
- [ ] 角色状态显示真实剧情状态（非 "正常" 硬编码）

---

### Step 6: 实现大纲编辑器基本功能 (P1-4)

**目标:** 替换 EntityEditor.tsx line 289 的 TODO comment

**修复方式:**
1. 创建 `<OutlineEditor />` 组件
2. 支持:
   - 章节列表展示
   - 章节标题编辑
   - 章节摘要编写
   - 章节拖拽排序
   - 新增/删除章节

**验收标准:**
- [ ] 大纲分类显示章节列表
- [ ] 可新增/编辑/删除章节
- [ ] 章节支持拖拽排序

---

## 完成度目标

| 指标 | 当前 | 目标 |
|------|------|------|
| 交互完整度 | 3/10 | 8/10 |
| 去AI化评分 | 2/10 | 8/10 |
| P0问题数 | 5 | 0 |
| P1问题数 | 4 | 0 |

---

## 修复后预期效果

1. **界面1(聊天初始化):** 85% -> 92%
2. **界面2(设定编辑):** 72% -> 90%
3. **界面3(正文写作):** 85% -> 95%
4. **去AI化评分:** 2/10 -> 8/10
5. **交互性完成度:** 3/10 -> 8/10

---

## 未纳入本计划的待处理项

以下问题需要更多架构决策，暂不纳入本轮修复:

| 待处理项 | 原因 | 建议 |
|----------|------|------|
| 真实 AI API 调用 | 需要确定 API 提供商和接口设计 | 创建独立的 AI service 模块 |
| 界面1到界面2的导航绑定 | 需要明确项目创建流程 | 在 ChatInitPage 添加 "完成初始化" 按钮 |
| SQLite 数据持久化 | 需要后端 API 设计 | 暂用 localStorage 作为过渡 |

---

## 附录: 文件修改清单

```
src/frontend/src/components/writing/AIOperationDrawer.tsx      # Step 1
src/frontend/src/components/settings/CategoryNav.tsx           # Step 2
src/frontend/src/components/settings/SettingEditorPage.tsx    # Step 3
src/frontend/src/components/settings/AISuggestionPanel.tsx    # Step 4
src/frontend/src/components/chat/AIGuidePanel.tsx             # Step 5
src/frontend/src/components/writing/WritingCanvas.tsx          # Step 5
src/frontend/src/components/writing/CollaborationPanel.tsx     # Step 5
src/frontend/src/components/settings/EntityEditor.tsx          # Step 6
src/frontend/src/store/writingStore.ts                         # 配合Step 1-3添加生成方法
src/frontend/src/store/settingsStore.ts                       # 配合Step 2-3添加生成方法
```

---

**计划确认:** 请回复 "proceed" 以开始执行，或 "adjust [X]" 修改特定步骤。
