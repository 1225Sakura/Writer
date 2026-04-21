# Auto Novel Writer - 数据模型与数据库架构设计文档

> 版本: v1.0  
> 日期: 2026-04-21  
> 作者: backend-arch-review / worker-5

---

## 1. 现状分析

### 1.1 现有模型概览 (18个)

当前 `src/backend/models/entities.py` 包含以下模型：

| 模块 | 模型 | 说明 |
|------|------|------|
| 角色关系 | `Character` | 角色基础信息 |
| | `CharacterRelationship` | 角色间关系（有向图） |
| | `CharacterStoryline` | 角色故事线 |
| 世界设定 | `Item` | 物品 |
| | `Location` | 地点 |
| | `Faction` | 势力 |
| | `WorldSetting` | 世界观设定 |
| | `Rule` | 规则/法则 |
| 故事结构 | `Outline` | 大纲 |
| | `Chapter` | 章节 |
| | `IFLine` | IF线 |
| 聊天 | `ChatSession` | 聊天会话 |
| | `ChatMessage` | 聊天消息 |
| | `ExtractedEntity` | 提取的实体 |
| 写作 | `DraftVersion` | 草稿版本 |
| | `PlotThread` | 情节线索 |
| | `AIInspectionResult` | AI审查结果 |
| | `WritingSettings` | 写作设置 |

### 1.2 关键缺失

根据 CLAUDE.md 待完善章节及业务需求分析，以下实体缺失或不足：

1. **Story/Project** - 无顶层故事/项目实体，所有数据平铺
2. **Scene** - 仅有 Chapter，无场景级拆分
3. **Foreshadowing** - PlotThread 不足以表达伏笔的埋设/回收机制
4. **Timeline/Event** - 无时间线/事件系统
5. **Tag/Category** - 无标签分类系统
6. **GenreConfiguration** - 无题材配置（仙侠/都市/科幻等）
7. **UserPreference** - 无用户偏好/全局配置
8. **WritingStyle** - 文笔风格仅字符串，无结构化定义
9. **EditHistory** - 无细粒度编辑历史
10. **AIGeneratedContent** - 无AI生成内容质量追踪

### 1.3 现有问题

- **无软删除**：所有模型硬删除，误操作不可逆
- **无外键关联到项目**：无法支持多作品管理
- **无全文搜索**：大量文本字段无法高效检索
- **版本控制简陋**：DraftVersion 仅记录内容，无 diff
- **JSON 字段无校验**：`details_json`, `issues_json` 等无结构约束
- **缺少审计字段**：无 `created_by`, `deleted_at` 等

---

## 2. 目标架构设计

### 2.1 ER 关系图（文本描述）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PROJECT (项目/作品)                              │
│  id, title, genre_id, author_name, description, status, created_at, etc.   │
└─────────────┬───────────────────────────────┬───────────────────────────────┘
              │ 1:N                           │ 1:N
    ┌─────────▼──────────┐        ┌───────────▼────────────┐
    │   GENRE_CONFIG     │        │   USER_PREFERENCE      │
    │  (题材配置)         │        │   (用户偏好)            │
    └────────────────────┘        └────────────────────────┘
              │
              ▼ 1:N
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STORY_OUTLINE (故事线基类)                          │
│  (Outline / IFLine 的公共抽象，支持统一查询)                                   │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │ 1:N
    ┌─────────▼──────────┐        ┌───────────▼────────────┐
    │     OUTLINE        │        │       IF_LINE          │
    │   (主线大纲)        │        │     (IF线)             │
    └─────────┬──────────┘        └───────────┬────────────┘
              │ 1:N                           │ 1:N
    ┌─────────▼──────────┐        ┌───────────▼────────────┐
    │      CHAPTER       │        │   IF_LINE_CHAPTER      │
    │    (章节)           │        │   (IF线章节)            │
    └─────────┬──────────┘        └────────────────────────┘
              │ 1:N
    ┌─────────▼──────────┐
    │       SCENE        │
    │    (场景)           │
    └─────────┬──────────┘
              │ 1:N
    ┌─────────▼──────────┐
    │   DRAFT_VERSION    │
    │   (草稿版本)        │
    └────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHARACTER (角色) - 增强版                             │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │
    ┌─────────┼──────────┐        ┌───────────┐
    ▼         ▼          ▼        ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐
│Relationship│Storyline│  Tag   │ Timeline │ Foreshadowing│
└────────┘ └────────┘ └────────┘ └────────┘ └────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        WORLD ENTITY (世界实体) - 统一标签                      │
│  Item / Location / Faction / WorldSetting / Rule 均支持 Tag 关联              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        CHAT & AI (聊天与AI)                                  │
│  ChatSession → ChatMessage → ExtractedEntity → (确认后创建正式实体)           │
│  AIInspectionResult / AIGeneratedContent / WritingStyle                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 核心关系矩阵

| 父实体 | 子实体 | 关系类型 | 级联策略 |
|--------|--------|----------|----------|
| Project | Outline | 1:N | CASCADE |
| Project | IFLine | 1:N | CASCADE |
| Project | Character | 1:N | CASCADE |
| Project | WorldSetting | 1:N | CASCADE |
| Project | ChatSession | 1:N | SET NULL |
| Outline | Chapter | 1:N | CASCADE |
| Chapter | Scene | 1:N | CASCADE |
| Chapter | DraftVersion | 1:N | CASCADE |
| Character | CharacterRelationship | 1:N | CASCADE |
| Character | CharacterStoryline | 1:N | CASCADE |
| Scene | AIGeneratedContent | 1:N | CASCADE |
| * | TagAssociation | N:M | CASCADE |

---

## 3. 详细模型设计

### 3.1 新增模型

#### 3.1.1 Project (项目/作品)

```python
class Project(Base):
    """作品项目 - 顶层聚合根"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    subtitle = Column(String(500))
    author_name = Column(String(100), default="")
    description = Column(Text)
    
    # 题材与类型
    genre_id = Column(Integer, ForeignKey("genre_configurations.id", ondelete="SET NULL"))
    sub_genre = Column(String(50))  # 子类型：仙侠→修真/武侠/玄幻
    
    # 状态管理
    status = Column(String(20), default="draft")  # draft, writing, completed, archived
    target_word_count = Column(Integer, default=100000)
    current_word_count = Column(Integer, default=0)
    
    # 封面与元数据
    cover_image_path = Column(String(500))
    
    # 审计字段
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)  # 软删除标记
    
    # 关系
    outlines = relationship("Outline", back_populates="project")
    if_lines = relationship("IFLine", back_populates="project")
    characters = relationship("Character", back_populates="project")
    world_settings = relationship("WorldSetting", back_populates="project")
    chat_sessions = relationship("ChatSession", back_populates="project")
    tags = relationship("TagAssociation", back_populates="project")
```

