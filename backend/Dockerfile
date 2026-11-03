# ==========================================
# Meeting Intelligence System - Backend Dockerfile
# ==========================================
FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MIS_DATA_DIR=/app/data

WORKDIR /app

# Install system dependencies including ffmpeg for audio processing and curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .

RUN python -m pip install --upgrade pip \
    && python -m pip install -v -r requirements.txt

# Copy application source code
COPY . .

# Ensure storage directories exist
RUN mkdir -p /app/data/uploads \
    /app/data/processed \
    /app/data/vectors \
    /app/data/exports \
    /app/data/tmp \
    /app/instance

EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
