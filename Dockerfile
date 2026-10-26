FROM python:3.11-slim

WORKDIR /app

# Salin requirement.txt dan pasang dependencies
COPY requirement.txt .
RUN pip install --no-cache-dir -r requirement.txt

# Salin seluruh kode aplikasi ke dalam container
COPY app ./app

EXPOSE 8000

# Jalankan aplikasi FastAPI menggunakan uvicorn dengan auto-reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
