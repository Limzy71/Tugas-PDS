import os
import math
from typing import List, Optional
import httpx

# Konfigurasi dasar dari environment
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "30.0"))


async def get_embedding_async(
    text: str,
    model: Optional[str] = None,
    base_url: Optional[str] = None
) -> List[float]:
    """
    Menghasilkan vektor embedding dari model Ollama secara asynchronous.

    Args:
        text (str): Teks yang akan diubah menjadi representasi vektor numerik.
        model (str, optional): Model embedding (default: nomic-embed-text).
        base_url (str, optional): URL Ollama (default: http://ollama:11434).

    Returns:
        List[float]: Vektor embedding (untuk nomic-embed-text berukuran 768 dimensi).
    """
    model_name = model or OLLAMA_EMBED_MODEL
    url = (base_url or OLLAMA_BASE_URL).rstrip("/")

    if not text or not text.strip():
        raise ValueError("Teks input tidak boleh kosong.")

    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        payload = {
            "model": model_name,
            "prompt": text.strip()
        }
        response = await client.post(f"{url}/api/embeddings", json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("embedding", [])


def get_embedding(
    text: str,
    model: Optional[str] = None,
    base_url: Optional[str] = None
) -> List[float]:
    """
    Menghasilkan vektor embedding dari model Ollama secara synchronous.

    Args:
        text (str): Teks yang akan diubah menjadi embedding.
        model (str, optional): Model embedding (default: nomic-embed-text).
        base_url (str, optional): URL Ollama (default: http://ollama:11434).

    Returns:
        List[float]: Vektor embedding berupa daftar float (768 dimensi).
    """
    model_name = model or OLLAMA_EMBED_MODEL
    url = (base_url or OLLAMA_BASE_URL).rstrip("/")

    if not text or not text.strip():
        raise ValueError("Teks input tidak boleh kosong.")

    with httpx.Client(timeout=OLLAMA_TIMEOUT) as client:
        payload = {
            "model": model_name,
            "prompt": text.strip()
        }
        response = client.post(f"{url}/api/embeddings", json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("embedding", [])


async def get_embeddings_batch(
    texts: List[str],
    model: Optional[str] = None,
    base_url: Optional[str] = None
) -> List[List[float]]:
    """
    Menghasilkan embedding untuk sekumpulan teks (batch) secara berurutan.

    Args:
        texts (List[str]): Kumpulan teks yang akan di-embed.
        model (str, optional): Nama model embedding.
        base_url (str, optional): URL dasar Ollama.

    Returns:
        List[List[float]]: Daftar vektor embedding untuk masing-masing teks.
    """
    embeddings = []
    for t in texts:
        emb = await get_embedding_async(t, model=model, base_url=base_url)
        embeddings.append(emb)
    return embeddings


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Menghitung kemiripan kosinus (Cosine Similarity) antara dua vektor numerik.

    Nilai berkisar antara -1.0 hingga 1.0:
    - 1.0: Teks memiliki makna/konteks yang identik.
    - Mendekati 0: Teks tidak memiliki hubungan makna.
    """
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm_a = math.sqrt(sum(a * a for a in vec1))
    norm_b = math.sqrt(sum(b * b for b in vec2))

    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0

    return dot_product / (norm_a * norm_b)


if __name__ == "__main__":
    print("=== Pengujian Mandiri app/embeddings.py ===")
    kalimat1 = "Kecerdasan Buatan dan Machine Learning"
    kalimat2 = "Artificial Intelligence and Deep Learning"
    kalimat3 = "Resep membuat nasi goreng spesial"

    try:
        print(f"Mengambil embedding kalimat 1: '{kalimat1}'...")
        v1 = get_embedding(kalimat1)
        print(f"Dimensi vektor: {len(v1)} dimensi.")

        print(f"Mengambil embedding kalimat 2: '{kalimat2}'...")
        v2 = get_embedding(kalimat2)

        print(f"Mengambil embedding kalimat 3: '{kalimat3}'...")
        v3 = get_embedding(kalimat3)

        sim_1_2 = cosine_similarity(v1, v2)
        sim_1_3 = cosine_similarity(v1, v3)

        print("\n=== Hasil Analisis Semantic Similarity ===")
        print(f"Kemiripan ('{kalimat1}' & '{kalimat2}'): {sim_1_2:.4f} (Tinggi/Relevan)")
        print(f"Kemiripan ('{kalimat1}' & '{kalimat3}'): {sim_1_3:.4f} (Rendah/Tidak Terkait)")
    except Exception as err:
        print(f"Error saat pengujian embedding: {err}")

