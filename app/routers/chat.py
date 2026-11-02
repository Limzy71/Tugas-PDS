"""Endpoint chat AI."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest, ChatResponse
from app.services import ollama_service
from app.services.ollama_service import OllamaError

router = APIRouter(tags=["Chat"])


@router.post("/api/chat", response_model=ChatResponse)
@router.post("/chat", response_model=ChatResponse, include_in_schema=False)
async def chat(payload: ChatRequest) -> ChatResponse:
    """Kirim prompt ke Ollama dan kembalikan balasannya."""
    try:
        reply, model = await ollama_service.generate_reply(payload.prompt, payload.model)
    except OllamaError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    return ChatResponse(reply=reply, model=model)


@router.post("/chat/stream")
@router.post("/api/chat/stream", include_in_schema=False)
async def chat_stream(payload: ChatRequest):
    """Streaming chat token demi token secara real-time dari model Ollama."""
    try:
        return StreamingResponse(
            ollama_service.generate_stream(payload.prompt, payload.model),
            media_type="text/plain",
        )
    except OllamaError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
