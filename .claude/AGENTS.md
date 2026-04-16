# AGENTS.md — Agent Coordination Instructions

## 角色分工

| Agent | 职责 |
|-------|------|
| writer | 负责文本生成、文笔优化、风格迁移 |
| planner | 负责大纲结构、IF线规划、剧情走向 |
| researcher | 负责世界观设定、资料收集 |
| reviewer | 负责一致性检查、OOC检测、逻辑审查 |
| executor | 负责代码实现、界面开发、集成 |

---

## 工作流程

### 主线写作流程 (A+C 混合)

```
用户 prompt → writer 生成 → 用户确认 → 保存
                            ↓ 不满意
                      修改 prompt → writer 重新生成
```

### IF线写作流程 (高度自动)

```
AI 自动生成 → reviewer 检查 → 用户偶尔介入 → 保存
```

---

## 任务分配规则

1. **新建项目：** researcher → planner → writer
2. **设定编辑：** researcher 审查 → planner 规划 → 用户确认
3. **正文写作：** writer 生成 → reviewer 检测 → 用户确认
4. **代码开发：** executor 实现 → reviewer 审查

---

## 通信协议

- Agent 间通过共享任务列表协调
- 使用 SendMessage 进行同步通信
- 任务状态：pending → in_progress → completed

---

## 质量门禁

| 检查项 | 触发时机 | 负责Agent |
|--------|---------|-----------|
| 设定一致性 | 每次保存设定 | researcher |
| OOC检测 | 每次生成内容 | reviewer |
| 战力平衡 | 每次生成战斗场景 | reviewer |
| 伏笔追踪 | 章节完成时 | reviewer |
| 文笔质量 | AI生成后 | writer |

---

## 审查标准

- **界面1：** AI 提问质量、信息收集完整度
- **界面2：** 设定一致性、关系完整性
- **界面3：** 文笔质量、风格一致性、人机比例满意度
