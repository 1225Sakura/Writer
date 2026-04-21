# Export/Import API Routes

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, field_validator
from typing import Optional, Any

from services.export_import import (
    export_project,
    export_to_json,
    export_to_zip,
    import_project,
    import_from_json,
    import_from_zip,
)

router = APIRouter(prefix="/api/project", tags=["project"])

MAX_IMPORT_SIZE = 50 * 1024 * 1024  # 50MB max import size


class ImportRequest(BaseModel):
    """Validated import request."""
    data: dict
    mode: str = "merge"

    @field_validator('mode')
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("merge", "replace"):
            raise ValueError("Mode must be 'merge' or 'replace'")
        return v


class ImportZipRequest(BaseModel):
    """Validated ZIP import request."""
    mode: str = "merge"

    @field_validator('mode')
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("merge", "replace"):
            raise ValueError("Mode must be 'merge' or 'replace'")
        return v


@router.get("/export")
async def export_project_data():
    """Export all project data as JSON."""
    data = await export_project()
    return data


@router.get("/export/zip")
async def export_project_as_zip():
    """Export all project data as a ZIP archive."""
    data = await export_project()
    zip_bytes = export_to_zip(data)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=project_export.zip"}
    )


@router.post("/import")
async def import_project_data(request: ImportRequest):
    """
    Import project data from JSON.

    Args:
        request: ImportRequest with data dictionary and mode
    """
    try:
        summary = await import_project(request.data, mode=request.mode)
        return {"success": True, "summary": summary}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/import/zip")
async def import_from_zip_file(data: bytes, request: ImportZipRequest):
    """
    Import project data from a ZIP archive.
    """
    try:
        project_data = import_from_zip(data)
        summary = await import_project(project_data, mode=request.mode)
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")
