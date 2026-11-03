"""Layanan untuk berkomunikasi dengan server Ollama dan OpenSearch RAG."""

import httpx

from app.core.config import settings


class OllamaError(Exception):
    """Error saat berkomunikasi dengan Ollama, membawa status code HTTP yang sesuai."""

    def __init__(self, detail: str, status_code: int = 500):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


async def search_relevant_context(query: str, top_k: int = 2) -> str:
    """Cari dokumen relevan di OpenSearch menggunakan k-NN vector search."""
    try:
        from app.embeddings import embed_text

        query_vector = embed_text(query, base_url=settings.ollama_base_url)

        payload = {
            "size": top_k,
            "query": {
                "knn": {
                    "embedding": {
                        "vector": query_vector,
                        "k": top_k,
                    }
                }
            },
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            for index_name in ["math-ai-docs", "nala-docs-test"]:
                try:
                    resp = await client.post(
                        f"{settings.opensearch_base_url}/{index_name}/_search",
                        json=payload,
                    )
                    if resp.status_code == 200:
                        hits = resp.json().get("hits", {}).get("hits", [])
                        relevant_texts = [
                            h["_source"]["text"]
                            for h in hits
                            if h.get("_score", 0) > 0.65 and "text" in h.get("_source", {})
                        ]
                        if relevant_texts:
                            return "\n\n".join(relevant_texts)
                except Exception:
                    continue
    except Exception:
        pass
    return ""


async def generate_reply(
    prompt: str,
    model: str | None = None,
    history: list[dict] | None = None,
) -> tuple[str, str]:
    """Kirim prompt ke Ollama dengan konteks RAG OpenSearch dan riwayat percakapan."""
    selected_model = model or settings.ollama_model

    # 1. Tentukan query pencarian (sertakan konteks sebelumnya jika kalimat sangat singkat)
    search_query = prompt
    if history and len(prompt.split()) <= 4:
        last_user = next((m["content"] for m in reversed(history) if m.get("role") == "user"), "")
        if last_user:
            search_query = f"{last_user} {prompt}"

    # 2. Cari dokumen di OpenSearch
    context = await search_relevant_context(search_query)

    # 3. Susun system prompt dengan konteks OpenSearch
    system_prompt = settings.system_prompt
    if context:
        system_prompt += (
            f"\n\n[Konteks Informasi dari Basis Pengetahuan OpenSearch]:\n"
            f"---\n{context}\n---\n"
            f"Instruksi: Gunakan data konteks di atas untuk memberikan jawaban yang tepat dan akurat."
        )

    # 4. Susun pesan percakapan (mendukung memori percakapan)
    messages = []
    if history:
        for m in history[-6:]:
            if m.get("role") in ("user", "assistant") and m.get("content"):
                messages.append({"role": m["role"], "content": m["content"]})

    if not messages or messages[-1].get("content") != prompt:
        messages.append({"role": "user", "content": prompt})

    payload = {
        "model": selected_model,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            response = await client.post(f"{settings.ollama_base_url}/api/chat", json=payload)
    except httpx.TimeoutException:
        raise OllamaError("Ollama membutuhkan waktu terlalu lama untuk menjawab.", 504)
    except httpx.HTTPError as exc:
        raise OllamaError(f"Gagal menghubungi Ollama: {exc}", 502)

    if response.status_code != 200:
        raise OllamaError(f"Ollama error: {response.text}", response.status_code)

    reply_text = response.json().get("message", {}).get("content", "")
    return reply_text, selected_model


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


async def stream_chat(messages: list[dict], model: str | None = None):
    """Stream balasan chat dari Ollama menggunakan endpoint /api/chat dengan OpenSearch RAG."""
    selected_model = model or settings.ollama_model

    last_user_msg = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
    context = ""
    if last_user_msg:
        context = await search_relevant_context(last_user_msg)

    system_prompt = settings.system_prompt
    if context:
        system_prompt += (
            f"\n\n[Konteks Informasi dari Basis Pengetahuan OpenSearch]:\n"
            f"---\n{context}\n---\n"
            f"Instruksi: Gunakan data konteks di atas untuk memberikan jawaban yang tepat dan akurat."
        )

    payload_messages = [{"role": "system", "content": system_prompt}] + messages
    payload = {
        "model": selected_model,
        "messages": payload_messages,
        "stream": True,
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            async with client.stream("POST", f"{settings.ollama_base_url}/api/chat", json=payload) as response:
                if response.status_code != 200:
                    yield f"Error: Ollama returned status {response.status_code}"
                    return
                async for chunk in response.aiter_text():
                    yield chunk
    except Exception as exc:
        yield f"Error streaming from Ollama: {exc}"
