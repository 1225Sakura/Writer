"""Project CRUD routes — thin HTTP adapter over ProjectService."""
from fastapi import APIRouter, Depends
from app.dependencies import get_project_service
from app.core.security import verify_api_key
from app.services.project import ProjectService
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut
from app.schemas.response import ApiResponse
from app.core.exceptions import NotFoundException

router = APIRouter(prefix="/projects", tags=["Projects"], dependencies=[Depends(verify_api_key)])

def _serialize(p) -> dict:
    return ProjectOut.model_validate(p).model_dump()

@router.get("")
def list_projects(service: ProjectService = Depends(get_project_service)):
    return ApiResponse(data=[_serialize(p) for p in service.list()])

@router.post("")
def create_project(data: ProjectCreate, service: ProjectService = Depends(get_project_service)):
    project = service.create_with_defaults(data)
    return ApiResponse(data=_serialize(project), message="Project created")

@router.get("/{project_id}")
def get_project(project_id: int, service: ProjectService = Depends(get_project_service)):
    project = service.get(project_id)
    if not project:
        raise NotFoundException("Project", project_id)
    return ApiResponse(data=_serialize(project))

@router.put("/{project_id}")
def update_project(project_id: int, data: ProjectUpdate, service: ProjectService = Depends(get_project_service)):
    project = service.update(project_id, data)
    if not project:
        raise NotFoundException("Project", project_id)
    return ApiResponse(data=_serialize(project))

@router.delete("/{project_id}")
def delete_project(project_id: int, service: ProjectService = Depends(get_project_service)):
    if not service.delete(project_id):
        raise NotFoundException("Project", project_id)
    return ApiResponse(message="Project deleted")