"""Endpoint chat AI."""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest, ChatResponse, ChatStreamRequest
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
async def chat_stream(payload: ChatStreamRequest):
    """Endpoint chat streaming dengan validasi messages."""
    if not payload.messages or len(payload.messages) == 0:
        raise HTTPException(status_code=400, detail="messages kosong")

    return StreamingResponse(
        ollama_service.stream_chat(payload.messages, payload.model),
        media_type="text/event-stream",
    )
