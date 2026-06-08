# Auto Novel Writer - AI Quality Evaluation Endpoint
# POST /ai/evaluate-quality

from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.services.quality_metrics import QualityAnalyzer

router = APIRouter()

_analyzer = QualityAnalyzer()


class QualityEvaluateRequest(BaseModel):
    """Request for AI output quality evaluation."""
    model_config = {"json_schema_extra": {
        "example": {
            "original": "主角走进山洞，发现了一本破旧的秘籍。",
            "result": "主角缓步踏入幽暗的山洞，微弱的火把光芒在岩壁上投下摇曳的影子。在洞穴深处的石台上，一本泛黄的古籍静静躺着，封面上的字迹虽已模糊，却仍透出一股神秘的力量。",
            "operation": "expand"
        }
    }}

    original: str = Field(..., description="原始文本", max_length=100000)
    result: str = Field(..., description="AI生成的文本", max_length=100000)
    operation: str = Field("", description="操作类型（可选）")


class QualityScoreDetail(BaseModel):
    """Individual quality dimension score."""
    name: str
    score: float = Field(..., ge=0, le=100)
    label: str


class QualityEvaluateResponse(BaseModel):
    """Response with quality evaluation scores."""
    overall: int = Field(..., ge=0, le=100, description="综合质量分 0-100")
    coherence: int = Field(..., ge=0, le=100, description="连贯性评分")
    style_consistency: int = Field(..., ge=0, le=100, description="风格一致性评分")
    plot_reasonability: int = Field(..., ge=0, le=100, description="情节合理性评分")
    details: list[QualityScoreDetail] = Field(default_factory=list, description="详细维度评分")


def _score_to_label(score: float) -> str:
    """Convert a 0-100 score to a human-readable label."""
    if score >= 90:
        return "优秀"
    if score >= 75:
        return "良好"
    if score >= 60:
        return "一般"
    return "需改进"


def _length_ratio_score(original: str, result: str, operation: str) -> float:
    """Score based on whether the length change matches the operation intent.

    Returns a score between 50 and 100.
    """
    orig_len = max(len(original.strip()), 1)
    result_len = len(result.strip())

    if operation == "expand":
        # Result should be longer than original
        ratio = result_len / orig_len
        if ratio >= 1.5:
            return 95.0
        if ratio >= 1.2:
            return 85.0
        if ratio >= 1.0:
            return 70.0
        return 55.0
    elif operation == "condense":
        # Result should be shorter than original
        ratio = result_len / orig_len
        if 0.3 <= ratio <= 0.7:
            return 90.0
        if ratio <= 0.9:
            return 80.0
        return 65.0
    else:
        # For other operations, reasonable length is fine
        if 10 <= result_len <= 5000:
            return 85.0
        return 75.0


@router.post(
    "/evaluate-quality",
    summary="AI输出质量评估",
    description="对AI生成的文本进行多维度质量评估，包括连贯性、风格一致性、情节合理性。",
    response_model=QualityEvaluateResponse,
)
async def evaluate_quality(request: QualityEvaluateRequest) -> QualityEvaluateResponse:
    """Evaluate AI-generated text quality across multiple dimensions.

    Uses automatic metrics (no LLM cost):
    - Pacing score: sentence-length variance
    - Vocabulary diversity: type-token ratio
    - Tension score: paragraph-length variation
    - Length appropriateness: matches operation intent
    """
    result_text = request.result

    # Compute automatic quality metrics on the result text
    metrics = _analyzer.compute_automatic(result_text)

    # Convert 0.0-1.0 scores to 0-100 integer scores
    pacing = round(metrics.pacing_score * 100)
    vocabulary = round(metrics.vocabulary_diversity * 100)
    tension = round(metrics.tension_score * 100)

    # Coherence: based on pacing (smooth flow) + vocabulary (rich expression)
    coherence = round(pacing * 0.6 + vocabulary * 0.4)
    coherence = max(50, min(100, coherence))

    # Style consistency: based on vocabulary diversity + pacing regularity
    # High vocabulary diversity + good pacing = consistent style
    style_score = round(vocabulary * 0.5 + pacing * 0.5)
    style_score = max(50, min(100, style_score))

    # Plot reasonability: based on tension (dynamic pacing) + length appropriateness
    length_score = _length_ratio_score(request.original, result_text, request.operation)
    plot_score = round(tension * 0.4 + length_score * 0.6)
    plot_score = max(50, min(100, plot_score))

    # Overall: weighted average of the three dimensions
    overall = round(coherence * 0.35 + style_score * 0.30 + plot_score * 0.35)
    overall = max(50, min(100, overall))

    return QualityEvaluateResponse(
        overall=overall,
        coherence=coherence,
        style_consistency=style_score,
        plot_reasonability=plot_score,
        details=[
            QualityScoreDetail(name="节奏", score=pacing, label=_score_to_label(pacing)),
            QualityScoreDetail(name="词汇多样性", score=vocabulary, label=_score_to_label(vocabulary)),
            QualityScoreDetail(name="张力变化", score=tension, label=_score_to_label(tension)),
            QualityScoreDetail(name="长度适当性", score=round(length_score), label=_score_to_label(length_score)),
        ],
    )
