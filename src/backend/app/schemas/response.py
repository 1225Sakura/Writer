"""ApiResponse / PaginatedResponse / ErrorResponse canonical imports.

Source of truth: app/schemas/base.py. This file exists so callers can
`from app.schemas.response import ApiResponse` without depending on base.py.
"""
from app.schemas.base import ApiResponse, PaginatedResponse, ErrorResponse
__all__ = ["ApiResponse", "PaginatedResponse", "ErrorResponse"]
