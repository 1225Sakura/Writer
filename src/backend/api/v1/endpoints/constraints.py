"""Constraint Routes - API endpoints for the Writing Constraint Engine.

Provides endpoints for the Three Anti-Hallucination Laws:
1. 大纲即法律 (Outline is Law)
2. 设定即物理 (Setting is Physics)
3. 发明需识别 (Invention Requires Registration)

Endpoints:
- POST /constraints/check    - Check content against constraints
- POST /constraints/enforce  - Enforce constraints (alias for check)
- GET  /constraints/rules    - List all constraint rules
- POST /constraints/rules    - Add a new constraint rule
- GET  /constraints/violations - Get violation history
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Depends, status, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.middleware.auth import require_auth
from backend.services.constraints import (
    ConstraintEngine,
    ConstraintRule,
    ConstraintViolation,
    LawType,
    Severity,
    RuleStatus,
    ConstraintCheckResult,
)
from backend.core.services.style.style_constraint import StyleConstraintEnforcer
from backend.utils.exceptions import ConstraintError, AppException

router = APIRouter(prefix="/constraints", tags=["constraints"])


# ------------------------------------------------------------------
# Request/Response Models
# ------------------------------------------------------------------

class ConstraintCheckRequest(BaseModel):
    """Request to check content against constraints."""

    content: str = Field(..., description="Text content to check", max_length=100000)
    chapter_id: Optional[int] = Field(None, description="Chapter ID for context lookup")
    project_id: Optional[int] = Field(None, description="Project ID for entity lookup")
    outline_id: Optional[int] = Field(None, description="Outline ID for outline law checking")
    mode: str = Field("quick", description="Check mode: 'quick' or 'deep'")
    include_style: bool = Field(True, description="Also check style constraints")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Content cannot be empty")
        return v.strip()

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("quick", "deep"):
            raise ValueError("mode must be 'quick' or 'deep'")
        return v


class ConstraintViolationResponse(BaseModel):
    """A single constraint violation."""

    rule_id: str = Field(..., description="Rule identifier")
    law_type: str = Field(..., description="Law type: outline_law, setting_physics, invention_registration")
    severity: str = Field(..., description="Severity: critical, high, medium, low, info")
    message: str = Field(..., description="Violation description")
    evidence: str = Field("", description="Text evidence")
    location: Optional[str] = Field(None, description="Location in text")
    suggestion: str = Field("", description="Fix suggestion")


class ConstraintCheckResponse(BaseModel):
    """Response from constraint check."""

    passed: bool = Field(..., description="Whether content passed all constraints")
    overall_score: int = Field(..., ge=0, le=100, description="Overall compliance score")
    violations: list[ConstraintViolationResponse] = Field(default_factory=list)
    rules_checked: list[str] = Field(default_factory=list)
    summary: str = Field("", description="Human-readable summary")


class ConstraintRuleRequest(BaseModel):
    """Request to create a constraint rule."""

    law_type: str = Field(..., description="Law type")
    name: str = Field(..., description="Rule name", min_length=1, max_length=200)
    description: str = Field(..., description="Rule description")
    pattern: Optional[str] = Field(None, description="Optional regex pattern for detection")
    severity: str = Field("high", description="Severity: critical, high, medium, low")
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("law_type")
    @classmethod
    def validate_law_type(cls, v: str) -> str:
        valid = {"outline_law", "setting_physics", "invention_registration"}
        if v not in valid:
            raise ValueError(f"law_type must be one of: {', '.join(sorted(valid))}")
        return v

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        valid = {"critical", "high", "medium", "low"}
        if v not in valid:
            raise ValueError(f"severity must be one of: {', '.join(sorted(valid))}")
        return v


class ConstraintRuleResponse(BaseModel):
    """A constraint rule."""

    id: str = Field(..., description="Rule ID")
    law_type: str = Field(..., description="Law type")
    name: str = Field(..., description="Rule name")
    description: str = Field(..., description="Rule description")
    pattern: Optional[str] = Field(None)
    severity: str = Field(..., description="Severity")
    status: str = Field("active", description="Rule status")
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(..., description="Creation timestamp")


class ConstraintRulesListResponse(BaseModel):
    """List of constraint rules."""

    rules: list[ConstraintRuleResponse] = Field(default_factory=list)
    total: int = Field(..., description="Total number of rules")


class ViolationsListResponse(BaseModel):
    """List of constraint violations."""

    violations: list[ConstraintViolationResponse] = Field(default_factory=list)
    total: int = Field(..., description="Total number of violations")
    filters: dict[str, Any] = Field(default_factory=dict)


class StyleCheckRequest(BaseModel):
    """Request to check style constraints."""

    content: str = Field(..., description="Text content to check", max_length=100000)
    project_id: Optional[int] = Field(None, description="Project ID for settings lookup")
    target_style: Optional[str] = Field(None, description="Override target style")
    target_word_count: Optional[int] = Field(None, description="Override target word count")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Content cannot be empty")
        return v.strip()


# ------------------------------------------------------------------
# Helper functions
# ------------------------------------------------------------------

def _violation_to_response(v: ConstraintViolation) -> ConstraintViolationResponse:
    return ConstraintViolationResponse(
        rule_id=v.rule_id,
        law_type=v.law_type.value,
        severity=v.severity.value,
        message=v.message,
        evidence=v.evidence,
        location=v.location,
        suggestion=v.suggestion,
    )


def _rule_to_response(r: ConstraintRule) -> ConstraintRuleResponse:
    return ConstraintRuleResponse(
        id=r.id,
        law_type=r.law_type.value,
        name=r.name,
        description=r.description,
        pattern=r.pattern,
        severity=r.severity.value,
        status=r.status.value,
        metadata=r.metadata,
        created_at=r.created_at,
    )


def _result_to_response(result: ConstraintCheckResult) -> ConstraintCheckResponse:
    return ConstraintCheckResponse(
        passed=result.passed,
        overall_score=result.overall_score,
        violations=[_violation_to_response(v) for v in result.violations],
        rules_checked=result.rules_checked,
        summary=result.summary,
    )


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.post(
    "/check",
    response_model=ConstraintCheckResponse,
    dependencies=[require_auth],
    summary="检查内容约束",
    description="对提供的文本内容执行三定律约束检查。支持quick（快速启发式）和deep（AI深度分析）两种模式。",
)
async def check_constraints(
    request: ConstraintCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """Check content against the Three Anti-Hallucination Laws.

    Runs all three laws:
    1. Outline Law - content must follow outline
    2. Setting Physics - content must obey world settings
    3. Invention Registration - new entities must be tracked

    Optionally includes style constraint checking.
    """
    engine = ConstraintEngine(db)

    try:
        result = await engine.enforce(
            content=request.content,
            chapter_id=request.chapter_id,
            project_id=request.project_id,
            outline_id=request.outline_id,
            mode=request.mode,
        )
    except ConstraintError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Constraint check failed: {str(e)}",
        )

    # Optionally add style constraints
    if request.include_style:
        style_enforcer = StyleConstraintEnforcer(db)
        try:
            style_violations = await style_enforcer.enforce(
                content=request.content,
                project_id=request.project_id,
                target_style=request.project_id and None,
            )
            result.violations.extend(style_violations)
            result.rules_checked.append("style_constraints")
            # Recompute score
            result.overall_score = engine._compute_score(result.violations)
            result.passed = result.overall_score >= ConstraintEngine.PASS_THRESHOLD
            result.summary = engine._build_summary(result.violations, result.overall_score)
        except AppException:
            # Style check is best-effort; don't fail the whole request
            pass

    return _result_to_response(result)


@router.post(
    "/enforce",
    response_model=ConstraintCheckResponse,
    dependencies=[require_auth],
    summary="强制执行约束",
    description="与 /check 相同，语义上强调'强制'执行约束检查。",
)
async def enforce_constraints(
    request: ConstraintCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """Enforce constraints on content (alias for /check)."""
    return await check_constraints(request, db)


@router.get(
    "/rules",
    response_model=ConstraintRulesListResponse,
    dependencies=[require_auth],
    summary="列出约束规则",
    description="获取所有约束规则，可按定律类型和状态过滤。",
)
async def list_rules(
    law_type: Optional[str] = Query(None, description="Filter by law type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
):
    """List all constraint rules."""
    engine = ConstraintEngine(db)

    law_type_enum = None
    if law_type:
        try:
            law_type_enum = LawType(law_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid law_type: {law_type}",
            )

    status_enum = None
    if status:
        try:
            status_enum = RuleStatus(status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status}",
            )

    try:
        rules = await engine.get_rules(
            law_type=law_type_enum,
            status=status_enum,
        )
    except ConstraintError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load rules: {str(e)}",
        )

    return ConstraintRulesListResponse(
        rules=[_rule_to_response(r) for r in rules],
        total=len(rules),
    )


@router.post(
    "/rules",
    response_model=ConstraintRuleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_auth],
    summary="添加约束规则",
    description="添加一条新的约束规则。规则将用于后续的内容检查。",
)
async def add_rule(
    request: ConstraintRuleRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add a new constraint rule."""
    engine = ConstraintEngine(db)

    import uuid
    rule = ConstraintRule(
        id=str(uuid.uuid4()),
        law_type=LawType(request.law_type),
        name=request.name,
        description=request.description,
        pattern=request.pattern,
        severity=Severity(request.severity),
        metadata=request.metadata,
    )

    try:
        created = await engine.add_rule(rule)
    except ConstraintError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add rule: {str(e)}",
        )

    return _rule_to_response(created)


