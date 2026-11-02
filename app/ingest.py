import os
from pathlib import Path
from typing import List, Dict
import pypdf

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Mengekstrak teks dari seluruh halaman file PDF menggunakan library pypdf.

    Args:
        pdf_path (str): Path ke file PDF.

    Returns:
        str: Gabungan teks dari semua halaman PDF.
    """
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"File PDF tidak ditemukan di path: {pdf_path}")

    reader = pypdf.PdfReader(pdf_path)
    extracted_pages = []

    for idx, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        cleaned_text = text.strip()
        if cleaned_text:
            extracted_pages.append(cleaned_text)

    return "\n\n".join(extracted_pages)


def extract_text(file_path: str) -> str:
    """
    Fungsi utama untuk mengekstrak teks dari file dokumen.
    Mendukung format: .pdf, .txt, .md

    Args:
        file_path (str): Path ke file yang akan diekstrak.

    Returns:
        str: Teks hasil ekstraksi yang bersih.

    Raises:
        FileNotFoundError: Jika file tidak ditemukan.
        ValueError: Jika format file tidak didukung.
    """
    path = Path(file_path)

    if not path.is_file():
        raise FileNotFoundError(f"File tidak ditemukan di path: {file_path}")

    extension = path.suffix.lower()

    if extension == ".pdf":
        return extract_text_from_pdf(str(path))
    elif extension in [".txt", ".md"]:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read().strip()
    else:
        raise ValueError(f"Ekstensi file '{extension}' tidak didukung. Gunakan .pdf, .txt, atau .md")


def extract_text_by_pages(pdf_path: str) -> List[Dict[str, any]]:
    """
    Mengekstrak teks dari file PDF per halaman beserta metadata halaman.

    Args:
        pdf_path (str): Path ke file PDF.

    Returns:
        List[Dict[str, any]]: Daftar halaman berisi nomor halaman dan teks.
    """
    if not os.path.isfile(pdf_path):
        raise FileNotFoundError(f"File PDF tidak ditemukan di path: {pdf_path}")

    reader = pypdf.PdfReader(pdf_path)
    pages_data = []

    for idx, page in enumerate(reader.pages):
        text = (page.extract_text() or "").strip()
        pages_data.append({
            "page": idx + 1,
            "text": text,
            "char_count": len(text)
        })

    return pages_data


if __name__ == "__main__":
    # Pengujian mandiri
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    test_files = [
        os.path.join(base_dir, "data", "contoh_dokumen.txt"),
        os.path.join(base_dir, "data", "sample.pdf")
    ]

    print("=== Pengujian Modul ingest.py ===")
    for file_path in test_files:
        if os.path.exists(file_path):
            print(f"\n[Mengekstrak {os.path.basename(file_path)}]:")
            try:
                result = extract_text(file_path)
                print(f"Hasil ekstraksi ({len(result)} karakter):")
                print(result if result else "(Teks kosong)")
            except Exception as err:
                print(f"Error: {err}")
        else:
            print(f"\nFile pengujian tidak ditemukan: {file_path}")

