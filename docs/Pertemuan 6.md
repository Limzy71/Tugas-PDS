# **Panduan Manual — Embedding (Module 11)** 

Panduan ini menjelaskan langkah-langkah untuk mereproduksi setup embedding NALA **secara manual** (tanpa Claude Code). 

Prasyarat: branch feature/knowledge-base dengan setup knowledge base (Module 10) sudah selesai — lihat docs/panduan-manual-knowledge-base.md. Container ollama + api masih berjalan. 

## **1. Pull model embedding nomic-embed-text** 

Belum pernah dipakai sejak module-module sebelumnya — di-pull lewat docker compose exec, sama seperti llama3.2:3b: 

docker compose exec ollama ollama pull nomic-embed-text 

Cek keduanya sudah terdaftar: 

docker compose exec ollama ollama list 

✅ llama3.2:3b dan nomic-embed-text harus muncul berdua. 

**Test manual lewat curl** (opsional): 

curl http://localhost:11434/api/embed \ 

-d '{"model": "nomic-embed-text", "input": "Ini adalah contoh teks untuk di-embed"}' 

Response JSON berisi "embeddings": [[...768 angka...]]. 

## **2. Buat app/embeddings.py** 

File baru, terpisah dari app/ollama_client.py — ini utilitas embedding (dipakai nanti oleh RAG chain di Module 14), bukan bagian dari chat client: 

import httpx 

def embed_text(text: str, base_url: str, model: str = "nomic-embed-text") -> list[float]: with httpx.Client() as client: response = client.post( f"{base_url}/api/embed", json={"model": model, "input": text}, timeout=60.0, ) response.raise_for_status() return response.json()["embeddings"][0] 

Penjelasan singkat: 

- Memanggil endpoint /api/embed Ollama — berbeda dari /api/generate (generate()) dan /api/chat (chat_stream()). 

- response.json()["embeddings"][0] — Ollama selalu membalas embeddings sebagai **array of array** (mendukung banyak input sekaligus), walau di sini cuma kirim satu text, makanya diambil elemen pertama ([0]). 

- Fungsi ini **belum dipanggil** dari endpoint mana pun — baru dipakai saat RAG chain dibangun (Module 14). 

## **3. Build ulang & verifikasi** 

docker compose up --build -d api 

### **Cek 1 — dimensi vektor benar 768:** 

docker compose exec api python -c "from app.embeddings import embed_text; vec = embed_text('Mahasiswa mengajukan cuti akademik', base_url='http://ollama:11434'); print(f'Dimensi: {len(vec)}'); print(f'Contoh nilai: {vec[:3]}')" 

✅ Harus mencetak Dimensi: 768 dan tiga angka desimal contoh. 

**Cek 2 — hasil deterministik (teks sama → vektor identik):** 

docker compose exec api python -c "from app.embeddings import embed_text; v1 = embed_text('tes determinisme', base_url='http://ollama:11434'); v2 = embed_text('tes determinisme', base_url='http://ollama:11434'); print('identik:', v1 == v2)" 

✅ Harus mencetak identik: True — beda dengan generate()/chat_stream() yang jawabannya bisa bervariasi tiap kali dipanggil, embedding murni hasil perhitungan matematis tanpa elemen acak. 

### **Cek 3 — endpoint chat lama belum terganggu:** 

curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/chat/stream \ -H "Content-Type: application/json" -d '{"messages": []}' 

✅ Harus 400 (bukan 500/error lain). 

## **4. Checklist sebelum lanjut ke module berikutnya (Vector Store)** 

- [ ] nomic-embed-text ter-pull dan muncul di docker compose exec ollama ollama list 

- [ ] embed_text() menghasilkan vektor 768 dimensi 

- [ ] Embedding untuk teks yang sama selalu identik kalau dipanggil berulang kali 

- [ ] /chat/stream masih berfungsi seperti sebelumnya 

## **Troubleshooting** 

- **Internal Server Error saat memanggil embed_text()** : cek model mana yang belum ter-pull (docker compose exec ollama ollama list) — dibutuhkan dua model sekaligus: llama3.2:3b dan nomic-embed-text. Kalau salah satu tidak muncul, ulangi langkah pull yang sesuai. 

Setelah semua tercentang, lanjut ke module berikutnya — menyimpan vektor-vektor ini di vector store (OpenSearch) supaya bisa dicari berdasarkan kemiripan makna. 

# **Panduan Manual — Setup Knowledge Base (Module 10)** 

Panduan ini menjelaskan langkah-langkah untuk mereproduksi setup knowledge base NALA **secara manual** (tanpa Claude Code), kalau suatu saat perlu dikerjakan ulang dari awal atau dijelaskan ke orang lain. 

Prasyarat: branch feature/knowledge-base sudah ada, container ollama + api dari Module 7-8 (chat streaming) sudah berjalan. 