**索引设计：**
```sql
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_genre ON projects(genre_id);
CREATE INDEX idx_projects_deleted_at ON projects(deleted_at) WHERE deleted_at IS NULL;
```

---

#### 3.1.2 GenreConfiguration (题材配置)

```python
class GenreConfiguration(Base):
    """题材配置模板 - 预置 + 用户自定义"""
    __tablename__ = "genre_configurations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)  # 仙侠, 都市, 科幻...
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # 该题材下的默认实体模板（JSON）
    default_entity_templates = Column(Text)  # {"character_fields": [...], "world_fields": [...]}
    
    # AI Prompt 模板
    ai_prompt_template = Column(Text)
    
    # 内置标记
    is_builtin = Column(Integer, default=0)  # 0=用户自定义, 1=内置
    is_active = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

---

#### 3.1.3 Scene (场景)

```python
class Scene(Base):
    """场景 - Chapter 的子单元，支持细粒度写作"""
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String(200))
    content = Column(Text, default="")
    summary = Column(Text)
    
    # 场景元数据
    scene_order = Column(Integer, default=0)
    word_count = Column(Integer, default=0)
    
    # 场景设定（覆盖或继承章节设定）
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"))
    time_of_day = Column(String(20))  # 清晨, 正午, 黄昏, 夜晚...
    weather = Column(String(50))
    
    # 状态
    status = Column(String(20), default="draft")  # draft, writing, completed
    
    # 人机比例（可覆盖全局设置）
    human_ai_ratio = Column(Float)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)
    
    # 关系
    chapter = relationship("Chapter", back_populates="scenes")
    location = relationship("Location")
    ai_contents = relationship("AIGeneratedContent", back_populates="scene")
    draft_versions = relationship("DraftVersion", back_populates="scene")
```

**索引设计：**
```sql
CREATE INDEX idx_scenes_chapter ON scenes(chapter_id);
CREATE INDEX idx_scenes_order ON scenes(chapter_id, scene_order);
CREATE INDEX idx_scenes_status ON scenes(status);
CREATE INDEX idx_scenes_deleted_at ON scenes(deleted_at) WHERE deleted_at IS NULL;
```

---

#### 3.1.4 Foreshadowing (伏笔追踪)

```python
class Foreshadowing(Base):
    """伏笔 - 埋设与回收的完整生命周期"""
    __tablename__ = "foreshadowings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    # 埋设信息
    plant_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    plant_scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="SET NULL"))
    plant_text = Column(Text)  # 埋设时的原文片段
    
    # 回收信息（可为空，表示未回收）
    resolve_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    resolve_scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="SET NULL"))
    resolve_text = Column(Text)
    
    # 状态
    status = Column(String(20), default="planted")  # planted, resolved, abandoned
    importance = Column(String(20), default="normal")  # minor, normal, major, critical
    
    # 关联角色（谁埋设的/谁发现的）
    planted_by_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))
    resolved_by_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    project = relationship("Project")
    plant_chapter = relationship("Chapter", foreign_keys=[plant_chapter_id])
    resolve_chapter = relationship("Chapter", foreign_keys=[resolve_chapter_id])
```

**索引设计：**
```sql
CREATE INDEX idx_foreshadowings_project ON foreshadowings(project_id);
CREATE INDEX idx_foreshadowings_status ON foreshadowings(status);
CREATE INDEX idx_foreshadowings_plant ON foreshadowings(plant_chapter_id);
CREATE INDEX idx_foreshadowings_resolve ON foreshadowings(resolve_chapter_id);
```

---

#### 3.1.5 Timeline & TimelineEvent (时间线/事件)

```python
class Timeline(Base):
    """时间线 - 故事的时间轴"""
    __tablename__ = "timelines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # 时间单位
    time_unit = Column(String(20), default="chapter")  # chapter, day, year, custom
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    project = relationship("Project")
    events = relationship("TimelineEvent", back_populates="timeline", order_by="TimelineEvent.position")


class TimelineEvent(Base):
    """时间线事件"""
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timeline_id = Column(Integer, ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String(200), nullable=False)
    description = Column(Text)
    
    # 时间定位
    position = Column(Integer, default=0)  # 排序位置
    time_label = Column(String(100))  # 显示时间："第一章", "天历三年春"...
    
    # 关联
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    character_ids = Column(Text)  # JSON 数组 [1, 2, 3]
    
    # 事件类型
    event_type = Column(String(30), default="plot")  # plot, battle, revelation, death...
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    timeline = relationship("Timeline", back_populates="events")
    chapter = relationship("Chapter")
```

**索引设计：**
```sql
CREATE INDEX idx_timelines_project ON timelines(project_id);
CREATE INDEX idx_timeline_events_timeline ON timeline_events(timeline_id);
CREATE INDEX idx_timeline_events_position ON timeline_events(timeline_id, position);
CREATE INDEX idx_timeline_events_chapter ON timeline_events(chapter_id);
```

---

#### 3.1.6 Tag & TagAssociation (标签系统)

```python
class Tag(Base):
    """标签定义"""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(50), nullable=False)
    color = Column(String(7), default="#5b8ee8")  # HEX 颜色
    category = Column(String(30), default="general")  # general, character, plot, world...
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    project = relationship("Project")
    associations = relationship("TagAssociation", back_populates="tag")


