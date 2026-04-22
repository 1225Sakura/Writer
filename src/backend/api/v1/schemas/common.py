"""
Common API Schemas
Standardized schemas for API v1 endpoints.
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class APIError(BaseModel):
    """Standardized API error structure."""

    code: str = Field(..., description="错误代码，如 NOT_FOUND, VALIDATION_ERROR")
    message: str = Field(..., description="错误消息")
    details: Optional[Dict[str, Any]] = Field(None, description="详细信息")


class ErrorResponse(BaseModel):
    """Standardized error response wrapper."""

    error: APIError
    request_id: Optional[str] = Field(None, description="请求追踪ID")
    timestamp: Optional[str] = Field(None, description="错误发生时间")


class SuccessResponse(BaseModel):
    """Standard successful response wrapper."""

    data: Optional[Dict[str, Any]] = Field(None, description="响应数据")
    message: Optional[str] = Field(None, description="成功消息")
    request_id: Optional[str] = Field(None, description="请求追踪ID")


class PaginationParams(BaseModel):
    """Pagination parameters."""

    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    total: Optional[int] = Field(None, description="总数")
    total_pages: Optional[int] = Field(None, description="总页数")


class ListResponse(BaseModel):
    """Standard list response with pagination."""

    items: list[Any] = Field(..., description="数据列表")
    pagination: Optional[PaginationParams] = Field(None, description="分页信息")