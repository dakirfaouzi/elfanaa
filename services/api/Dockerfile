# ─────────────────────────────────────────────────────────────────────────────
# ELFANAA backend — Dockerfile
# Multi-stage build keeps the runtime image small (no compiler toolchain).
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Build deps for asyncpg + cryptography wheels on slim images.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --upgrade pip \
 && pip install --user -r requirements.txt


# ── Runtime image ────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

ENV APP_ENV=production \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/home/app/.local/bin:${PATH}"

# Run as a non-root user — defence in depth.
RUN useradd --create-home --shell /bin/bash app
WORKDIR /home/app/api

# Runtime libs only — no compilers in the final image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq5 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=app:app /root/.local /home/app/.local
COPY --chown=app:app . /home/app/api

USER app

EXPOSE 8000

# Healthcheck — EasyPanel uses this to gate routing during a deploy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
