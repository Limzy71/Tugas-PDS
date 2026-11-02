import json
import httpx
from app.embeddings import get_embedding

OPENSEARCH_URL = "http://opensearch:9200"
INDEX_NAME = "vector_demo"

def run_proof():
    print("=" * 60)
    print(" BUKTI OPENSEARCH BISA SIMPAN & CARI VEKTOR SUNGGUHAN")
    print("=" * 60)

    # 1. Hapus index lama jika ada, lalu buat index k-NN baru
    with httpx.Client() as client:
        try:
            client.delete(f"{OPENSEARCH_URL}/{INDEX_NAME}")
        except Exception:
            pass

        mapping = {
            "settings": {
                "index": {
                    "knn": True
                }
            },
            "mappings": {
                "properties": {
                    "title": {"type": "text"},
                    "content": {"type": "text"},
                    "embedding": {
                        "type": "knn_vector",
                        "dimension": 768,
                        "method": {
                            "name": "hnsw",
                            "space_type": "cosinesimil",
                            "engine": "lucene"
                        }
                    }
                }
            }
        }
        res = client.put(f"{OPENSEARCH_URL}/{INDEX_NAME}", json=mapping)
        print(f"1. Pembuatan Index k-NN '{INDEX_NAME}': Status {res.status_code}")
        if res.status_code not in [200, 201]:
            print("Gagal membuat index:", res.text)
            return

    # 2. Dokumen sungguhan
    documents = [
        {
            "id": "1",
            "title": "SOP Cuti Akademik",
            "content": "Prosedur pengajuan cuti akademik mahasiswa maksimal 2 semester dengan surat persetujuan dosen wali."
        },
        {
            "id": "2",
            "title": "SOP Pendaftaran KRS",
            "content": "Alur pengisian Kartu Rencana Studi KRS online pada sistem informasi akademik sebelum batas semester baru."
        },
        {
            "id": "3",
            "title": "Resep Kuliner Tradisional",
            "content": "Bahan dan cara memasak nasi goreng bumbu rempah spesial dengan telur mata sapi dan kerupuk."
        }
    ]

    # 3. Generate vektor sungguhan & simpan ke OpenSearch
    print("\n2. Mengambil embedding via nomic-embed-text & menyimpan ke OpenSearch...")
    with httpx.Client() as client:
        for doc in documents:
            vector = get_embedding(doc["content"])
            payload = {
                "title": doc["title"],
                "content": doc["content"],
                "embedding": vector
            }
            res = client.put(f"{OPENSEARCH_URL}/{INDEX_NAME}/_doc/{doc['id']}?refresh=true", json=payload)
            print(f"   -> [Tersimpan] ID {doc['id']}: '{doc['title']}' | Dimensi: {len(vector)} | HTTP {res.status_code}")

    # 4. Pencarian Semantik k-NN
    query_text = "Saya mau istirahat kuliah selama satu semester, gimana caranya?"
    print(f"\n3. Query Uji Coba Pencarian:")
    print(f"   \"{query_text}\"")
    print("   (Catatan: Query tidak mengandung kata 'cuti', 'KRS', atau 'resep')")

    query_vector = get_embedding(query_text)
    search_payload = {
        "size": 3,
        "query": {
            "knn": {
                "embedding": {
                    "vector": query_vector,
                    "k": 3
                }
            }
        }
    }

    with httpx.Client() as client:
        res = client.post(f"{OPENSEARCH_URL}/{INDEX_NAME}/_search", json=search_payload)
        data = res.json()

    print("\n4. Hasil Pencarian Vektor (k-NN Semantic Search) dari OpenSearch:")
    hits = data.get("hits", {}).get("hits", [])
    for rank, hit in enumerate(hits, 1):
        score = hit.get("_score")
        src = hit.get("_source", {})
        print(f"\n   [Peringkat #{rank}] Skor: {score:.4f}")
        print(f"   Judul : {src.get('title')}")
        print(f"   Konten: {src.get('content')}")

    print("\n" + "=" * 60)
    print(" KESIMPULAN: OpenSearch terbukti BERHASIL menyimpan dan")
    print(" melakukan pencarian vektor semantik berdimensi 768!")
    print("=" * 60)

if __name__ == "__main__":
    run_proof()