@router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[require_auth],
    summary="删除约束规则",
    description="删除指定ID的约束规则。",
)
async def delete_rule(
    rule_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a constraint rule by ID."""
    engine = ConstraintEngine(db)

    try:
        deleted = await engine.delete_rule(rule_id)
    except ConstraintError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete rule: {str(e)}",
        )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rule {rule_id} not found",
        )


@router.get(
    "/violations",
    response_model=ViolationsListResponse,
    dependencies=[require_auth],
    summary="获取违规历史",
    description="获取历史约束违规记录，可按章节、定律类型、严重级别过滤。",
)
async def get_violations(
    chapter_id: Optional[int] = Query(None, description="Filter by chapter ID"),
    law_type: Optional[str] = Query(None, description="Filter by law type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results"),
    db: AsyncSession = Depends(get_db),
):
    """Get historical constraint violations."""
    engine = ConstraintEngine(db)

    law_type_enum = None
    if law_type:
        try:
            law_type_enum = LawType(law_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid law_type: {law_type}",
            )

    severity_enum = None
    if severity:
        try:
            severity_enum = Severity(severity)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid severity: {severity}",
            )

    try:
        violations = await engine.get_violations(
            chapter_id=chapter_id,
            law_type=law_type_enum,
            severity=severity_enum,
            limit=limit,
        )
    except ConstraintError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load violations: {str(e)}",
        )

    filters = {}
    if chapter_id is not None:
        filters["chapter_id"] = chapter_id
    if law_type:
        filters["law_type"] = law_type
    if severity:
        filters["severity"] = severity

    return ViolationsListResponse(
        violations=[_violation_to_response(v) for v in violations],
        total=len(violations),
        filters=filters,
    )


@router.post(
    "/style-check",
    response_model=ConstraintCheckResponse,
    dependencies=[require_auth],
    summary="检查风格约束",
    description="仅检查写作风格相关约束（文笔风格、字数、AI套话等）。",
)
async def check_style_constraints(
    request: StyleCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """Check only style constraints on content."""
    enforcer = StyleConstraintEnforcer(db)

    try:
        violations = await enforcer.enforce(
            content=request.content,
            project_id=request.project_id,
            target_style=request.target_style,
            target_word_count=request.target_word_count,
        )
    except ConstraintError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Style check failed: {str(e)}",
        )

    # Compute score
    from backend.services.constraints import ConstraintEngine
    score = ConstraintEngine._compute_score.__func__(None, violations)

    # Build a simple summary
    if not violations:
        summary = "风格检查通过，未发现违规。"
    else:
        summary = f"风格检查发现 {len(violations)} 处问题。"

    result = ConstraintCheckResult(
        passed=score >= 70,
        overall_score=score,
        violations=[_violation_to_response(v) for v in violations],
        rules_checked=["style_constraints"],
        summary=summary,
    )

    return _result_to_response(result)
