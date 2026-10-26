"""Route untuk menyajikan halaman UI."""

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.core.config import settings

router = APIRouter(include_in_schema=False)


@router.get("/")
async def home() -> FileResponse:
    return FileResponse(settings.static_dir / "index.html")
