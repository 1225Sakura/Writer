# Export/Import API Routes

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from services.export_import import (
    export_project,
    export_to_json,
    export_to_zip,
    import_project,
    import_from_json,
    import_from_zip,
)

router = APIRouter(prefix="/api/project", tags=["project"])


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
async def import_project_data(data: dict, mode: str = "merge"):
    """
    Import project data from JSON.

    Args:
        data: Project data dictionary
        mode: "merge" (add to existing) or "replace" (clear and load)
    """
    if mode not in ("merge", "replace"):
        raise HTTPException(status_code=400, detail="Mode must be 'merge' or 'replace'")

    try:
        summary = await import_project(data, mode=mode)
        return {"success": True, "summary": summary}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post("/import/zip")
async def import_from_zip_file(data: bytes, mode: str = "merge"):
    """
    Import project data from a ZIP archive.
    """
    if mode not in ("merge", "replace"):
        raise HTTPException(status_code=400, detail="Mode must be 'merge' or 'replace'")

    try:
        project_data = import_from_zip(data)
        summary = await import_project(project_data, mode=mode)
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")
