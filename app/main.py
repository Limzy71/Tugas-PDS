"""Entry point aplikasi: merakit router dan static files."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import chat, pages, system

app = FastAPI(
    title=settings.app_name,
    description=settings.app_description,
    version=settings.app_version,
)

app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")

app.include_router(pages.router)
app.include_router(chat.router)
app.include_router(system.router)