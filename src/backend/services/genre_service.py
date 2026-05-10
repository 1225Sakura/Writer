# Auto Novel Writer - Genre Service
# Genre template and profile management for webnovel genres

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.domain import Project, GenreConfiguration
from backend.infrastructure.cache.cache_service import get_cache_service


# ============================================
# Genre Alias Mappings
# ============================================

GENRE_INPUT_ALIASES: dict[str, str] = {
    "修仙/玄幻": "修仙",
    "玄幻修仙": "修仙",
    "玄幻": "修仙",
    "修真": "修仙",
    "都市修真": "都市异能",
    "都市高武": "高武",
    "都市奇闻": "都市脑洞",
    "古言脑洞": "古言",
    "游戏电竞": "电竞",
    "电竞文": "电竞",
    "直播": "直播文",
    "直播带货": "直播文",
    "主播": "直播文",
    "克系": "克苏鲁",
    "克系悬疑": "克苏鲁",
}

GENRE_PROFILE_KEY_ALIASES: dict[str, str] = {
    "修仙": "xianxia",
    "修仙/玄幻": "xianxia",
    "玄幻": "xianxia",
    "爽文/系统流": "shuangwen",
    "高武": "xianxia",
    "西幻": "xianxia",
    "都市异能": "urban-power",
    "都市脑洞": "urban-power",
    "都市日常": "urban-power",
    "狗血言情": "romance",
    "古言": "romance",
    "青春甜宠": "romance",
    "替身文": "substitute",
    "规则怪谈": "rules-mystery",
    "悬疑脑洞": "mystery",
    "悬疑灵异": "mystery",
    "知乎短篇": "zhihu-short",
    "电竞": "esports",
    "直播文": "livestream",
    "克苏鲁": "cosmic-horror",
    "历史穿越": "history-travel",
    "游戏文": "game-lit",
}


# ============================================
# Genre Preset Configurations
# ============================================

