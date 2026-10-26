"""Endpoint status server dan informasi model."""

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.services import ollama_service
from app.services.ollama_service import OllamaError

router = APIRouter(tags=["System"])


@router.get("/health")
async def health_check() -> dict:
    return {"status": "healthy"}


@router.get("/api/status")
async def server_status() -> dict:
    return {
        "app": settings.app_name,
        "status": "running",
        "ollama_base_url": settings.ollama_base_url,
        "ollama_model": settings.ollama_model,
        "ollama_status": await ollama_service.get_version(),
    }


@router.get("/models")
async def list_models() -> dict:
    """Daftar model yang sudah terunduh di Ollama."""
    try:
        return await ollama_service.list_models()
    except OllamaError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