## **1. Buat folder knowledge-base/** 

Di root project (NALA/), buat folder baru: 

mkdir -p knowledge-base 

Folder ini akan berisi dokumen SOP yang jadi satu-satunya sumber jawaban NALA nanti (dibangun di Module 14 — RAG). Formatnya bebas: .md, .txt, atau .pdf. 

## **2. Isi dengan dokumen SOP (data seed)** 

Tulis minimal dua dokumen SOP pendek sebagai data awal. Untuk NALA versi akademik, dua contoh yang dipakai: 

- knowledge-base/sop-cuti-akademik.md — syarat, tahapan, dokumen, estimasi waktu pengajuan cuti akademik. 

- knowledge-base/sop-pendaftaran-krs.md — syarat SKS berdasarkan IPS, tahapan pengisian KRS, masa revisi. 

Setiap dokumen sebaiknya punya struktur konsisten: **Tujuan** , **Syarat Umum** , **Tahapan Proses** , **Dokumen yang Diperlukan** , **Estimasi Waktu** — supaya nanti gampang di-embed dan dicari (Module 11-14). 

Dokumen boleh pendek (1-2 halaman) di tahap ini — versi pertama RAG (Module 14) mengembed satu dokumen utuh jadi satu vektor, belum ada chunking (baru masuk Module 15). 

## **3. Hubungkan folder ke container lewat bind mount** 

Edit docker-compose.yml, tambahkan volumes: dan environment variable baru di service api: 

services: ollama: image: ollama/ollama:latest ports: - "11434:11434" volumes: - ollama_data:/root/.ollama api: build: . ports: - "8000:8000" environment: - OLLAMA_BASE_URL=http://ollama:11434 - OLLAMA_MODEL=llama3.2:3b - KNOWLEDGE_BASE_PATH=/app/knowledge-base volumes: - ./knowledge-base:/app/knowledge-base depends_on: - ollama volumes: ollama_data: 

Catatan: 

- ./knowledge-base:/app/knowledge-base adalah **bind mount** (bukan named volume seperti ollama_data) — perubahan file di folder host langsung terlihat di dalam container tanpa rebuild image. 

- KNOWLEDGE_BASE_PATH sengaja ditulis sebagai environment variable (bukan dihardcode di kode Python) supaya path-nya satu sumber kebenaran. 

## **4. Baca environment variable di app/main.py** 

Tambahkan konstanta baru, dekat OLLAMA_BASE_URL/OLLAMA_MODEL yang sudah ada: 

KNOWLEDGE_BASE_PATH = os.environ.get("KNOWLEDGE_BASE_PATH", "/app/knowledgebase") 

Konstanta ini **belum dipakai** fungsi apa pun di tahap ini — baru dipakai mulai Module 14 (RAG) dan Module 16 (upload dokumen). 

## **5. Pastikan dependency pypdf tersedia** 

Cek requirements.txt sudah berisi: 

pypdf==5.1.0 

(Kalau project dimulai dari starter yang belum punya ini, tambahkan baris di atas.) 

## **6. Buat app/ingest.py — fungsi extract_text()** 

File baru, isinya akan terus bertambah di module-module berikutnya (chunking di Module 15, ingest_documents() di Module 14): 

from pypdf import PdfReader 

def extract_text(file_path: str) -> str: if file_path.endswith(".pdf"): reader = PdfReader(file_path) return "\n".join(page.extract_text() or "" for page in reader.pages) with open(file_path, "r") as f: return f.read() 

Penjelasan singkat: 

- File .pdf dibuka lewat PdfReader, teks tiap halaman digabung dengan \n. page.extract_text() or "" mencegah error kalau ada halaman yang gagal diekstrak (hasilnya None). 

- File .md/.txt cukup dibaca langsung — isinya dikembalikan **apa adanya, utuh** , belum dipecah jadi potongan (chunking baru Module 15). 

- Fungsi ini belum dipanggil dari endpoint mana pun — baru dipakai Module 14. 

## **7. Build ulang & verifikasi** 

Karena ada perubahan docker-compose.yml dan file Python baru, rebuild image api: 

docker compose up --build -d api 

**Cek 1 — dokumen benar-benar terlihat dari dalam container:** 

docker compose exec api ls -la /app/knowledge-base 

✅ Harus muncul sop-cuti-akademik.md dan sop-pendaftaran-krs.md. **Cek 2 — extract_text() bisa baca isi file:** 

docker compose exec api python -c " from app.ingest import extract_text text = extract_text('/app/knowledge-base/sop-cuti-akademik.md') print(repr(text[:60])) print(f'Panjang total: {len(text)} karakter') " 

✅ Harus mencetak potongan awal isi file dan panjang totalnya (bukan error). 

