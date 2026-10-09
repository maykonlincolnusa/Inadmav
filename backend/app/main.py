"""inAdmav — API de gestão da igreja.

Roda em Cloud Run, guarda os dados no Firestore e autentica pelo Firebase.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import agenda, pessoas, publico, secretaria
from app.core.config import settings
from app.core.firebase import init_firebase

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Falhar aqui é melhor que falhar na primeira requisição do usuário.
    init_firebase()
    logger.info(
        "inAdmav iniciado — ambiente=%s projeto=%s",
        settings.ENV,
        settings.GCP_PROJECT_ID or "(padrão)",
    )
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="Gestão de membresia, cargos, aniversariantes e finanças da igreja.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENV != "prod" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.ENV != "prod" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(ValueError)
async def erro_de_valor(request: Request, exc: ValueError):
    """Erro de regra de domínio vira 400 com mensagem legível.

    As validações do Pydantic falam português ("Fevereiro não tem dia 31"),
    e essa mensagem serve direto na tela — não faz sentido escondê-la.
    """
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(exc)}
    )


api = APIRouter(prefix=settings.API_V1_PREFIX)
api.include_router(pessoas.router)
api.include_router(agenda.router)
api.include_router(publico.router)
api.include_router(secretaria.router)
app.include_router(api)


@app.get("/health", tags=["infra"], include_in_schema=False)
async def health():
    """Sonda do Cloud Run. Não toca no Firestore de propósito: um problema
    de banco não deve derrubar e recriar as instâncias em loop."""
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.ENV}


@app.get("/", include_in_schema=False)
async def raiz():
    return {"app": settings.APP_NAME, "docs": "/docs" if settings.ENV != "prod" else None}
