"""Skema request/response untuk endpoint chat."""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Pertanyaan atau instruksi untuk AI")
    model: str | None = Field(None, description="Nama model Ollama (opsional, default dari konfigurasi)")
    history: list[dict] | None = Field(default=None, description="Riwayat percakapan sebelumnya")


class ChatResponse(BaseModel):
    reply: str
    model: str


class ChatStreamRequest(BaseModel):
    messages: list[dict] = Field(default_factory=list, description="Daftar riwayat percakapan")
    model: str | None = Field(None, description="Nama model Ollama (opsional)")
