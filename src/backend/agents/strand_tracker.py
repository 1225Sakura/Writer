"""StrandTracker — 情节线（Strand）比例追踪与健康分析.

功能：
1. 追踪情节线比例：主线 / 副线 / IF线 的分布
2. 红线检查：检查是否偏离预设的情节线比例（如主线应占 60%+）
3. 生成情节线健康报告：各线比例、偏离度、建议调整
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..models.entities import Chapter, IFLine, Outline


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------

@dataclass
class StrandRatio:
    """单条情节线的比例统计."""

    strand_id: str
    strand_name: str
    strand_type: str  # main / sub / if
    word_count: int = 0
    chapter_count: int = 0
    ratio: float = 0.0  # 占总字数比例
    target_ratio: float = 0.0  # 预设目标比例
    deviation: float = 0.0  # 偏离度 (ratio - target_ratio)


@dataclass
class RedLineCheck:
    """红线检查结果."""

    rule_name: str
    passed: bool
    severity: str  # error / warning / info
    message: str
    actual_value: float
    threshold_value: float


@dataclass
class StrandAdjustment:
    """调整建议."""

    strand_id: str
    strand_name: str
    current_ratio: float
    target_ratio: float
    suggestion: str
    priority: str = "medium"  # high / medium / low


@dataclass
class StrandAnalysisReport:
    """情节线健康分析报告."""

    total_word_count: int = 0
    total_chapter_count: int = 0
    strand_ratios: list[StrandRatio] = field(default_factory=list)
    red_line_checks: list[RedLineCheck] = field(default_factory=list)
    adjustments: list[StrandAdjustment] = field(default_factory=list)
    overall_health_score: float = 1.0  # 0.0 ~ 1.0
    summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        """序列化为字典."""
        return {
            "total_word_count": self.total_word_count,
            "total_chapter_count": self.total_chapter_count,
            "strand_ratios": [
                {
                    "strand_id": r.strand_id,
                    "strand_name": r.strand_name,
                    "strand_type": r.strand_type,
                    "word_count": r.word_count,
                    "chapter_count": r.chapter_count,
                    "ratio": round(r.ratio, 3),
                    "target_ratio": round(r.target_ratio, 3),
                    "deviation": round(r.deviation, 3),
                }
                for r in self.strand_ratios
            ],
            "red_line_checks": [
                {
                    "rule_name": c.rule_name,
                    "passed": c.passed,
                    "severity": c.severity,
                    "message": c.message,
                    "actual_value": round(c.actual_value, 3),
                    "threshold_value": round(c.threshold_value, 3),
                }
                for c in self.red_line_checks
            ],
            "adjustments": [
                {
                    "strand_id": a.strand_id,
                    "strand_name": a.strand_name,
                    "current_ratio": round(a.current_ratio, 3),
                    "target_ratio": round(a.target_ratio, 3),
                    "suggestion": a.suggestion,
                    "priority": a.priority,
                }
                for a in self.adjustments
            ],
            "overall_health_score": round(self.overall_health_score, 3),
            "summary": self.summary,
        }


# ---------------------------------------------------------------------------
# StrandTracker
# ---------------------------------------------------------------------------

class StrandTracker:
    """情节线追踪器 — 分析主线/副线/IF线的分布与健康度.

    不继承 BaseAgent，作为独立的数据分析类.
    """

    # 默认红线规则
    DEFAULT_RULES: dict[str, dict[str, Any]] = {
        "main_line_dominance": {
            "name": "主线占比不低于 60%",
            "threshold": 0.60,
            "severity": "error",
            "target_type": "main",
            "operator": ">=",
        },
        "if_line_ceiling": {
            "name": "IF 线占比不超过 30%",
            "threshold": 0.30,
            "severity": "warning",
            "target_type": "if",
            "operator": "<=",
        },
        "sub_line_balance": {
            "name": "副线占比不超过 25%",
            "threshold": 0.25,
            "severity": "warning",
            "target_type": "sub",
            "operator": "<=",
        },
    }

    def __init__(
        self,
        rules: dict[str, dict[str, Any]] | None = None,
        target_ratios: dict[str, float] | None = None,
    ) -> None:
        """初始化追踪器.

        Args:
            rules: 自定义红线规则，覆盖默认规则
            target_ratios: 各情节线类型的目标比例，如 {"main": 0.65, "sub": 0.15, "if": 0.20}
        """
        self._rules = {**self.DEFAULT_RULES, **(rules or {})}
        self._target_ratios: dict[str, float] = target_ratios or {
            "main": 0.65,
            "sub": 0.15,
            "if": 0.20,
        }

    # ------------------------------------------------------------------
    # 核心分析入口
    # ------------------------------------------------------------------

    async def analyze(
        self,
        chapters: list[Chapter],
        outlines: list[Outline] | None = None,
        if_lines: list[IFLine] | None = None,
        chapter_strand_map: dict[int, list[str]] | None = None,
    ) -> StrandAnalysisReport:
        """分析情节线分布并生成健康报告.

        Args:
            chapters: 章节列表
            outlines: 大纲列表（用于关联主线）
            if_lines: IF 线列表
            chapter_strand_map: 章节 → 情节线 ID 列表的映射.
                                若未提供，则按 outline_id / if_line 推断.

        Returns:
            StrandAnalysisReport 健康报告
        """
        # 1. 统计各情节线数据
        strand_data = self._aggregate_strand_data(
            chapters, outlines, if_lines, chapter_strand_map
        )

        # 2. 计算比例
        total_words = sum(d["word_count"] for d in strand_data.values())
        total_chapters = sum(d["chapter_count"] for d in strand_data.values())

        strand_ratios: list[StrandRatio] = []
        for sid, data in strand_data.items():
            stype = data["type"]
            ratio = data["word_count"] / max(total_words, 1)
            target = self._target_ratios.get(stype, 0.0)
            strand_ratios.append(
                StrandRatio(
                    strand_id=sid,
                    strand_name=data["name"],
                    strand_type=stype,
                    word_count=data["word_count"],
                    chapter_count=data["chapter_count"],
                    ratio=ratio,
                    target_ratio=target,
                    deviation=ratio - target,
                )
            )

        # 3. 红线检查
        red_lines = self._run_red_line_checks(strand_ratios)

        # 4. 生成调整建议
        adjustments = self._generate_adjustments(strand_ratios, red_lines)

        # 5. 计算健康分
        health_score = self._calculate_health_score(strand_ratios, red_lines)

        # 6. 生成摘要
        summary = self._generate_summary(strand_ratios, red_lines, health_score)

        return StrandAnalysisReport(
            total_word_count=total_words,
            total_chapter_count=total_chapters,
            strand_ratios=strand_ratios,
            red_line_checks=red_lines,
            adjustments=adjustments,
            overall_health_score=health_score,
            summary=summary,
        )

    # ------------------------------------------------------------------
    # 数据聚合
    # ------------------------------------------------------------------

    def _aggregate_strand_data(
        self,
        chapters: list[Chapter],
        outlines: list[Outline] | None,
        if_lines: list[IFLine] | None,
        chapter_strand_map: dict[int, list[str]] | None,
    ) -> dict[str, dict[str, Any]]:
        """聚合各情节线的字数与章节数."""
        data: dict[str, dict[str, Any]] = {}

        # 初始化主线（默认 outline_id=0 或关联到 outline 的章节）
        data["main"] = {
            "name": "主线",
            "type": "main",
            "word_count": 0,
            "chapter_count": 0,
        }

        # 初始化 IF 线
        if if_lines:
            for ifl in if_lines:
                data[f"if_{ifl.id}"] = {
                    "name": ifl.title,
                    "type": "if",
                    "word_count": 0,
                    "chapter_count": 0,
                }

        # 遍历章节统计
        for ch in chapters:
            wc = ch.word_count or 0

            if chapter_strand_map and ch.id in chapter_strand_map:
                # 显式映射模式
                strand_ids = chapter_strand_map[ch.id]
                for sid in strand_ids:
                    if sid not in data:
                        data[sid] = {
                            "name": sid,
                            "type": "sub",
                            "word_count": 0,
                            "chapter_count": 0,
                        }
                    data[sid]["word_count"] += wc
                    data[sid]["chapter_count"] += 1
            else:
                # 推断模式：有 outline_id 的归主线，有 if_line 关联的归 IF 线
                assigned = False
                if ch.outline_id is not None:
                    data["main"]["word_count"] += wc
                    data["main"]["chapter_count"] += 1
                    assigned = True

                # 若章节同时属于某 IF 线，字数按比例分配（各 50%）
                # 实际项目中可通过 chapter_strand_map 精确分配
                if if_lines and assigned:
                    # 简化：已归主线的不重复计入 IF 线
                    pass

        # 若主线无任何章节，尝试将所有未分配章节归为主线
        if data["main"]["chapter_count"] == 0 and chapters:
            for ch in chapters:
                data["main"]["word_count"] += ch.word_count or 0
                data["main"]["chapter_count"] += 1

        return data

    # ------------------------------------------------------------------
    # 红线检查
    # ------------------------------------------------------------------

    def _run_red_line_checks(self, strand_ratios: list[StrandRatio]) -> list[RedLineCheck]:
        """执行红线规则检查."""
        checks: list[RedLineCheck] = []

        # 按类型聚合比例
        type_ratios: dict[str, float] = {}
        for sr in strand_ratios:
            type_ratios[sr.strand_type] = type_ratios.get(sr.strand_type, 0.0) + sr.ratio

        for rule_id, rule in self._rules.items():
            target_type = rule.get("target_type", "")
            threshold = rule.get("threshold", 0.0)
            operator = rule.get("operator", ">=")
            actual = type_ratios.get(target_type, 0.0)

            if operator == ">=":
                passed = actual >= threshold
            elif operator == "<=":
                passed = actual <= threshold
            elif operator == ">":
                passed = actual > threshold
            elif operator == "<":
                passed = actual < threshold
            elif operator == "==":
                passed = abs(actual - threshold) < 0.01
            else:
                passed = True

            checks.append(
                RedLineCheck(
                    rule_name=rule.get("name", rule_id),
                    passed=passed,
                    severity=rule.get("severity", "info") if not passed else "info",
                    message=(
                        f"{'通过' if passed else '未通过'}: "
                        f"{rule.get('name', rule_id)} "
                        f"(实际 {actual:.1%}, 要求 {operator} {threshold:.1%})"
                    ),
                    actual_value=actual,
                    threshold_value=threshold,
                )
            )

        return checks

    # ------------------------------------------------------------------
    # 调整建议
    # ------------------------------------------------------------------

    def _generate_adjustments(
        self, strand_ratios: list[StrandRatio], red_lines: list[RedLineCheck]
    ) -> list[StrandAdjustment]:
        """基于偏离度生成调整建议."""
        adjustments: list[StrandAdjustment] = []

        for sr in strand_ratios:
            if abs(sr.deviation) < 0.03:
                continue  # 偏离小于 3%，忽略

            if sr.deviation < 0:
                # 当前比例低于目标
                suggestion = (
                    f"「{sr.strand_name}」当前占比 {sr.ratio:.1%}，"
                    f"低于目标 {sr.target_ratio:.1%}。"
                )
                if sr.strand_type == "main":
                    suggestion += "建议增加主线章节篇幅，或压缩副线/IF线内容。"
                elif sr.strand_type == "if":
                    suggestion += "建议增加 IF 线相关章节，丰富配角故事。"
                else:
                    suggestion += "建议增加该情节线的出场频率。"
            else:
                # 当前比例高于目标
                suggestion = (
                    f"「{sr.strand_name}」当前占比 {sr.ratio:.1%}，"
                    f"高于目标 {sr.target_ratio:.1%}。"
                )
                if sr.strand_type == "main":
                    suggestion += "主线占比偏高，可考虑增加副线或 IF 线以丰富叙事。"
                elif sr.strand_type == "if":
                    suggestion += "IF 线占比偏高，可能分散主线焦点，建议适当收敛。"
                else:
                    suggestion += "建议适当缩减该情节线篇幅，避免喧宾夺主。"

            priority = "high" if abs(sr.deviation) > 0.1 else "medium"
            adjustments.append(
                StrandAdjustment(
                    strand_id=sr.strand_id,
                    strand_name=sr.strand_name,
                    current_ratio=sr.ratio,
                    target_ratio=sr.target_ratio,
                    suggestion=suggestion,
                    priority=priority,
                )
            )

        # 补充红线触发的建议
        for rl in red_lines:
            if rl.passed:
                continue
            # 查找是否已有对应建议
            existing = any(a.strand_type == rl.rule_name for a in adjustments if hasattr(a, "strand_type"))
            if not existing:
                adjustments.append(
                    StrandAdjustment(
                        strand_id="_redline_",
                        strand_name=rl.rule_name,
                        current_ratio=rl.actual_value,
                        target_ratio=rl.threshold_value,
                        suggestion=rl.message,
                        priority="high" if rl.severity == "error" else "medium",
                    )
                )

        return adjustments

    # ------------------------------------------------------------------
    # 健康评分
    # ------------------------------------------------------------------

    def _calculate_health_score(
        self, strand_ratios: list[StrandRatio], red_lines: list[RedLineCheck]
    ) -> float:
        """计算整体健康分 (0.0 ~ 1.0)."""
        score = 1.0

        # 偏离度惩罚
        for sr in strand_ratios:
            penalty = min(abs(sr.deviation) * 2, 0.3)
            score -= penalty

        # 红线失败惩罚
        for rl in red_lines:
            if not rl.passed:
                if rl.severity == "error":
                    score -= 0.2
                elif rl.severity == "warning":
                    score -= 0.1

        return max(round(score, 3), 0.0)

    def _generate_summary(
        self,
        strand_ratios: list[StrandRatio],
        red_lines: list[RedLineCheck],
        health_score: float,
    ) -> str:
        """生成人类可读摘要."""
        parts: list[str] = []

        # 比例概览
        ratio_desc = ", ".join(
            f"{sr.strand_name} {sr.ratio:.1%}" for sr in strand_ratios
        )
        parts.append(f"情节线分布：{ratio_desc}。")

        # 红线状态
        failed = [rl for rl in red_lines if not rl.passed]
        if failed:
            parts.append(f"红线检查：{len(failed)} 项未通过。")
        else:
            parts.append("红线检查：全部通过。")

        # 健康度
        if health_score >= 0.8:
            parts.append("整体健康度良好。")
        elif health_score >= 0.5:
            parts.append("整体健康度一般，建议关注偏离较大的情节线。")
        else:
            parts.append("整体健康度较差，需要大幅调整情节线比例。")

        return "".join(parts)

    # ------------------------------------------------------------------
    # 快捷方法
    # ------------------------------------------------------------------

    async def check_red_lines(
        self,
        chapters: list[Chapter],
        outlines: list[Outline] | None = None,
        if_lines: list[IFLine] | None = None,
        chapter_strand_map: dict[int, list[str]] | None = None,
    ) -> list[RedLineCheck]:
        """仅执行红线检查，返回结果列表."""
        report = await self.analyze(chapters, outlines, if_lines, chapter_strand_map)
        return report.red_line_checks

    def update_target_ratios(self, ratios: dict[str, float]) -> None:
        """更新目标比例."""
        self._target_ratios.update(ratios)

    def update_rules(self, rules: dict[str, dict[str, Any]]) -> None:
        """更新红线规则."""
        self._rules.update(rules)