GENRE_PRESETS: dict[str, dict[str, Any]] = {
    "修仙": {
        "profile_key": "xianxia",
        "description": "东方玄幻修仙题材，强调境界突破、资源争夺与长生追求",
        "core_tropes": ["境界升级", "功法传承", "天材地宝", "宗门斗争", "渡劫突破"],
        "narrative_rhythm": {
            "opening_hook": "300字内给出冲突或悬念",
            "cliffhanger_density": "每章结尾留钩",
            "power_progression": "每3章一次小突破，每10章一次大突破",
        },
        "terminology_hints": {
            "explain_on_first_use": True,
            "glossary_style": "后置解释，不中断叙事节奏",
        },
        "character_archetypes": ["废柴逆袭", "天才流", "重生者", "系统持有者", "隐世高人"],
        "world_building_focus": ["修炼体系", "宗门势力", "秘境探索", "天道规则"],
        "pressure_source": "资源争夺/境界压制",
        "release_target": "主角主动破局并拿到可见收益",
        "guidance_text": "题材加权：强化升级/对抗结果的可见反馈，术语解释后置。",
    },
    "言情": {
        "profile_key": "romance",
        "description": "情感主线驱动的爱情故事，侧重人物关系发展与情感张力",
        "core_tropes": ["误会与和解", "身份差距", "追妻火葬场", "双向暗恋", "破镜重圆"],
        "narrative_rhythm": {
            "opening_hook": "情感张力或关系悬念",
            "relationship_progression": "每章推进关系位移",
            "emotional_beats": "情绪起伏曲线，避免原地打转",
        },
        "terminology_hints": {
            "explain_on_first_use": False,
            "glossary_style": "情感描写优先，术语极简",
        },
        "character_archetypes": ["高冷男主", "甜美女主", "霸道总裁", "温柔男二", "恶毒女配"],
        "world_building_focus": ["社会阶层", "家族背景", "职场环境", "情感空间"],
        "pressure_source": "关系误解/情感拉扯",
        "release_target": "关系位移落地并形成下一步承诺",
        "guidance_text": "题材加权：每章推进关系位移，避免情绪原地打转。",
    },
    "悬疑": {
        "profile_key": "mystery",
        "description": "以解谜和推理为核心的悬疑题材，强调线索铺设与逻辑闭环",
        "core_tropes": ["密室杀人", "连环案件", "不可靠叙述", "红鲱鱼误导", "真相揭露"],
        "narrative_rhythm": {
            "opening_hook": "案件发生或异常现象",
            "clue_density": "每章至少1条可回收线索",
            "reveal_timing": "阶段性真相+更高层谜团",
        },
        "terminology_hints": {
            "explain_on_first_use": True,
            "glossary_style": "专业术语需即时解释",
        },
        "character_archetypes": ["侦探", "嫌疑人", "受害者", "幕后黑手", "助手"],
        "world_building_focus": ["案件现场", "社会关系网", "时间线", "证据链"],
        "pressure_source": "线索缺失/规则冲突",
        "release_target": "给出可验证的新线索并保留未知区",
        "guidance_text": "题材加权：线索必须可回收，优先以规则冲突制造悬念。",
    },
    "科幻": {
        "profile_key": "sci-fi",
        "description": "科学幻想题材，探索技术、宇宙与人性的边界",
        "core_tropes": ["太空探索", "人工智能", "时间旅行", "基因改造", "末日生存"],
        "narrative_rhythm": {
            "opening_hook": "科幻概念或危机场景",
            "world_reveal": "逐步展开世界观，避免信息_dump",
            "tech_balance": "科技与人性并重",
        },
        "terminology_hints": {
            "explain_on_first_use": True,
            "glossary_style": "概念嵌入叙事自然解释",
        },
        "character_archetypes": ["科学家", "宇航员", "AI", "反叛者", "幸存者"],
        "world_building_focus": ["科技体系", "社会结构", "宇宙法则", "伦理困境"],
        "pressure_source": "未知威胁/资源枯竭",
        "release_target": "科技或智慧突破带来阶段性解决",
        "guidance_text": "题材加权：科幻设定需服务于人物冲突，避免纯设定展示。",
    },
    "都市异能": {
        "profile_key": "urban-power",
        "description": "现代都市背景下的超能力/系统流题材",
        "core_tropes": ["系统觉醒", "扮猪吃虎", "都市修仙", "商业帝国", "神医归来"],
        "narrative_rhythm": {
            "opening_hook": "能力觉醒或身份揭示",
            "social_feedback_chain": "他人反应→资源变化→地位变化",
            "face_slapping_density": "适度打脸，避免重复套路",
        },
        "terminology_hints": {
            "explain_on_first_use": True,
            "glossary_style": "系统提示简洁明了",
        },
        "character_archetypes": ["赘婿", "退役兵王", "神医", "富二代", "草根逆袭"],
        "world_building_focus": ["都市阶层", "商业规则", "异能体系", "人际关系网"],
        "pressure_source": "阶层卡位/权力压制",
        "release_target": "主角通过资源博弈拿到地位与回报",
        "guidance_text": "题材加权：优先写社会反馈链（他人反应→资源变化→地位变化）。",
    },
    "规则怪谈": {
        "profile_key": "rules-mystery",
        "description": "以诡异规则为核心的恐怖悬疑题材",
        "core_tropes": ["规则悖论", "认知污染", "代价递增", "规则破解", "生存博弈"],
        "narrative_rhythm": {
            "opening_hook": "规则宣告或异常触发",
            "rule_reveal": "规则先于解释，代价先于胜利",
            "escalation": "每章规则复杂度递增",
        },
        "terminology_hints": {
            "explain_on_first_use": False,
            "glossary_style": "规则即文本，不额外解释",
        },
        "character_archetypes": ["规则破解者", "受害者", "规则制定者", "观察者"],
        "world_building_focus": ["规则体系", "异常空间", "认知边界", "代价机制"],
        "pressure_source": "规则反噬/代价递增",
        "release_target": "用代价换突破并留下更高阶规则问题",
        "guidance_text": "题材加权：规则先于解释，代价先于胜利。",
    },
    "爽文/系统流": {
        "profile_key": "shuangwen",
        "description": "以爽快阅读体验为核心，强调即时反馈与碾压快感",
        "core_tropes": ["系统金手指", "签到奖励", "无限升级", "碾压对手", "收获满满"],
        "narrative_rhythm": {
            "opening_hook": "困境+金手指降临",
            "reward_density": "高频奖励反馈",
            "contrast_emphasis": "主爽点外叠加副轴反差",
        },
        "terminology_hints": {
            "explain_on_first_use": True,
            "glossary_style": "系统提示直接展示",
        },
        "character_archetypes": ["系统宿主", "反派嘲讽者", "震惊围观者", "追随者"],
        "world_building_focus": ["升级体系", "奖励机制", "对比体系", "爽点地图"],
        "pressure_source": "嘲讽/轻视/资源匮乏",
        "release_target": "碾压式胜利+丰厚回报",
        "guidance_text": "题材加权：维持高爽点密度，主爽点外叠加一个副轴反差。",
    },
    "知乎短篇": {
        "profile_key": "zhihu-short",
        "description": "知乎体短篇故事，强调反转与高密度叙事",
        "core_tropes": ["第一人称", "信息落差", "结尾反转", "立场对撞", "金句收尾"],
        "narrative_rhythm": {
            "opening_hook": "第一句话抓人",
            "compression": "压缩铺垫，直达核心",
            "ending_hook": "高强度结尾钩或反转",
        },
        "terminology_hints": {
            "explain_on_first_use": False,
            "glossary_style": "极简，不解释",
        },
        "character_archetypes": ["叙述者", "对立者", "反转角色", "旁观者"],
        "world_building_focus": ["核心冲突场景", "信息差", "反转机制"],
        "pressure_source": "信息落差/立场对撞",
        "release_target": "反转兑现并形成高强度尾钩",
        "guidance_text": "题材加权：压缩铺垫，优先反转与高强度结尾钩。",
    },
    "电竞": {
        "profile_key": "esports",
        "description": "电子竞技题材，聚焦比赛对抗与职业成长",
        "core_tropes": ["关键团战", "战术博弈", "职业选手", "逆风翻盘", "冠军之路"],
        "narrative_rhythm": {
            "opening_hook": "比赛开始或战术布置",
            "match_pacing": "每场对抗至少写清一个战术决策点",
            "climax_structure": "团战→局势变化→情绪释放",
        },
        "terminology_hints": {
            "explain_on_first_use": True,
            "glossary_style": "游戏术语适度解释",
        },
        "character_archetypes": ["天才选手", "教练", "队友", "对手", "解说"],
        "world_building_focus": ["游戏机制", "战队生态", "赛事体系", "版本变化"],
        "pressure_source": "战术压制/节奏失衡",
        "release_target": "关键决策生效并转化为局势优势",
        "guidance_text": "题材加权：每场对抗至少写清一个战术决策点与其后果。",
    },
    "直播文": {
        "profile_key": "livestream",
        "description": "直播题材，强调即时互动与数据反馈",
        "core_tropes": ["直播系统", "弹幕互动", "数据暴涨", "打脸观众", "全网震惊"],
        "narrative_rhythm": {
            "opening_hook": "直播开始或争议事件",
            "feedback_loop": "外部反馈→主角反制→数据变化",
            "realtime_pacing": "即时闭环，快速反馈",
        },
        "terminology_hints": {
            "explain_on_first_use": True,
            "glossary_style": "平台术语简洁",
        },
        "character_archetypes": ["主播", "黑粉", "铁粉", "平台运营", "对手主播"],
        "world_building_focus": ["直播平台", "流量机制", "观众心理", "内容创作"],
        "pressure_source": "舆论波动/数据下滑",
        "release_target": "当场反制形成可见数据回弹",
        "guidance_text": "题材加权：强化'外部反馈→主角反制→数据变化'即时闭环。",
    },
    "克苏鲁": {
        "profile_key": "cosmic-horror",
        "description": "克苏鲁神话风格恐怖题材，强调认知崩溃与不可名状",
        "core_tropes": ["古神低语", "认知污染", "调查员", "疯狂边缘", "不可名状"],
        "narrative_rhythm": {
            "opening_hook": "异常迹象或古老传说",
            "horror_building": "恐怖来源于规则与代价",
            "sanity_management": "逐步侵蚀，非jump scare",
        },
        "terminology_hints": {
            "explain_on_first_use": False,
            "glossary_style": "不解释，保持神秘",
        },
        "character_archetypes": ["调查员", " cultist", "受害者", "知情者", "疯狂者"],
        "world_building_focus": ["古神体系", "认知边界", "疯狂机制", "禁忌知识"],
        "pressure_source": "认知失真/规则侵蚀",
        "release_target": "以明确代价换阶段性生存窗口",
        "guidance_text": "题材加权：恐怖来源于规则与代价，不依赖空泛惊悚形容。",
    },
    "历史穿越": {
        "profile_key": "history-travel",
        "description": "穿越历史题材，利用现代知识改变历史进程",
        "core_tropes": ["穿越觉醒", "知识优势", "历史事件干预", "礼教冲突", "科技树攀爬"],
        "narrative_rhythm": {
            "opening_hook": "穿越场景或历史危机",
            "knowledge_payoff": "知识优势兑现并引发连锁反应",
            "history_balance": "尊重历史框架，合理改编",
        },
        "terminology_hints": {
            "explain_on_first_use": True,
            "glossary_style": "古今对比自然融入",
        },
        "character_archetypes": ["穿越者", "历史人物", "保守派", "改革派", "帝王"],
        "world_building_focus": ["历史背景", "科技差距", "社会制度", "文化冲突"],
        "pressure_source": "历史惯性/礼教阻力",
        "release_target": "知识优势兑现并引发新的连锁反应",
        "guidance_text": "题材加权：知识优势需有合理实现路径，避免过度开金手指。",
    },
    "游戏文": {
        "profile_key": "game-lit",
        "description": "游戏异界/网游题材，强调游戏机制与角色成长",
        "core_tropes": ["游戏穿越", "属性面板", "副本攻略", "公会战争", "隐藏职业"],
        "narrative_rhythm": {
            "opening_hook": "进入游戏或发现异常",
            "mechanics_integration": "数值突破并暴露更高层级威胁",
            "progression_loop": "挑战→成长→新挑战",
        },
        "terminology_hints": {
            "explain_on_first_use": True,
            "glossary_style": "游戏术语直接展示",
        },
        "character_archetypes": ["玩家", "NPC", "GM", "公会会长", "独行侠"],
        "world_building_focus": ["游戏机制", "职业体系", "副本设计", "经济系统"],
        "pressure_source": "系统规则限制/资源稀缺",
        "release_target": "数值突破并暴露更高层级威胁",
        "guidance_text": "题材加权：游戏机制需清晰，数值变化可视化。",
    },
}