class TagAssociation(Base):
    """标签关联 - 多态关联到任意实体"""
    __tablename__ = "tag_associations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)
    
    # 多态关联
    entity_type = Column(String(30), nullable=False)  # character, item, location, chapter, scene...
    entity_id = Column(Integer, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    tag = relationship("Tag", back_populates="associations")
    
    # 联合唯一约束
    __table_args__ = (
        Index('idx_tag_assoc_unique', 'tag_id', 'entity_type', 'entity_id', unique=True),
        Index('idx_tag_assoc_entity', 'entity_type', 'entity_id'),
    )
```

---

#### 3.1.7 WritingStyle (文笔风格 - 结构化)

```python
class WritingStyle(Base):
    """文笔风格 - 结构化定义，替代 WritingSettings 中的字符串"""
    __tablename__ = "writing_styles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    name = Column(String(50), nullable=False)  # 江南, 卡夫卡, 加缪, 自定义...
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # 风格维度（JSON 结构化）
    style_dimensions = Column(Text)  # {
                                   #   "sentence_rhythm": "长短句交错，节奏舒缓",
                                   #   "vocabulary_level": "文言夹杂，意境优先",
                                   #   "emotion_expression": "含蓄内敛，侧面烘托",
                                   #   "pacing": "慢热，重氛围",
                                   #   "perspective": "第三人称限知",
                                   #   "dialogue_style": "简短有力，潜台词丰富"
                                   # }
    
    # AI Prompt 片段
    ai_prompt_fragment = Column(Text)
    
    # 示例文本
    sample_text = Column(Text)
    
    # 内置标记
    is_builtin = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

---

#### 3.1.8 AIGeneratedContent (AI生成内容)

```python
class AIGeneratedContent(Base):
    """AI生成内容 - 追踪质量与使用"""
    __tablename__ = "ai_generated_contents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 关联场景
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"))
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"))
    
    # 生成类型
    generation_type = Column(String(30), nullable=False)  # continuation, expansion, rewrite, polish, summary...
    
    # 输入/输出
    prompt = Column(Text)
    content = Column(Text, nullable=False)
    
    # 质量评估
    quality_score = Column(Float)  # 0-1，AI或用户评分
    user_rating = Column(Integer)  # 1-5 星
    is_accepted = Column(Integer, default=0)  # 0=待审, 1=接受, -1=拒绝
    
    # 元数据
    model_name = Column(String(50))  # MiniMax-Text-01, etc.
    tokens_used = Column(Integer)
    generation_time_ms = Column(Integer)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    scene = relationship("Scene", back_populates="ai_contents")
    chapter = relationship("Chapter")
```

**索引设计：**
```sql
CREATE INDEX idx_ai_gen_scene ON ai_generated_contents(scene_id);
CREATE INDEX idx_ai_gen_chapter ON ai_generated_contents(chapter_id);
CREATE INDEX idx_ai_gen_type ON ai_generated_contents(generation_type);
CREATE INDEX idx_ai_gen_accepted ON ai_generated_contents(is_accepted);
```

---

#### 3.1.9 EditHistory (编辑历史)

```python
class EditHistory(Base):
    """细粒度编辑历史 - 追踪用户修改"""
    __tablename__ = "edit_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 关联实体
    entity_type = Column(String(30), nullable=False)  # scene, chapter, character...
    entity_id = Column(Integer, nullable=False)
    
    # 编辑信息
    field_name = Column(String(50), nullable=False)  # content, title, etc.
    old_value = Column(Text)
    new_value = Column(Text)
    
    # 编辑类型
    edit_type = Column(String(20), default="manual")  # manual, ai_generate, ai_edit, import
    
    # 可选：diff 格式（节省存储）
    diff_patch = Column(Text)  # unified diff
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_edit_history_entity', 'entity_type', 'entity_id'),
        Index('idx_edit_history_created', 'created_at'),
    )
```

---

#### 3.1.10 UserPreference (用户偏好)

```python
class UserPreference(Base):
    """用户全局偏好设置"""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 界面
    theme = Column(String(20), default="dark")  # dark, light, auto
    font_family = Column(String(50), default="Source Han Serif CN")
    font_size = Column(Integer, default=16)
    line_height = Column(Float, default=1.75)
    
    # 写作默认
    default_writing_style_id = Column(Integer, ForeignKey("writing_styles.id", ondelete="SET NULL"))
    default_human_ai_ratio = Column(Float, default=0.5)
    default_target_word_count = Column(Integer, default=3000)
    
    # AI 配置
    default_ai_model = Column(String(50), default="MiniMax-Text-01")
    auto_save_interval = Column(Integer, default=30)  # 秒
    
    # 快捷键（JSON）
    keyboard_shortcuts = Column(Text)
    
    # 数据
    auto_backup_enabled = Column(Integer, default=1)
    auto_backup_interval = Column(Integer, default=3600)  # 秒
    max_backup_count = Column(Integer, default=10)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    default_writing_style = relationship("WritingStyle")
```

---

### 3.2 现有模型改造

#### 3.2.1 所有模型统一添加软删除与项目关联

**改造原则：**
- 添加 `project_id` 外键（除 GenreConfiguration, WritingStyle, UserPreference 等全局表）
- 添加 `deleted_at` 字段实现软删除
- 添加复合索引 `(project_id, deleted_at)`

**示例 - Character 改造：**

```python
class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(100), nullable=False)
    gender = Column(String(10))
    personality = Column(Text)
    desires = Column(Text)
    flaws = Column(Text)
    description = Column(Text)
    tier = Column(String(20))
    cultivation_realm = Column(String(50))
    
    # 新增字段
    aliases = Column(Text)  # JSON ["别名1", "别名2"]
    age = Column(Integer)
    appearance = Column(Text)
    background = Column(Text)
    goals = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)
    
    # 关系
    project = relationship("Project", back_populates="characters")
    relationships = relationship("CharacterRelationship", ...)
    storylines = relationship("CharacterStoryline", ...)
    
    __table_args__ = (
        Index('idx_characters_project', 'project_id'),
        Index('idx_characters_project_active', 'project_id', 'deleted_at'),
        Index('idx_characters_name', 'name'),
    )
```

#### 3.2.2 Chapter 改造（关联 Scene）

```python
class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    outline_id = Column(Integer, ForeignKey("outlines.id", ondelete="SET NULL"))
    
    title = Column(String(200))
    summary = Column(Text)
    status = Column(String(20), default="pending")
    word_count = Column(Integer, default=0)
    chapter_order = Column(Integer, default=0)
    
    # 新增
    chapter_type = Column(String(20), default="normal")  # normal, prologue, epilogue, interlude
    target_word_count = Column(Integer)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)
    
    # 关系
    project = relationship("Project")
    outline = relationship("Outline", back_populates="chapters")
    scenes = relationship("Scene", back_populates="chapter", order_by="Scene.scene_order")
    draft_versions = relationship("DraftVersion", ...)
    ai_inspections = relationship("AIInspectionResult", ...)
```

#### 3.2.3 DraftVersion 改造（支持 Scene 级版本）

```python
class DraftVersion(Base):
    __tablename__ = "draft_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # 多态关联：可以是 chapter 或 scene
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"))
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"))
    
    content = Column(Text, nullable=False)
    version_number = Column(Integer, nullable=False)
    
    # 新增：版本元数据
    change_summary = Column(String(200))  # 变更摘要
    word_count = Column(Integer)
    
    # 新增：diff 存储（节省空间）
    diff_from_previous = Column(Text)  # 与上一版本的 diff
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关系
    chapter = relationship("Chapter", back_populates="draft_versions")
    scene = relationship("Scene", back_populates="draft_versions")
    
    __table_args__ = (
        Index('idx_draft_versions_chapter', 'chapter_id', 'version_number'),
        Index('idx_draft_versions_scene', 'scene_id', 'version_number'),
    )
```

#### 3.2.4 IFLine 改造（继承基类统一接口）

```python
class StoryLineBase(Base):
    """故事线抽象基类 - Outline 和 IFLine 的公共接口"""
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Outline(StoryLineBase):
    __tablename__ = "outlines"
    
    # Outline 特有
    outline_type = Column(String(20), default="main")  # main, arc, volume
    parent_id = Column(Integer, ForeignKey("outlines.id", ondelete="SET NULL"))
    
    # 关系
    project = relationship("Project", back_populates="outlines")
    chapters = relationship("Chapter", back_populates="outline")
    parent = relationship("Outline", remote_side=[id], back_populates="children")
    children = relationship("Outline", back_populates="parent")


class IFLine(StoryLineBase):
    __tablename__ = "if_lines"
    
    # IFLine 特有
    linked_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))
    sync_mode = Column(String(20), default="auto")  # auto, manual, disabled
    divergence_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    
    # 关系
    project = relationship("Project", back_populates="if_lines")
    linked_character = relationship("Character")
    divergence_chapter = relationship("Chapter")
    if_chapters = relationship("IFLineChapter", back_populates="if_line")
```

---

## 4. 继承策略

### 4.1 StoryLineBase 抽象基类

采用 **抽象基类（Abstract Base Class）** 策略：

```
StoryLineBase (abstract)
    ├── Outline
    └── IFLine
```

**理由：**
- Outline 和 IFLine 共享 80% 字段（title, description, status, project_id, timestamps）
- 但查询场景通常是分开的（"获取主线大纲" vs "获取所有 IF 线"）
- 抽象基类避免单表继承的 NULL 污染，同时避免联合查询的复杂性

### 4.2 多态关联策略

TagAssociation 和 EditHistory 使用 **实体类型 + 实体ID** 的多态关联：

```python
# 优点：
# 1. 无需为每种实体创建单独的关联表
# 2. 新增实体类型时无需修改表结构
# 3. 查询统一

# 缺点：
# 1. 无外键约束（需应用层保证）
# 2. 级联删除需应用层处理

# 折中方案：SQLite 不支持 CHECK 约束做外键，使用触发器或应用层保证
```

---

## 5. 删除策略

### 5.1 软删除 vs 硬删除

| 实体 | 策略 | 理由 |
|------|------|------|
| Project | 软删除 | 作品误删损失巨大 |
| Chapter | 软删除 | 章节内容不可恢复 |
| Scene | 软删除 | 场景内容不可恢复 |
| Character | 软删除 | 关联关系复杂，硬删除影响大 |
| DraftVersion | 硬删除 | 版本可重建，且数量增长快 |
| ChatMessage | 硬删除 | 会话级联删除即可 |
| AIInspectionResult | 硬删除 | 可重新生成 |
| Tag | 硬删除 | 仅元数据 |

### 5.2 软删除实现

```python
# 查询过滤器基类
from sqlalchemy import event

@event.listens_for(Query, "before_compile", retval=True)
def filter_deleted(query):
    """自动过滤已删除记录"""
    for desc in query.column_descriptions:
        entity = desc['entity']
        if entity is not None and hasattr(entity, 'deleted_at'):
            query = query.filter(entity.deleted_at.is_(None))
    return query
```

---

## 6. 版本控制设计

### 6.1 DraftVersion 增强

```
版本存储策略：
├── 完整内容存储（每 N 个版本存一个完整快照）
│   └── 默认 N=10，可配置
├── 增量 diff 存储（版本间差异）
│   └── 使用 python-diff-match-patch 生成
└── 自动清理策略
    └── 保留最近 50 个版本 + 每 10 版本的快照
```

### 6.2 版本树（可选扩展）

```
支持分支版本（类似 Git）：

Chapter A
├── v1 (初始)
├── v2 (修改)
│   └── v2.1 (分支：尝试不同写法)
│       └── v2.1.1
└── v3 (合并 v2.1.1 的改进)
```

实现方式：添加 `parent_version_id` 和 `branch_name` 字段。

---

## 7. 全文搜索 (FTS) 方案

### 7.1 SQLite FTS5

```sql
-- 创建 FTS5 虚拟表（用于内容搜索）
CREATE VIRTUAL TABLE chapter_search USING fts5(
    title,
    summary,
    content,  -- 聚合所有 scene 的内容
    chapter_id UNINDEXED,
    tokenize = 'porter unicode61'
);

-- 创建触发器保持同步
CREATE TRIGGER chapters_ai AFTER INSERT ON chapters BEGIN
    INSERT INTO chapter_search(title, summary, chapter_id)
    VALUES (NEW.title, NEW.summary, NEW.id);
END;

CREATE TRIGGER chapters_ad AFTER DELETE ON chapters BEGIN
    DELETE FROM chapter_search WHERE chapter_id = OLD.id;
END;

-- 场景内容搜索
CREATE VIRTUAL TABLE scene_search USING fts5(
    title,
    content,
    scene_id UNINDEXED,
    tokenize = 'porter unicode61'
);
```

### 7.2 实体搜索

```sql
-- 统一实体搜索（角色、物品、地点等）
CREATE VIRTUAL TABLE entity_search USING fts5(
    name,
    description,
    entity_type,  -- character, item, location...
    entity_id UNINDEXED,
    tokenize = 'porter unicode61'
);
```

### 7.3 Python 集成

```python
from sqlalchemy import text

async def search_content(db: AsyncSession, query: str, project_id: int):
    """全文搜索内容"""
    sql = text("""
        SELECT 
            cs.chapter_id,
            c.title,
            c.chapter_order,
            snippet(chapter_search, 0, '<mark>', '</mark>', '...', 32) as snippet,
            rank
        FROM chapter_search cs
        JOIN chapters c ON cs.chapter_id = c.id
        WHERE chapter_search MATCH :query
          AND c.project_id = :project_id
          AND c.deleted_at IS NULL
        ORDER BY rank
        LIMIT 50
    """)
    result = await db.execute(sql, {"query": query, "project_id": project_id})
    return result.fetchall()
```

---

## 8. 完整模型代码

### 8.1 完整 entities.py（新增 + 改造）

```python
# Auto Novel Writer - SQLAlchemy Models (Enhanced)
# Version: 2.0

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Index, Boolean
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


# ============================================
# Base Mixins
# ============================================

class SoftDeleteMixin:
    """软删除混入"""
    deleted_at = Column(DateTime)

class TimestampMixin:
    """时间戳混入"""
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ProjectScopedMixin:
    """项目作用域混入"""
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)


# ============================================
# Global Configuration Tables
# ============================================

class GenreConfiguration(Base, TimestampMixin):
    """题材配置模板"""
    __tablename__ = "genre_configurations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    default_entity_templates = Column(Text)
    ai_prompt_template = Column(Text)
    is_builtin = Column(Integer, default=0)
    is_active = Column(Integer, default=1)


class WritingStyle(Base, TimestampMixin):
    """文笔风格定义"""
    __tablename__ = "writing_styles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    style_dimensions = Column(Text)
    ai_prompt_fragment = Column(Text)
    sample_text = Column(Text)
    is_builtin = Column(Integer, default=0)
    is_active = Column(Integer, default=1)


class UserPreference(Base, TimestampMixin):
    """用户全局偏好"""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    theme = Column(String(20), default="dark")
    font_family = Column(String(50), default="Source Han Serif CN")
    font_size = Column(Integer, default=16)
    line_height = Column(Float, default=1.75)
    default_writing_style_id = Column(Integer, ForeignKey("writing_styles.id", ondelete="SET NULL"))
    default_human_ai_ratio = Column(Float, default=0.5)
    default_target_word_count = Column(Integer, default=3000)
    default_ai_model = Column(String(50), default="MiniMax-Text-01")
    auto_save_interval = Column(Integer, default=30)
    keyboard_shortcuts = Column(Text)
    auto_backup_enabled = Column(Integer, default=1)
    auto_backup_interval = Column(Integer, default=3600)
    max_backup_count = Column(Integer, default=10)

    default_writing_style = relationship("WritingStyle")


# ============================================
# Project (Top-level Aggregate Root)
# ============================================

class Project(Base, SoftDeleteMixin, TimestampMixin):
    """作品项目 - 顶层聚合根"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    subtitle = Column(String(500))
    author_name = Column(String(100), default="")
    description = Column(Text)
    genre_id = Column(Integer, ForeignKey("genre_configurations.id", ondelete="SET NULL"))
    sub_genre = Column(String(50))
    status = Column(String(20), default="draft")
    target_word_count = Column(Integer, default=100000)
    current_word_count = Column(Integer, default=0)
    cover_image_path = Column(String(500))

    # 关系
    outlines = relationship("Outline", back_populates="project")
    if_lines = relationship("IFLine", back_populates="project")
    characters = relationship("Character", back_populates="project")
    world_settings = relationship("WorldSetting", back_populates="project")
    chat_sessions = relationship("ChatSession", back_populates="project")
    tags = relationship("Tag", back_populates="project")
    timelines = relationship("Timeline", back_populates="project")
    foreshadowings = relationship("Foreshadowing", back_populates="project")

    __table_args__ = (
        Index('idx_projects_status', 'status'),
        Index('idx_projects_deleted_at', 'deleted_at'),
    )


# ============================================
# Story Line Base (Abstract)
# ============================================

class StoryLineBase(Base, TimestampMixin):
    """故事线抽象基类"""
    __abstract__ = True

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="active")


class Outline(StoryLineBase):
    """主线大纲"""
    __tablename__ = "outlines"

    outline_type = Column(String(20), default="main")
    parent_id = Column(Integer, ForeignKey("outlines.id", ondelete="SET NULL"))

    project = relationship("Project", back_populates="outlines")
    chapters = relationship("Chapter", back_populates="outline")
    parent = relationship("Outline", remote_side=[StoryLineBase.id], back_populates="children")
    children = relationship("Outline", back_populates="parent")


class IFLine(StoryLineBase):
    """IF线"""
    __tablename__ = "if_lines"

    linked_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))
    sync_mode = Column(String(20), default="auto")
    divergence_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))

    project = relationship("Project", back_populates="if_lines")
    linked_character = relationship("Character")
    divergence_chapter = relationship("Chapter")


# ============================================
# Characters & Relationships (Enhanced)
# ============================================

class Character(Base, ProjectScopedMixin, SoftDeleteMixin, TimestampMixin):
    """角色 - 增强版"""
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    aliases = Column(Text)  # JSON
    gender = Column(String(10))
    age = Column(Integer)
    personality = Column(Text)
    desires = Column(Text)
    flaws = Column(Text)
    description = Column(Text)
    appearance = Column(Text)
    background = Column(Text)
    goals = Column(Text)
    tier = Column(String(20))
    cultivation_realm = Column(String(50))

    project = relationship("Project", back_populates="characters")
    relationships = relationship("CharacterRelationship",
        foreign_keys="CharacterRelationship.character_id",
        back_populates="character", cascade="all, delete-orphan")
    storylines = relationship("CharacterStoryline", back_populates="character",
        cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_characters_project', 'project_id'),
        Index('idx_characters_project_active', 'project_id', 'deleted_at'),
        Index('idx_characters_name', 'name'),
    )


class CharacterRelationship(Base):
    """角色关系"""
    __tablename__ = "character_relationships"

    id = Column(Integer, primary_key=True, autoincrement=True)
    character_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    target_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    description = Column(Text)
    strength = Column(Integer, default=5)  # 关系强度 1-10

    character = relationship("Character", foreign_keys=[character_id],
        back_populates="relationships")

    __table_args__ = (
        Index('idx_char_rel_character', 'character_id'),
        Index('idx_char_rel_target', 'target_id'),
    )


class CharacterStoryline(Base):
    """角色故事线"""
    __tablename__ = "character_storylines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    character_id = Column(Integer, ForeignKey("characters.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    arc = Column(Text)
    progress = Column(Integer, default=0)
    status = Column(String(20), default="active")

    character = relationship("Character", back_populates="storylines")


# ============================================
# World Entities (Enhanced)
# ============================================

class WorldSetting(Base, ProjectScopedMixin, SoftDeleteMixin, TimestampMixin):
    """世界观设定"""
    __tablename__ = "world_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    details_json = Column(Text)
    setting_type = Column(String(30), default="general")  # history, geography, culture...

    project = relationship("Project", back_populates="world_settings")

    __table_args__ = (
        Index('idx_world_settings_project', 'project_id'),
        Index('idx_world_settings_name', 'name'),
    )


class Rule(Base, ProjectScopedMixin, TimestampMixin):
    """规则/法则"""
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    rule_type = Column(String(30))
    severity = Column(String(20), default="normal")  # minor, normal, major, critical

    __table_args__ = (
        Index('idx_rules_project', 'project_id'),
        Index('idx_rules_type', 'rule_type'),
    )


class Item(Base, ProjectScopedMixin, SoftDeleteMixin, TimestampMixin):
    """物品"""
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    owner_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"))
    item_type = Column(String(30))
    rarity = Column(String(20), default="common")

    __table_args__ = (
        Index('idx_items_project', 'project_id'),
        Index('idx_items_name', 'name'),
    )


class Location(Base, ProjectScopedMixin, SoftDeleteMixin, TimestampMixin):
    """地点"""
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    importance = Column(String(20), default="normal")
    parent_location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"))
    location_type = Column(String(30))  # city, building, realm...

    __table_args__ = (
        Index('idx_locations_project', 'project_id'),
        Index('idx_locations_name', 'name'),
    )


class Faction(Base, ProjectScopedMixin, SoftDeleteMixin, TimestampMixin):
    """势力"""
    __tablename__ = "factions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    faction_type = Column(String(30))
    alignment = Column(String(20))  # good, evil, neutral, chaotic...

    __table_args__ = (
        Index('idx_factions_project', 'project_id'),
        Index('idx_factions_name', 'name'),
    )


# ============================================
# Story Structure (Enhanced)
# ============================================

class Chapter(Base, ProjectScopedMixin, SoftDeleteMixin, TimestampMixin):
    """章节 - 增强版"""
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    outline_id = Column(Integer, ForeignKey("outlines.id", ondelete="SET NULL"))
    title = Column(String(200))
    summary = Column(Text)
    status = Column(String(20), default="pending")
    word_count = Column(Integer, default=0)
    chapter_order = Column(Integer, default=0)
    chapter_type = Column(String(20), default="normal")
    target_word_count = Column(Integer)

    outline = relationship("Outline", back_populates="chapters")
    scenes = relationship("Scene", back_populates="chapter", order_by="Scene.scene_order")
    draft_versions = relationship("DraftVersion", back_populates="chapter",
        cascade="all, delete-orphan")
    ai_inspections = relationship("AIInspectionResult", back_populates="chapter",
        cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_chapters_project', 'project_id'),
        Index('idx_chapters_outline', 'outline_id'),
        Index('idx_chapters_order', 'chapter_order'),
        Index('idx_chapters_status', 'status'),
    )


class Scene(Base, SoftDeleteMixin, TimestampMixin):
    """场景"""
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200))
    content = Column(Text, default="")
    summary = Column(Text)
    scene_order = Column(Integer, default=0)
    word_count = Column(Integer, default=0)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"))
    time_of_day = Column(String(20))
    weather = Column(String(50))
    status = Column(String(20), default="draft")
    human_ai_ratio = Column(Float)

    chapter = relationship("Chapter", back_populates="scenes")
    location = relationship("Location")
    ai_contents = relationship("AIGeneratedContent", back_populates="scene")
    draft_versions = relationship("DraftVersion", back_populates="scene")

    __table_args__ = (
        Index('idx_scenes_chapter', 'chapter_id'),
        Index('idx_scenes_order', 'chapter_id', 'scene_order'),
    )


# ============================================
# Foreshadowing & Timeline
# ============================================

class Foreshadowing(Base, TimestampMixin):
    """伏笔追踪"""
    __tablename__ = "foreshadowings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    plant_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    plant_scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="SET NULL"))
    plant_text = Column(Text)
    resolve_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    resolve_scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="SET NULL"))
    resolve_text = Column(Text)
    status = Column(String(20), default="planted")
    importance = Column(String(20), default="normal")
    planted_by_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))
    resolved_by_character_id = Column(Integer, ForeignKey("characters.id", ondelete="SET NULL"))

    project = relationship("Project", back_populates="foreshadowings")
    plant_chapter = relationship("Chapter", foreign_keys=[plant_chapter_id])
    resolve_chapter = relationship("Chapter", foreign_keys=[resolve_chapter_id])

    __table_args__ = (
        Index('idx_foreshadowings_project', 'project_id'),
        Index('idx_foreshadowings_status', 'status'),
    )


class Timeline(Base, TimestampMixin):
    """时间线"""
    __tablename__ = "timelines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    time_unit = Column(String(20), default="chapter")

    project = relationship("Project", back_populates="timelines")
    events = relationship("TimelineEvent", back_populates="timeline",
        order_by="TimelineEvent.position")


class TimelineEvent(Base, TimestampMixin):
    """时间线事件"""
    __tablename__ = "timeline_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timeline_id = Column(Integer, ForeignKey("timelines.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    position = Column(Integer, default=0)
    time_label = Column(String(100))
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    character_ids = Column(Text)  # JSON
    event_type = Column(String(30), default="plot")

    timeline = relationship("Timeline", back_populates="events")
    chapter = relationship("Chapter")

    __table_args__ = (
        Index('idx_timeline_events_timeline', 'timeline_id'),
        Index('idx_timeline_events_position', 'timeline_id', 'position'),
    )


# ============================================
# Tag System
# ============================================

class Tag(Base, TimestampMixin):
    """标签"""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)
    color = Column(String(7), default="#5b8ee8")
    category = Column(String(30), default="general")

    project = relationship("Project", back_populates="tags")
    associations = relationship("TagAssociation", back_populates="tag",
        cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_tags_project', 'project_id'),
        Index('idx_tags_unique', 'project_id', 'name', unique=True),
    )


class TagAssociation(Base):
    """标签关联"""
    __tablename__ = "tag_associations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(String(30), nullable=False)
    entity_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    tag = relationship("Tag", back_populates="associations")

    __table_args__ = (
        Index('idx_tag_assoc_unique', 'tag_id', 'entity_type', 'entity_id', unique=True),
        Index('idx_tag_assoc_entity', 'entity_type', 'entity_id'),
    )


# ============================================
# Chat / Conversation (Interface 1)
# ============================================

class ChatSession(Base, TimestampMixin):
    """聊天会话"""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    session_type = Column(String(20), default="initialization")  # initialization, brainstorming...
    title = Column(String(200))

    project = relationship("Project", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session",
        cascade="all, delete-orphan")
    extracted_entities = relationship("ExtractedEntity", back_populates="session",
        cascade="all, delete-orphan")


class ChatMessage(Base, TimestampMixin):
    """聊天消息"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    message_metadata = Column(Text)  # JSON: tokens, model, etc.

    session = relationship("ChatSession", back_populates="messages")

    __table_args__ = (
        Index('idx_chat_messages_session', 'session_id'),
        Index('idx_chat_messages_created', 'created_at'),
    )


class ExtractedEntity(Base, TimestampMixin):
    """提取的实体"""
    __tablename__ = "extracted_entities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    entity_type = Column(String(30), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    confirmed = Column(Integer, default=0)  # 0=pending, 1=confirmed, -1=rejected
    linked_entity_id = Column(Integer)  # 确认后关联的正式实体ID
    linked_entity_type = Column(String(30))

    session = relationship("ChatSession", back_populates="extracted_entities")

    __table_args__ = (
        Index('idx_extracted_entities_session', 'session_id'),
        Index('idx_extracted_entities_confirmed', 'confirmed'),
    )


# ============================================
# Writing & Versioning (Interface 3)
# ============================================

class DraftVersion(Base, TimestampMixin):
    """草稿版本"""
    __tablename__ = "draft_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"))
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"))
    content = Column(Text, nullable=False)
    version_number = Column(Integer, nullable=False)
    change_summary = Column(String(200))
    word_count = Column(Integer)
    diff_from_previous = Column(Text)

    chapter = relationship("Chapter", back_populates="draft_versions")
    scene = relationship("Scene", back_populates="draft_versions")

    __table_args__ = (
        Index('idx_draft_versions_chapter', 'chapter_id', 'version_number'),
        Index('idx_draft_versions_scene', 'scene_id', 'version_number'),
    )


class AIGeneratedContent(Base, TimestampMixin):
    """AI生成内容"""
    __tablename__ = "ai_generated_contents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"))
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"))
    generation_type = Column(String(30), nullable=False)
    prompt = Column(Text)
    content = Column(Text, nullable=False)
    quality_score = Column(Float)
    user_rating = Column(Integer)
    is_accepted = Column(Integer, default=0)
    model_name = Column(String(50))
    tokens_used = Column(Integer)
    generation_time_ms = Column(Integer)

    scene = relationship("Scene", back_populates="ai_contents")
    chapter = relationship("Chapter")

    __table_args__ = (
        Index('idx_ai_gen_scene', 'scene_id'),
        Index('idx_ai_gen_type', 'generation_type'),
        Index('idx_ai_gen_accepted', 'is_accepted'),
    )


class PlotThread(Base, TimestampMixin):
    """情节线索"""
    __tablename__ = "plot_threads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="active")
    thread_type = Column(String(30), default="main")  # main, subplot, character_arc...
    created_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))
    reveal_chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="SET NULL"))

    __table_args__ = (
        Index('idx_plot_threads_project', 'project_id'),
        Index('idx_plot_threads_status', 'status'),
    )


class AIInspectionResult(Base, TimestampMixin):
    """AI审查结果"""
    __tablename__ = "ai_inspection_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    inspection_type = Column(String(30), nullable=False)
    issues_json = Column(Text)
    suggestions_json = Column(Text)
    auto_fixed = Column(Integer, default=0)
    fix_applied = Column(Integer, default=0)  # 是否已应用修复
    score = Column(Float)  # 综合评分

    chapter = relationship("Chapter", back_populates="ai_inspections")

    __table_args__ = (
        Index('idx_ai_inspection_chapter', 'chapter_id'),
        Index('idx_ai_inspection_type', 'inspection_type'),
    )


class EditHistory(Base):
    """编辑历史"""
    __tablename__ = "edit_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(30), nullable=False)
    entity_id = Column(Integer, nullable=False)
    field_name = Column(String(50), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    edit_type = Column(String(20), default="manual")
    diff_patch = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_edit_history_entity', 'entity_type', 'entity_id'),
        Index('idx_edit_history_created', 'created_at'),
    )


class WritingSettings(Base, TimestampMixin):
    """写作设置（项目级，覆盖用户偏好）"""
    __tablename__ = "writing_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    human_ai_ratio = Column(Float, default=0.5)
    writing_style_id = Column(Integer, ForeignKey("writing_styles.id", ondelete="SET NULL"))
    target_word_count = Column(Integer, default=3000)
    chapter_target_words = Column(Integer, default=3000)
    scene_target_words = Column(Integer, default=800)
    auto_save = Column(Integer, default=1)
    ai_suggestions = Column(Integer, default=1)

    project = relationship("Project")
    writing_style = relationship("WritingStyle")
```

---

## 9. Alembic 迁移策略

### 9.1 迁移规划

由于现有数据库已有数据，采用 **渐进式迁移**：

```
Migration Timeline:
├── Phase 1: 新增全局表（无数据依赖）
│   ├── create_genre_configurations
│   ├── create_writing_styles
│   └── create_user_preferences
│
├── Phase 2: 新增核心表（Project 作为根）
│   ├── create_projects
│   └── migrate_existing_data_to_default_project
│
├── Phase 3: 扩展现有表
│   ├── add_project_id_to_all_entities
│   ├── add_soft_delete_columns
│   └── add_enhanced_fields
│
├── Phase 4: 新增功能表
│   ├── create_scenes
│   ├── create_foreshadowings
│   ├── create_timelines
│   ├── create_timeline_events
│   ├── create_tags
│   ├── create_tag_associations
│   ├── create_ai_generated_contents
│   └── create_edit_history
│
└── Phase 5: 创建 FTS 虚拟表与触发器
    ├── create_fts_tables
    └── create_fts_triggers
```

### 9.2 示例迁移脚本

```python
"""Phase 2: Create projects and migrate existing data

Revision ID: create_projects
Revises: add_performance_indexes
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = 'create_projects'
down_revision = 'add_performance_indexes'

def upgrade():
    # 1. 创建 projects 表
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(200), nullable=False, server_default='未命名作品'),
        sa.Column('subtitle', sa.String(500)),
        sa.Column('author_name', sa.String(100), server_default=''),
        sa.Column('description', sa.Text()),
        sa.Column('genre_id', sa.Integer(), sa.ForeignKey('genre_configurations.id', ondelete='SET NULL')),
        sa.Column('sub_genre', sa.String(50)),
        sa.Column('status', sa.String(20), server_default='draft'),
        sa.Column('target_word_count', sa.Integer(), server_default='100000'),
        sa.Column('current_word_count', sa.Integer(), server_default='0'),
        sa.Column('cover_image_path', sa.String(500)),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('deleted_at', sa.DateTime()),
    )
    
    # 2. 创建默认项目
    op.execute(text("""
        INSERT INTO projects (title, status) 
        VALUES ('默认作品', 'writing')
    """))
    
    # 3. 为现有表添加 project_id 列
    tables = ['characters', 'items', 'locations', 'factions', 
              'world_settings', 'rules', 'outlines', 'chapters', 
              'if_lines', 'chat_sessions']
    
    for table in tables:
        op.add_column(table, sa.Column('project_id', sa.Integer(), 
            sa.ForeignKey('projects.id', ondelete='CASCADE')))
        # 关联到默认项目
        op.execute(text(f"UPDATE {table} SET project_id = 1"))
        # 设为 NOT NULL
        op.alter_column(table, 'project_id', nullable=False)
    
    # 4. 添加软删除列
    soft_delete_tables = ['characters', 'items', 'locations', 'factions',
                          'world_settings', 'chapters', 'scenes']
    for table in soft_delete_tables:
        op.add_column(table, sa.Column('deleted_at', sa.DateTime()))
    
    # 5. 创建索引
    op.create_index('idx_projects_status', 'projects', ['status'])
    op.create_index('idx_projects_deleted_at', 'projects', ['deleted_at'])


def downgrade():
    # 删除 project_id 列
    tables = ['characters', 'items', 'locations', 'factions',
              'world_settings', 'rules', 'outlines', 'chapters',
              'if_lines', 'chat_sessions']
    for table in tables:
        op.drop_column(table, 'project_id')
    
    # 删除软删除列
    soft_delete_tables = ['characters', 'items', 'locations', 'factions',
                          'world_settings', 'chapters', 'scenes']
    for table in soft_delete_tables:
        op.drop_column(table, 'deleted_at')
    
    op.drop_table('projects')
```

### 9.3 迁移最佳实践

1. **备份优先**：每次迁移前自动创建 `.backup` 文件
2. **事务保护**：SQLite 迁移使用 `render_as_batch=True`
3. **数据验证**：迁移后验证数据完整性
4. **回滚测试**：确保 downgrade 可用

---

## 10. 索引汇总

### 10.1 按表索引清单

| 表名 | 索引名 | 字段 | 类型 | 说明 |
|------|--------|------|------|------|
| projects | idx_projects_status | status | B-tree | 状态筛选 |
| projects | idx_projects_deleted_at | deleted_at | B-tree | 软删除过滤 |
| characters | idx_characters_project | project_id | B-tree | 项目筛选 |
| characters | idx_characters_project_active | project_id, deleted_at | B-tree | 复合筛选 |
| characters | idx_characters_name | name | B-tree | 名称搜索 |
| chapters | idx_chapters_project | project_id | B-tree | 项目筛选 |
| chapters | idx_chapters_outline | outline_id | B-tree | 大纲关联 |
| chapters | idx_chapters_order | chapter_order | B-tree | 排序 |
| chapters | idx_chapters_status | status | B-tree | 状态筛选 |
| scenes | idx_scenes_chapter | chapter_id | B-tree | 章节关联 |
| scenes | idx_scenes_order | chapter_id, scene_order | B-tree | 排序 |
| draft_versions | idx_draft_versions_chapter | chapter_id, version_number | B-tree | 版本查询 |
| draft_versions | idx_draft_versions_scene | scene_id, version_number | B-tree | 版本查询 |
| foreshadowings | idx_foreshadowings_project | project_id | B-tree | 项目筛选 |
| foreshadowings | idx_foreshadowings_status | status | B-tree | 状态筛选 |
| timeline_events | idx_timeline_events_timeline | timeline_id | B-tree | 时间线关联 |
| timeline_events | idx_timeline_events_position | timeline_id, position | B-tree | 排序 |
| tags | idx_tags_project | project_id | B-tree | 项目筛选 |
| tags | idx_tags_unique | project_id, name | Unique | 唯一约束 |
| tag_associations | idx_tag_assoc_unique | tag_id, entity_type, entity_id | Unique | 唯一约束 |
| tag_associations | idx_tag_assoc_entity | entity_type, entity_id | B-tree | 实体反查 |
| chat_messages | idx_chat_messages_session | session_id | B-tree | 会话关联 |
| chat_messages | idx_chat_messages_created | created_at | B-tree | 时间排序 |
| ai_generated_contents | idx_ai_gen_scene | scene_id | B-tree | 场景关联 |
| ai_generated_contents | idx_ai_gen_type | generation_type | B-tree | 类型筛选 |
| ai_generated_contents | idx_ai_gen_accepted | is_accepted | B-tree | 状态筛选 |
| edit_history | idx_edit_history_entity | entity_type, entity_id | B-tree | 实体反查 |
| edit_history | idx_edit_history_created | created_at | B-tree | 时间排序 |

### 10.2 FTS 虚拟表

| 虚拟表 | 搜索字段 | 关联实体 |
|--------|----------|----------|
| chapter_search | title, summary, content | chapters |
| scene_search | title, content | scenes |
| entity_search | name, description | characters, items, locations... |

---

## 11. 数据量估算与性能

### 11.1 预估数据量（单作品）

| 实体 | 数量级 | 说明 |
|------|--------|------|
| Project | 1 | 单作品 |
| Character | 50-200 | 主要角色 + 配角 |
| Chapter | 100-1000 | 网络小说常见长度 |
| Scene | 300-3000 | 每章 3-5 场景 |
| DraftVersion | 1000-10000 | 版本历史 |
| ChatMessage | 500-5000 | 初始化对话 |
| Tag | 50-200 | 标签数量 |
| Foreshadowing | 20-100 | 伏笔追踪 |
| TimelineEvent | 200-1000 | 时间线事件 |

### 11.2 性能优化建议

1. **连接池**：当前配置 pool_size=5, max_overflow=10，桌面单用户足够
2. **延迟加载**：大文本字段（content）使用 lazy loading
3. **分页**：所有列表查询默认 LIMIT 50
4. **缓存**：热点数据（如 Character 列表）应用层缓存
5. **归档**：已完成项目的旧版本可归档到单独数据库

---

## 12. 安全与隐私

### 12.1 数据加密建议

| 数据 | 加密方式 | 说明 |
|------|----------|------|
| 作品内容 (content) | AES-256-GCM | 本地密钥加密 |
| API Key | 系统密钥链 | 操作系统级存储 |
| 备份文件 | 密码加密 ZIP | 用户密码派生密钥 |

### 12.2 访问控制

- 桌面应用单用户，无多用户权限需求
- 数据库文件权限设为 600（仅所有者读写）

---

## 13. 附录

### 13.1 模型统计

| 类别 | 数量 |
|------|------|
| 现有模型（改造后） | 18 |
| 新增模型 | 12 |
| **总计** | **30** |

### 13.2 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/backend/models/entities.py` | 重写（新增 + 改造） |
| `src/backend/schema.sql` | 更新 |
| `alembic/versions/2026xxxx_create_projects.py` | 新增迁移 |
| `alembic/versions/2026xxxx_create_scenes.py` | 新增迁移 |
| `alembic/versions/2026xxxx_create_foreshadowings.py` | 新增迁移 |
| `alembic/versions/2026xxxx_create_timelines.py` | 新增迁移 |
| `alembic/versions/2026xxxx_create_tags.py` | 新增迁移 |
| `alembic/versions/2026xxxx_create_fts.py` | 新增迁移 |
| `alembic/env.py` | 更新导入 |

### 13.3 后续工作

1. [ ] 实现 FTS5 触发器自动同步
2. [ ] 编写数据迁移验证脚本
3. [ ] 设计归档/清理策略
4. [ ] 实现编辑历史的 diff 生成
5. [ ] 添加数据库健康检查端点