**Cek 3 — endpoint chat lama belum terganggu:** 

curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/chat/stream \ -H "Content-Type: application/json" -d '{"messages": []}' 

✅ Harus 400 (validasi "messages kosong"), bukan 500/error lain — tanda /chat/stream masih berjalan normal. 

## **8. Checklist sebelum lanjut ke module berikutnya (Embedding)** 

- [ ] Folder knowledge-base/ berisi minimal dua dokumen SOP 

- [ ] Dokumen terlihat di dalam container lewat docker compose exec api ls /app/knowledge-base 

- [ ] extract_text() pada file .md mengembalikan isi file apa adanya, utuh 

   - [ ] extract_text() pada file .pdf (kalau ada) berhasil mengekstrak teks lewat pypdf 

- 

- [ ] /chat/stream masih berfungsi seperti sebelumnya — module ini belum menyentuhnya 

Setelah semua tercentang, lanjut ke module embedding — mengubah isi dokumen ini jadi vektor numerik supaya bisa dicari (retrieval). 

# **Panduan Manual — Vector Store: Menyalakan OpenSearch (Module 12)** 

Panduan ini menjelaskan langkah-langkah untuk mereproduksi setup OpenSearch NALA **secara manual** (tanpa Claude Code). 

Prasyarat: Module 10 (Knowledge Base) dan Module 11 (Embedding) sudah selesai. Container ollama + api masih berjalan. 

**Prasyarat RAM** : pastikan Docker Desktop dialokasikan RAM 16GB+ (Settings → Resources). OpenSearch cukup berat untuk RAM Docker yang mepet. 

## **1. Tambah service opensearch di dockercompose.yml** 

services: ollama: image: ollama/ollama:latest ports: - "11434:11434" volumes: - ollama_data:/root/.ollama 

opensearch: image: opensearchproject/opensearch:2.11.0 environment: - discovery.type=single-node - plugins.security.disabled=true - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m - DISABLE_INSTALL_DEMO_CONFIG=true ports: - "9200:9200" volumes: - opensearch_data:/usr/share/opensearch/data 

api: 

build: . ports: - "8000:8000" 

environment: 

- OLLAMA_BASE_URL=http://ollama:11434 

- OLLAMA_MODEL=llama3.2:3b - KNOWLEDGE_BASE_PATH=/app/knowledge-base 

- OPENSEARCH_BASE_URL=http://opensearch:9200 volumes: 

- ./knowledge-base:/app/knowledge-base depends_on: - ollama - opensearch 

volumes: ollama_data: opensearch_data: 

Penjelasan singkat tiap environment variable opensearch: 

- discovery.type=single-node — OpenSearch normalnya didesain cluster banyak node; flag ini bilang "cuma 1 node", supaya tidak menunggu node lain yang tidak akan pernah muncul. 

- plugins.security.disabled=true — matikan autentikasi/TLS bawaan, wajar untuk lingkungan lokal supaya httpx/curl bisa langsung akses tanpa setup certificate. 

- DISABLE_INSTALL_DEMO_CONFIG=true — cegah OpenSearch install konfigurasi keamanan demo (sertifikat TLS + user admin/admin bawaan) saat start pertama kali — startup lebih cepat dan bersih. 

- OPENSEARCH_BASE_URL=http://opensearch:9200 di service api — disiapkan untuk dibaca VectorStore yang dibangun di module berikutnya; belum dipakai kode apa pun di tahap ini. 

## **2. Nyalakan OpenSearch** 

docker compose up -d --build opensearch 

Proses ini **bisa terasa lama** (OpenSearch perlu inisialisasi cluster). Tunggu sampai sehat: 

docker compose logs -f opensearch 

Tunggu sampai log menunjukkan cluster berjalan tanpa error fatal, lalu Ctrl+C untuk keluar (service tetap jalan di background). Cek status cluster: 

curl "http://localhost:9200/_cluster/health?pretty" 

✅ **Indikator sukses** : "status": "green" atau "status": "yellow" — **bukan** "red". 

**Troubleshooting vm.max_map_count** : kalau OpenSearch gagal start/restart terus dengan error terkait vm.max_map_count, jalankan sekali (akan reset setelah restart Docker Desktop): 

docker run --rm --privileged --pid=host alpine sysctl -w vm.max_map_count=262144 

Lalu ulangi docker compose up -d --build opensearch. 

## **3. Nyalakan OpenSearch Dashboards (UI visual)** 

_# docker-compose.yml, sejajar dengan service opensearch_ opensearch-dashboards: image: opensearchproject/opensearch-dashboards:2.11.0 environment: - 'OPENSEARCH_HOSTS=["http://opensearch:9200"]' - DISABLE_SECURITY_DASHBOARDS_PLUGIN=true ports: - "5601:5601" depends_on: - opensearch docker compose up -d --build opensearch-dashboards docker compose logs -f opensearch-dashboards 

