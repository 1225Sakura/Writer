"""Setting Physics Enforcer - checks for violations of world physics/rules.

quick_scan: Detects hard rule violations via pattern matching
            (e.g. cultivation realm jumps, magic system violations).
deep_analyze: Uses AI to detect subtle worldview logic inconsistencies.
"""

from __future__ import annotations

import json
import re
from typing import Any

from .base import BaseChecker, CheckerResult
from backend.core.services.ai.ai_service import AIService
from backend.config import settings
from ..utils import MiniMaxAPIClient


class SettingPhysicsEnforcer(BaseChecker):
    """Enforces world physics and hard rules.

    Checks that the narrative respects established cultivation systems,
    magic rules, power levels, and world logic.
    """

    # Common cultivation realm patterns (Chinese web novels)
    CULTIVATION_KEYWORDS = [
        "练气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "大乘", "渡劫",
        "先天", "后天", "宗师", "大宗师", "武圣", "武帝",
        "斗者", "斗师", "大斗师", "斗灵", "斗王", "斗皇", "斗宗", "斗尊", "斗圣", "斗帝",
        "魂士", "魂师", "大魂师", "魂尊", "魂宗", "魂王", "魂帝", "魂圣", "斗罗",
        "学徒", "正式法师", "大法师", "魔导师", "圣魔导师", "法神",
    ]

    # Power level indicators
    POWER_INDICATORS = [
        "境界", "修为", "实力", "等级", "层次", "阶段",
        "突破", "晋升", "进阶", "升级", "跨越",
    ]

    def __init__(self, ai_service: AIService | None = None) -> None:
        super().__init__(
            name="setting_physics",
            description="检查正文是否违反世界观的物理/规则一致性（修仙体系、魔法规则、力量层级等）",
        )
        self._ai_service = ai_service
        self._api_client = MiniMaxAPIClient(ai_service) if ai_service else None

    # ------------------------------------------------------------------
    # quick_scan – heuristic / pattern based
    # ------------------------------------------------------------------

    async def quick_scan(self, content: str) -> CheckerResult:
        """Heuristic scan for hard rule violations.

        Detects:
        - Sudden cultivation realm jumps without explanation
        - Magic system violations (using forbidden spells)
        - Power level inconsistencies
        - Timeline/age contradictions with power levels
        """
        issues: list[dict[str, Any]] = []
        suggestions: list[str] = []
        score = 100

        text = content or ""

        # 1. Detect cultivation realm mentions and check for jumps
        realm_mentions = []
        for realm in self.CULTIVATION_KEYWORDS:
            for match in re.finditer(re.escape(realm), text):
                # Get surrounding sentence for context
                start = max(0, match.start() - 50)
                end = min(len(text), match.end() + 50)
                context = text[start:end].replace("\n", " ")
                realm_mentions.append({
                    "realm": realm,
                    "position": match.start(),
                    "context": context,
                })

        if len(realm_mentions) >= 2:
            # Check if multiple different realms appear for same character
            unique_realms = list(dict.fromkeys([m["realm"] for m in realm_mentions]))
            if len(unique_realms) >= 2:
                # Check for "突破" or "晋升" keywords near realm changes
                has_breakthrough = any(kw in text for kw in ["突破", "晋升", "进阶", "顿悟", "闭关"])
                if not has_breakthrough:
                    issues.append({
                        "type": "realm_jump_without_explanation",
                        "severity": "high",
                        "message": f"检测到 {len(unique_realms)} 个不同境界提及，但未发现突破/晋升描写",
                        "details": {
                            "realms": unique_realms[:5],
                            "mentions": len(realm_mentions),
                        },
                    })
                    suggestions.append("境界提升应有合理的突破过程描写，避免角色实力突然变化")
                    score -= 20

        # 2. Magic system violations
        magic_violation_patterns = [
            (r"禁咒.*?(?:随意|轻松|随手)", "轻易使用禁咒级魔法"),
            (r"(?:没有|无需).*?(?:魔力|灵力|斗气).*?施展", "无能量施展技能"),
            (r"(?:越级|跨境界).*?(?:击杀|战胜|碾压).*?(?:没有|无).*?(?:代价|损伤|反噬)", "无代价越级战斗"),
        ]

        for pattern, desc in magic_violation_patterns:
            if re.search(pattern, text):
                issues.append({
                    "type": "magic_system_violation",
                    "severity": "high",
                    "message": f"检测到可能的魔法/力量体系违规: {desc}",
                })
                suggestions.append(f"请确认{desc}是否符合已设定的力量体系规则")
                score -= 15

        # 3. Power level inconsistency
        # Detect phrases where weak character easily defeats strong one without reason
        power_inconsistency_patterns = [
            r"(?:区区|仅仅|只是).*?(?:练气|先天|后天).*?(?:击败|击杀|碾压).*?(?:元婴|化神|大乘)",
            r"(?:毫无|没有).*?(?:费力|困难|压力).*?(?:击败|战胜).*?(?:高|强).*?(?:境界|等级|修为)",
        ]

        for pattern in power_inconsistency_patterns:
            match = re.search(pattern, text)
            if match:
                issues.append({
                    "type": "power_level_inconsistency",
                    "severity": "high",
                    "message": "检测到可能的战力体系崩坏：低境界角色无代价击败高境界角色",
                    "evidence": match.group(0),
                })
                suggestions.append("跨境界战斗应有合理铺垫（如特殊法宝、阵法、偷袭、代价等）")
                score -= 25

        # 4. Timeline/age contradictions
        age_contradiction_patterns = [
            (r"(?:十岁|十几岁|年幼).*?(?:元婴|化神|大乘|武帝)", "年龄与境界严重不符"),
            (r"(?:修炼|修行).*?(?:仅仅|只|才).*?(?:几年|数月).*?(?:突破|达到).*?(?:高|顶级)", "修炼时间与境界不符"),
        ]

        for pattern, desc in age_contradiction_patterns:
            if re.search(pattern, text):
                issues.append({
                    "type": "timeline_contradiction",
                    "severity": "medium",
                    "message": f"检测到可能的时间线矛盾: {desc}",
                })
                suggestions.append("天才角色的快速突破应有特殊设定支撑（如特殊体质、传承、时间流速差异等）")
                score -= 15

        # 5. Rule contradiction detection
        rule_contradiction_markers = [
            "违反规则", "打破规则", "无视法则", "超越极限", "不可能",
        ]
        for marker in rule_contradiction_markers:
            if marker in text:
                # Check if there's explanation for rule breaking
                has_explanation = any(
                    kw in text for kw in ["因为", "由于", "借助", "凭借", "特殊", "秘法"]
                )
                if not has_explanation:
                    issues.append({
                        "type": "unexplained_rule_breaking",
                        "severity": "medium",
                        "message": f"检测到'{marker}'描述，但未找到合理的规则突破解释",
                    })
                    suggestions.append("打破世界规则应有充分设定支撑，避免无解释的破格行为")
                    score -= 10

        score = max(0, score)
        return CheckerResult(score=score, issues=issues, suggestions=suggestions)

    # ------------------------------------------------------------------
    # deep_analyze – AI powered
    # ------------------------------------------------------------------

    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Deep AI analysis for subtle worldview logic inconsistencies.

        Args:
            content: Chapter text to analyze.
            context: Must contain 'world_settings', 'rules', and optionally
                     'characters', 'power_system', 'previous_chapters'.
        """
        if not self._api_client:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "configuration_error",
                    "message": "SettingPhysicsEnforcer 未配置 AI 服务",
                }],
                suggestions=["请在初始化时传入 ai_service 参数"],
            )

        world_settings = context.get("world_settings", {})
        world_text = (
            world_settings if isinstance(world_settings, str)
            else json.dumps(world_settings, ensure_ascii=False, indent=2)
        )

        rules = context.get("rules", [])
        rules_text = (
            rules if isinstance(rules, str)
            else json.dumps(rules, ensure_ascii=False, indent=2)
        )

        power_system = context.get("power_system", {})
        power_text = (
            power_system if isinstance(power_system, str)
            else json.dumps(power_system, ensure_ascii=False, indent=2)
        )

        characters = context.get("characters", [])
        chars_text = (
            characters if isinstance(characters, str)
            else json.dumps(characters, ensure_ascii=False, indent=2)
        )

        previous_chapters = context.get("previous_chapters", [])
        prev_text = (
            previous_chapters if isinstance(previous_chapters, str)
            else json.dumps(previous_chapters, ensure_ascii=False, indent=2)
        )

        prompt = f"""请深度分析以下章节内容是否违反了世界观的物理规则和逻辑一致性。

