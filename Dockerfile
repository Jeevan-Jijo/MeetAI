# ==========================================
# Meeting Intelligence System - Unified Root Dockerfile
# Builds complete application (Backend + Frontend) in one container
# ==========================================

# ------------------------------------------
# Stage 1: Build Next.js Frontend
# ------------------------------------------
FROM node:20-alpine AS frontend-builder
RUN apk add --no-cache libc6-compat
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

# Build-time environment variable arguments
ARG NEXT_PUBLIC_API_BASE_URL="/api/v1"
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ------------------------------------------
# Stage 2: Final Full-Stack Runtime
# ------------------------------------------
FROM python:3.12-slim AS runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MIS_DATA_DIR=/app/data \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

WORKDIR /app

# Install system dependencies: ffmpeg for audio, curl for healthchecks, nodejs for frontend runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    build-essential \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend dependencies
COPY backend/requirements.txt /app/backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy Backend Application
COPY backend /app/backend

# Copy Frontend Standalone Build
WORKDIR /app/frontend
COPY --from=frontend-builder /app/frontend/public ./public
COPY --from=frontend-builder /app/frontend/.next/standalone ./
COPY --from=frontend-builder /app/frontend/.next/static ./.next/static

WORKDIR /app

# Ensure runtime directories exist
RUN mkdir -p /app/data/uploads \
    /app/data/processed \
    /app/data/vectors \
    /app/data/exports \
    /app/data/tmp \
    /app/instance

# Copy entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000 3000

# Healthcheck verifies both backend and frontend ports
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/ && curl -f http://localhost:3000/ || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["all"]