Tunggu sampai muncul log Server running at http://0.0.0.0:5601, lalu Ctrl+C. Buka http://localhost:5601 di browser. 

✅ **Indikator sukses** : halaman OpenSearch Dashboards terbuka tanpa error (skip "create tenant"/login kalau muncul, karena security plugin sudah dimatikan). 

## **4. Rebuild api supaya OPENSEARCH_BASE_URL terload** 

docker compose up --build -d api 

## **5. Buktikan OpenSearch bisa simpan & cari vektor sungguhan** 

Bisa lewat **Dev Tools** di http://localhost:5601 (menu hamburger ☰ → Management → Dev Tools), atau lewat curl langsung seperti di bawah ini — dua-duanya setara. 

### **a. Buat index dengan mapping vektor:** 

curl -X PUT "http://localhost:9200/nala-docs-test" -H 'Content-Type: application/json' -d '{ "settings": { "index": { "knn": true } }, "mappings": { "properties": { "text": { "type": "text" }, "embedding": { "type": "knn_vector", "dimension": 768, "method": { "engine": "nmslib", "space_type": "cosinesimil", "name": "hnsw" } }, "metadata": { "type": "object" } } } }' 

✅ Respons {"acknowledged": true, ...}. 

### **b. Ambil embedding sungguhan dari Ollama, lalu simpan sebagai dokumen:** 

EMB=$(curl -sS http://localhost:11434/api/embed -d '{"model": "nomic-embed-text", "input": "Mahasiswa mengajukan cuti akademik lewat portal kampus"}' | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['embeddings'][0]))") 

curl -X PUT "http://localhost:9200/nala-docs-test/_doc/test-1?refresh=true" -H 'Content-Type: application/json' -d "{\"text\": \"Mahasiswa mengajukan cuti akademik lewat portal kampus\", \"embedding\": $EMB, \"metadata\": {\"source\": \"manual-test\"}}" 

### **c. Cari pakai kalimat query yang kata-katanya beda sama sekali dari dokumen aslinya:** 

QEMB=$(curl -sS http://localhost:11434/api/embed -d '{"model": "nomic-embed-text", "input": "bagaimana cara izin tidak kuliah satu semester"}' | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['embeddings'][0]))") 

curl -X POST "http://localhost:9200/nala-docs-test/_search" -H 'Content-Type: application/json' -d "{\"size\": 3, \"query\": {\"knn\": {\"embedding\": {\"vector\": $QEMB, \"k\": 3}}}}" 

✅ **Indikator sukses** : hasil pencarian menampilkan dokumen test-1 walau query-nya ("izin tidak kuliah satu semester") sama sekali tidak menyebut kata "cuti" atau "akademik" — bukti nyata pencarian **semantik** (berdasarkan makna), bukan pencocokan kata kunci literal. 

### **d. Bersihkan index test:** 

curl -X DELETE "http://localhost:9200/nala-docs-test" 

## **6. Verifikasi /chat/stream tidak terganggu** 

curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/chat/stream \ -H "Content-Type: application/json" -d '{"messages": []}' 

✅ Harus 400 seperti biasa (bukan error lain) — module ini murni infrastruktur, belum ada kode Python yang memanggil OpenSearch. 

## **7. Catatan penting — isolasi volume Docker** 

Kalau nama folder project kamu kebetulan sama (case-insensitive) dengan project lain yang juga pakai Docker Compose di komputer yang sama, **keduanya bisa berbagi volume Docker yang sama** (nama project Compose diturunkan dari nama folder). Cek dengan: 

docker volume ls 

Kalau ingin memastikan datanya terisolasi, set COMPOSE_PROJECT_NAME unik lewat file .env di root project: 

COMPOSE_PROJECT_NAME=nala-academic 

⚠️� Mengubah nama project akan membuat volume baru yang kosong — model Ollama yang sudah ter-pull perlu di-pull ulang di volume baru. 

## **8. Checklist sebelum lanjut ke module berikutnya (Semantic Search)** 

- [ ] docker compose logs opensearch / curl .../_cluster/health menunjukkan status green/yellow, bukan red 

- [ ] http://localhost:5601 (OpenSearch Dashboards) terbuka di browser tanpa error 

- [ ] Index test berhasil dibuat dan diisi, dan pencarian k-NN manual menemukan dokumen walau kata query berbeda dari kata dokumen aslinya 

- [ ] /chat/stream masih berfungsi seperti sebelumnya 

Setelah semua tercentang, lanjut ke module berikutnya — membangun class VectorStore di Python (ensure_index(), index_document(), search()) yang mengotomasi persis langkah 5 di atas, supaya tidak perlu lagi menyalin-tempel array 768 angka secara manual. 

