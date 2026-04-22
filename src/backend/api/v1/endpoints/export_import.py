# Export/Import API Routes

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from backend.middleware.auth import require_auth
from backend.core.domain.schemas import ImportRequest, ImportZipRequest
from backend.services.export_import import (
    export_project,
    export_to_json,
    export_to_yaml,
    export_to_zip,
    import_project,
    import_from_json,
    import_from_yaml,
    import_from_zip,
    ImportValidationError,
    ExportProgressCallback,
)

router = APIRouter(prefix="/project", tags=["project"], dependencies=[require_auth])

MAX_IMPORT_SIZE = 50 * 1024 * 1024  # 50MB max import size


@router.get(
    "/export",
    summary="导出项目数据",
    description="导出所有项目数据为JSON格式，支持增量导出。",
)
async def export_project_data(
    incremental: bool = Query(False, description="Export only changed data"),
    since: str = Query(None, description="ISO datetime for incremental export"),
):
    """Export all project data as JSON."""
    from datetime import datetime

    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid since datetime format")

    data = await export_project(incremental=incremental, since=since_dt)
    return data


@router.get(
    "/export/json",
    summary="导出为JSON文件",
    description="导出所有项目数据为JSON文件下载。",
)
async def export_as_json():
    """Export all project data as standalone JSON file."""
    data = await export_project()
    json_str = export_to_json(data)
    return Response(
        content=json_str,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=project_export.json"}
    )


@router.get(
    "/export/yaml",
    summary="导出为YAML文件",
    description="导出所有项目数据为YAML文件下载。",
)
async def export_as_yaml():
    """Export all project data as standalone YAML file."""
    data = await export_project()
    yaml_str = export_to_yaml(data)
    return Response(
        content=yaml_str,
        media_type="application/x-yaml",
        headers={"Content-Disposition": "attachment; filename=project_export.yaml"}
    )


@router.get(
    "/export/zip",
    summary="导出为ZIP压缩包",
    description="导出所有项目数据为ZIP压缩包下载，内含JSON或YAML格式数据。",
)
async def export_as_zip(
    format: str = Query("json", description="Export format: 'json' or 'yaml'")
):
    """Export all project data as a ZIP archive."""
    if format not in ["json", "yaml"]:
        raise HTTPException(status_code=400, detail="Format must be 'json' or 'yaml'")

    data = await export_project()
    zip_bytes = export_to_zip(data, format=format)
    filename = f"project_export.{format}"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post(
    "/import",
    summary="导入项目数据",
    description="从JSON数据导入项目数据，支持merge和replace两种模式。",
)
async def import_project_data(request: ImportRequest):
    """
    Import project data from JSON.

    Args:
        request: ImportRequest with data dictionary and mode
    """
    try:
        summary = await import_project(
            request.data,
            mode=request.mode,
            validate=True
        )
        return {
            "success": True,
            "summary": summary,
            "validation_passed": summary.get("validation_passed", True),
            "conflicts_count": len(summary.get("conflicts", []))
        }
    except ImportValidationError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Import validation failed",
                "errors": e.errors,
                "total_errors": len(e.errors)
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post(
    "/import/yaml",
    summary="从YAML导入",
    description="从YAML字符串导入项目数据。",
)
async def import_from_yaml_file(
    yaml_data: str,
    mode: str = "merge",
    validate: bool = True,
    conflict_resolution: str = "import_wins"
):
    """
    Import project data from YAML string.

    Args:
        yaml_data: YAML content as string
        mode: "merge" or "replace"
        validate: Whether to validate imported data
        conflict_resolution: "import_wins", "existing_wins", or "merge"
    """
    try:
        project_data = import_from_yaml(yaml_data)
        summary = await import_project(
            project_data,
            mode=mode,
            validate=validate,
            conflict_resolution=conflict_resolution
        )
        return {
            "success": True,
            "summary": summary,
            "validation_passed": summary.get("validation_passed", True),
            "conflicts_count": len(summary.get("conflicts", []))
        }
    except ImportValidationError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Import validation failed",
                "errors": e.errors,
                "total_errors": len(e.errors)
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.post(
    "/import/zip",
    summary="从ZIP导入",
    description="从ZIP压缩包导入项目数据。",
)
async def import_from_zip_file(
    zip_data: bytes,
    request: ImportZipRequest,
    validate: bool = True,
    conflict_resolution: str = "import_wins"
):
    """
    Import project data from a ZIP archive.

    Args:
        zip_data: ZIP archive bytes
        request: ImportZipRequest with mode
        validate: Whether to validate imported data
        conflict_resolution: How to resolve conflicts
    """
    try:
        project_data = import_from_zip(zip_data)
        summary = await import_project(
            project_data,
            mode=request.mode,
            validate=validate,
            conflict_resolution=conflict_resolution
        )
        return {
            "success": True,
            "summary": summary,
            "validation_passed": summary.get("validation_passed", True),
            "conflicts_count": len(summary.get("conflicts", []))
        }
    except ImportValidationError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Import validation failed",
                "errors": e.errors,
                "total_errors": len(e.errors)
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
