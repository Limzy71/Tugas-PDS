"""Konfigurasi aplikasi yang dibaca dari environment variable."""

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str = "Sanz AI Assistant"
    app_description: str = "AI Assistant dengan UI bergaya ChatGPT dan Ollama sebagai backend"
    app_version: str = "1.0.0"

    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    ollama_timeout: float = float(os.getenv("OLLAMA_TIMEOUT", "120"))
    system_prompt: str = os.getenv(
        "SYSTEM_PROMPT",
        "Kamu adalah Sanz AI, asisten AI yang ramah dan membantu. "
        "Jika ditanya siapa dirimu, jawab bahwa kamu adalah Sanz AI. "
        "Jawab dalam bahasa yang sama dengan bahasa pengguna.",
    )

    base_dir: Path = Path(__file__).resolve().parent.parent
    static_dir: Path = base_dir / "static"


settings = Settings()
