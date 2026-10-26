"""Layanan untuk berkomunikasi dengan server Ollama."""

import httpx

from app.core.config import settings


class OllamaError(Exception):
    """Error saat berkomunikasi dengan Ollama, membawa status code HTTP yang sesuai."""

    def __init__(self, detail: str, status_code: int = 500):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


async def generate_reply(prompt: str, model: str | None = None) -> tuple[str, str]:
    """Kirim prompt ke Ollama dan kembalikan (balasan, nama_model yang dipakai)."""
    selected_model = model or settings.ollama_model
    payload = {
        "model": selected_model,
        "prompt": prompt,
        "system": settings.system_prompt,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            response = await client.post(f"{settings.ollama_base_url}/api/generate", json=payload)
    except httpx.TimeoutException:
        raise OllamaError("Ollama membutuhkan waktu terlalu lama untuk menjawab.", 504)
    except httpx.HTTPError as exc:
        raise OllamaError(f"Gagal menghubungi Ollama: {exc}", 502)

    if response.status_code != 200:
        raise OllamaError(f"Ollama error: {response.text}", response.status_code)

    return response.json().get("response", ""), selected_model


async def get_version() -> str:
    """Ambil versi Ollama, atau string status jika tidak dapat dijangkau."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{settings.ollama_base_url}/api/version")
        if response.status_code == 200:
            return f"online (v{response.json().get('version', 'unknown')})"
        return f"error (HTTP {response.status_code})"
    except httpx.HTTPError as exc:
        return f"unreachable ({exc})"


async def list_models() -> dict:
    """Ambil daftar model yang tersedia di Ollama."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.ollama_base_url}/api/tags")
    except httpx.HTTPError as exc:
        raise OllamaError(f"Gagal menghubungi Ollama: {exc}", 502)

    if response.status_code != 200:
        raise OllamaError(response.text, response.status_code)

    return response.json()
