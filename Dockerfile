# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY server/ ./server/
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail http://127.0.0.1:5000/health/ready || exit 1

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "5000", "--workers", "2"]
