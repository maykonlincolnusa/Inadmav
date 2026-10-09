# syntax=docker/dockerfile:1

# --- Estágio de build: instala as dependências isoladamente ---------------
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /install
COPY requirements.txt .
RUN pip install --prefix=/opt/deps -r requirements.txt


# --- Imagem final ---------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/opt/deps/lib/python3.12/site-packages:/app \
    PATH="/opt/deps/bin:$PATH"

# Roda sem privilégio: se a aplicação for comprometida, o atacante não é root.
RUN useradd --create-home --uid 1000 inadmav

COPY --from=builder /opt/deps /opt/deps

WORKDIR /app
COPY --chown=inadmav:inadmav app ./app

USER inadmav

# O Cloud Run injeta PORT; 8080 é o padrão quando roda local.
ENV PORT=8080
EXPOSE 8080

# Um worker por instância: o Cloud Run escala por instância, não por
# processo, e mais workers só disputariam a mesma CPU.
CMD exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
