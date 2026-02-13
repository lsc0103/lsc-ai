# ============================================================
# LSC-AI IDP OCR Service — PaddleOCR FastAPI Microservice
# CPU-only, OpenEuler compatible, Apache 2.0 licensed
# ============================================================

# --- Stage 1: Model downloader ---
FROM python:3.11-slim AS model-downloader

RUN pip install --no-cache-dir paddlepaddle==3.0.0 paddleocr==3.0.2

# Pre-download PP-OCRv5 Mobile models (det + rec + cls)
# PaddleOCR downloads models on first use; trigger it here
RUN python -c "\
from paddleocr import PaddleOCR; \
ocr = PaddleOCR(use_angle_cls=True, lang='ch', use_gpu=False, show_log=True); \
print('Models downloaded successfully')"

# --- Stage 2: Runtime ---
FROM python:3.11-slim AS runtime

# System dependencies:
#   poppler-utils  — pdf2image needs pdftoimage binary
#   libgl1         — opencv-python-headless needs libGL
#   libglib2.0-0   — opencv dependency
#   wget           — healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy pre-downloaded models from Stage 1
COPY --from=model-downloader /root/.paddleocr /root/.paddleocr

# Copy application code
COPY app/ ./app/

# Environment
ENV PYTHONUNBUFFERED=1
ENV WORKERS=2

EXPOSE 8001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --spider --quiet http://localhost:8001/api/v1/health || exit 1

# Start with uvicorn
CMD uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers ${WORKERS}