# ============================================
# Alias Normalization Functions
# ============================================

def normalize_genre_token(token: str) -> str:
    """Normalize a genre token through input aliases."""
    value = str(token or "").strip()
    if not value:
        return ""
    return GENRE_INPUT_ALIASES.get(value, value)


def to_profile_key(genre: str) -> str:
    """Convert a genre name to its profile key."""
    value = str(genre or "").strip()
    if not value:
        return ""
    normalized = normalize_genre_token(value)
    return GENRE_PROFILE_KEY_ALIASES.get(normalized, normalized.lower())


def parse_genre_tokens(
    genre_raw: str,
    *,
    support_composite: bool = True,
    separators: tuple[str, ...] = ("/", "+", "，", ",", "、"),
) -> List[str]:
    """Parse genre string into normalized tokens."""
    text = str(genre_raw or "").strip()
    if not text:
        return []

    if not support_composite:
        normalized_single = normalize_genre_token(text)
        return [normalized_single] if normalized_single else [text]

    pattern = "|".join(re.escape(str(token)) for token in separators if str(token))
    if not pattern:
        normalized_single = normalize_genre_token(text)
        return [normalized_single] if normalized_single else [text]

    tokens = [chunk.strip() for chunk in re.split(pattern, text) if chunk and chunk.strip()]
    deduped: List[str] = []
    seen = set()
    for token in tokens:
        normalized_token = normalize_genre_token(token)
        if not normalized_token:
            continue
        lower = normalized_token.lower()
        if lower in seen:
            continue
        seen.add(lower)
        deduped.append(normalized_token)
    if deduped:
        return deduped

    fallback_token = normalize_genre_token(text)
    return [fallback_token] if fallback_token else [text]