【章节内容】
{content}

【世界观设定】
{world_text}

【世界规则】
{rules_text}

【力量体系】
{power_text}

【角色当前状态】
{chars_text}

【前文摘要】
{prev_text}

请从以下维度分析：
1. **力量体系一致性**：角色使用的力量/技能是否与其当前境界/等级匹配
2. **规则约束遵守**：世界规则（如魔法限制、天道法则、物理定律）是否被无解释地打破
3. **因果逻辑**：事件因果关系是否合理（如付出与收获是否匹配，代价与收益是否平衡）
4. **资源守恒**：能量、资源、物品的消耗与获取是否符合守恒原则
5. **空间/时间逻辑**：场景转换、时间流逝、距离移动是否符合物理逻辑
6. **群体行为逻辑**：群体反应、势力行为是否符合其设定立场和利益

请以JSON格式返回：
{{
    "score": 0-100的评分,
    "issues": [
        {{
            "type": "问题类型",
            "severity": "critical|high|medium|low",
            "message": "问题描述",
            "evidence": "正文中的证据片段",
            "rule_violated": "违反的具体规则"
        }}
    ],
    "suggestions": ["改进建议列表"]
}}"""

        system_prompt = (
            "你是一位严格的世界观物理执法官。你的任务是确保正文内容完全符合"
            "已建立的世界规则、力量体系和物理逻辑。任何无合理解释的破格行为"
            "都应被标记。评分标准：100=完全合规，80=轻微偏离，60=明显偏离，"
            "40=严重偏离，20=重大违规，0=完全崩坏。"
        )

        try:
            ai_result = await self._api_client.call(
                system_prompt=system_prompt,
                user_content=prompt,
                temperature=settings.ai_temperature,
            )

            try:
                parsed = json.loads(ai_result)
                return CheckerResult(
                    score=parsed.get("score", 70),
                    issues=parsed.get("issues", []),
                    suggestions=parsed.get("suggestions", []),
                )
            except json.JSONDecodeError:
                return CheckerResult(
                    score=70,
                    issues=[{
                        "type": "parse_error",
                        "severity": "low",
                        "message": f"AI返回格式错误，原始响应: {ai_result[:200]}",
                    }],
                    suggestions=["请重试深度分析"],
                )

        except Exception as e:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "analysis_error",
                    "severity": "critical",
                    "message": f"世界观物理执法分析失败: {str(e)}",
                }],
                suggestions=["请检查AI服务配置或稍后重试"],
            )
