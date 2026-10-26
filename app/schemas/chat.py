"""Skema request/response untuk endpoint chat."""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Pertanyaan atau instruksi untuk AI")
    model: str | None = Field(None, description="Nama model Ollama (opsional, default dari konfigurasi)")


class ChatResponse(BaseModel):
    reply: str
    model: str