def build_composite_genre_hints(genres: List[str], refs: Optional[List[str]] = None) -> List[str]:
    """Build hints for composite genre combinations."""
    if len(genres) <= 1:
        return []

    primary = genres[0]
    secondaries = genres[1:]
    hints: List[str] = []
    hints.append(
        f"以\"{primary}\"作为主引擎推进主线，每章至少保留1处\"{'/'.join(secondaries)}\"特征表达。"
    )
    if refs:
        hints.append(f"复合题材执行参考：{refs[0]}")
    hints.append("主辅题材冲突时，优先保证主题材读者承诺，辅题材用于制造新鲜感。")
    return hints


# ============================================
# Genre Service Class
# ============================================

class GenreService:
    """Service for managing genre templates and profiles."""

    def __init__(self, db: AsyncSession):
        self.db = db

    def list_genre_presets(self) -> List[Dict[str, Any]]:
        """List all available genre presets."""
        return [
            {
                "name": name,
                "profile_key": preset["profile_key"],
                "description": preset["description"],
                "core_tropes": preset.get("core_tropes", []),
            }
            for name, preset in GENRE_PRESETS.items()
        ]

    def get_genre_preset(self, genre: str) -> Optional[Dict[str, Any]]:
        """Get a specific genre preset by name or profile key."""
        normalized = normalize_genre_token(genre)
        if normalized in GENRE_PRESETS:
            return dict(GENRE_PRESETS[normalized])

        # Try profile key reverse lookup
        for name, preset in GENRE_PRESETS.items():
            if preset["profile_key"] == genre or preset["profile_key"] == to_profile_key(genre):
                return dict(preset)

        return None

    def get_genre_profile(self, genre: str) -> Dict[str, Any]:
        """Build a complete genre profile for a genre name."""
        tokens = parse_genre_tokens(genre)
        if not tokens:
            return self._build_default_profile(genre)

        primary_token = tokens[0]
        preset = self.get_genre_preset(primary_token)

        if not preset:
            return self._build_default_profile(genre)

        profile = {
            "genre": primary_token,
            "profile_key": preset["profile_key"],
            "description": preset["description"],
            "core_tropes": preset.get("core_tropes", []),
            "narrative_rhythm": preset.get("narrative_rhythm", {}),
            "terminology_hints": preset.get("terminology_hints", {}),
            "character_archetypes": preset.get("character_archetypes", []),
            "world_building_focus": preset.get("world_building_focus", []),
            "pressure_source": preset.get("pressure_source", "生存目标/资源竞争"),
            "release_target": preset.get("release_target", "主角完成阶段目标并留下新的行动理由"),
            "guidance_text": preset.get("guidance_text", ""),
            "reference_hints": [],
        }

        # Add composite hints if multiple genres
        if len(tokens) > 1:
            profile["composite_hints"] = build_composite_genre_hints(tokens)
            profile["secondary_genres"] = tokens[1:]

        return profile

    def _build_default_profile(self, genre: str) -> Dict[str, Any]:
        """Build a default profile for unknown genres."""
        return {
            "genre": genre,
            "profile_key": to_profile_key(genre) or "general",
            "description": f"自定义题材：{genre}",
            "core_tropes": [],
            "narrative_rhythm": {
                "opening_hook": "章首300字内给出目标与阻力",
                "cliffhanger_density": "章末保留未闭合问题",
            },
            "terminology_hints": {
                "explain_on_first_use": True,
                "glossary_style": "首次出现时自然解释",
            },
            "character_archetypes": [],
            "world_building_focus": [],
            "pressure_source": "生存目标/资源竞争",
            "release_target": "主角完成阶段目标并留下新的行动理由",
            "guidance_text": "本章执行默认高可读策略：冲突前置、信息后置、段末留钩。",
            "reference_hints": [],
        }

    async def get_project_genre(self, project_id: int) -> Optional[str]:
        """Get the genre of a project."""
        result = await self.db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()
        return project.genre if project else None

    async def apply_genre_to_project(
        self, project_id: int, genre: str
    ) -> Dict[str, Any]:
        """Apply a genre to a project and store configuration."""
        result = await self.db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Normalize genre
        tokens = parse_genre_tokens(genre)
        primary_genre = tokens[0] if tokens else genre
        normalized_genre = normalize_genre_token(primary_genre)

        # Update project genre
        project.genre = normalized_genre

        # Build and store genre configuration
        profile = self.get_genre_profile(genre)

        # Check for existing genre configuration
        config_result = await self.db.execute(
            select(GenreConfiguration).where(GenreConfiguration.genre == normalized_genre)
        )
        config = config_result.scalar_one_or_none()

        if config:
            config.config_json = json.dumps(profile, ensure_ascii=False)
        else:
            config = GenreConfiguration(
                genre=normalized_genre,
                config_json=json.dumps(profile, ensure_ascii=False),
            )
            self.db.add(config)

        await self.db.flush()
        get_cache_service().clear_entity_cache("genre_config")

        return {
            "project_id": project_id,
            "genre": normalized_genre,
            "profile": profile,
            "applied_at": project.updated_at.isoformat() if project.updated_at else None,
        }

    async def get_project_genre_profile(self, project_id: int) -> Optional[Dict[str, Any]]:
        """Get the genre profile for a project."""
        genre = await self.get_project_genre(project_id)
        if not genre:
            return None
        return self.get_genre_profile(genre)

    def get_all_aliases(self) -> Dict[str, List[str]]:
        """Get all genre alias mappings."""
        # Build reverse mapping: canonical -> aliases
        reverse_input: Dict[str, List[str]] = {}
        for alias, canonical in GENRE_INPUT_ALIASES.items():
            if canonical not in reverse_input:
                reverse_input[canonical] = []
            if alias != canonical:
                reverse_input[canonical].append(alias)

        reverse_profile: Dict[str, List[str]] = {}
        for canonical, profile_key in GENRE_PROFILE_KEY_ALIASES.items():
            if profile_key not in reverse_profile:
                reverse_profile[profile_key] = []
            if canonical not in reverse_profile[profile_key]:
                reverse_profile[profile_key].append(canonical)

        return {
            "input_aliases": reverse_input,
            "profile_key_aliases": reverse_profile,
            "all_mappings": {
                "input": GENRE_INPUT_ALIASES,
                "profile_key": GENRE_PROFILE_KEY_ALIASES,
            },
        }

    async def build_profile_from_chapters(
        self, project_id: int, chapter_contents: List[str]
    ) -> Dict[str, Any]:
        """Build a genre profile from existing chapter contents."""
        if not chapter_contents:
            return self._build_default_profile("")

        # Simple frequency-based analysis
        all_text = "\n".join(chapter_contents)
        word_count = len(all_text)

        # Detect genre indicators from text
        genre_indicators: Dict[str, List[str]] = {
            "修仙": ["境界", "灵气", "功法", "丹田", "渡劫", "元婴", "金丹", "筑基", "飞升"],
            "言情": ["心动", "喜欢", "爱情", "表白", "分手", "约会", "婚纱", "戒指"],
            "悬疑": ["尸体", "凶手", "线索", "推理", "密室", "谋杀", "侦探", "真相"],
            "科幻": ["飞船", "星球", "人工智能", "基因", "太空", "未来", "机器人", "量子"],
            "都市异能": ["系统", "签到", "奖励", "属性", "技能", "等级", "任务", "商城"],
            "规则怪谈": ["规则", "违反", "代价", "诡异", "不可", "禁止", "必须", "否则"],
            "爽文/系统流": ["系统提示", "恭喜", "获得", "升级", "碾压", "震惊", "废物", "天才"],
            "电竞": ["比赛", "团战", "击杀", "打野", "ADC", "中单", "BP", "水晶"],
            "直播文": ["直播间", "弹幕", "打赏", "粉丝", "PK", "连麦", "主播", "平台"],
            "克苏鲁": ["古神", "疯狂", "不可名状", "低语", "深渊", "san值", "触手", "仪式"],
            "历史穿越": ["穿越", "古代", "朝代", "皇帝", "科举", "火药", "造纸", "印刷"],
            "游戏文": ["副本", "BOSS", "装备", "属性点", "公会", "NPC", "任务链", "隐藏"],
        }

        scores: Dict[str, int] = {}
        for genre, indicators in genre_indicators.items():
            score = sum(all_text.count(indicator) for indicator in indicators)
            if score > 0:
                scores[genre] = score

        # Determine primary genre
        if scores:
            primary_genre = max(scores.items(), key=lambda x: x[1])[0]
        else:
            primary_genre = "通用"

        # Build vocabulary frequency (top 50 words)
        import re as _re
        words = _re.findall(r'[\u4e00-\u9fff]{2,4}', all_text)
        from collections import Counter
        word_freq = Counter(words)
        top_words = [word for word, _ in word_freq.most_common(50)]

        # Sentence patterns
        sentences = _re.split(r'[。！？\n]', all_text)
        avg_sentence_length = sum(len(s) for s in sentences) / max(len(sentences), 1)

        profile = {
            "detected_genre": primary_genre,
            "genre_scores": scores,
            "vocabulary": {
                "top_words": top_words,
                "total_unique_words": len(word_freq),
            },
            "syntax": {
                "average_sentence_length": round(avg_sentence_length, 2),
                "total_sentences": len(sentences),
            },
            "statistics": {
                "total_chapters": len(chapter_contents),
                "total_word_count": word_count,
                "average_chapter_length": word_count // max(len(chapter_contents), 1),
            },
            "preset_profile": self.get_genre_profile(primary_genre),
        }

        return profile
