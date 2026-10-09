"""Inicialização do Firebase Admin e do cliente Firestore.

O Firestore é organizado por igreja, para que a ADMAV possa ter sede e
congregações no mesmo sistema sem misturar dados:

    igrejas/{igreja_id}
        pessoas/{pessoa_id}
        cargos/{cargo_id}
        celulas/{celula_id}
        eventos/{evento_id}
        lancamentos/{lancamento_id}
    usuarios/{uid}          <- papel e igreja de cada login

Consultas sempre partem de uma subcoleção da igreja, então um vazamento de
dados entre igrejas exigiria erro explícito de código, não esquecimento de
filtro.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials
from google.cloud import firestore
from google.cloud.firestore_v1.async_client import AsyncClient

from app.core.config import settings

logger = logging.getLogger(__name__)


def _preparar_emulador() -> None:
    """Aponta os SDKs para os emuladores quando rodando local."""
    if settings.FIRESTORE_EMULATOR_HOST:
        os.environ["FIRESTORE_EMULATOR_HOST"] = settings.FIRESTORE_EMULATOR_HOST
    if settings.FIREBASE_AUTH_EMULATOR_HOST:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.FIREBASE_AUTH_EMULATOR_HOST


@lru_cache
def init_firebase() -> firebase_admin.App:
    """Inicializa o Firebase Admin uma única vez por processo."""
    _preparar_emulador()

    if firebase_admin._apps:  # já inicializado (ex.: reload do uvicorn)
        return firebase_admin.get_app()

    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
        logger.info("Firebase: credencial por service account JSON")
    else:
        # Cloud Run / gcloud auth application-default login
        cred = credentials.ApplicationDefault()
        logger.info("Firebase: Application Default Credentials")

    return firebase_admin.initialize_app(
        cred, {"projectId": settings.GCP_PROJECT_ID} if settings.GCP_PROJECT_ID else None
    )


@lru_cache
def get_db() -> AsyncClient:
    """Cliente Firestore assíncrono, compartilhado pelo processo."""
    init_firebase()
    return firestore.AsyncClient(
        project=settings.GCP_PROJECT_ID or None,
        database=settings.FIRESTORE_DATABASE,
    )


# --- Atalhos de caminho ---------------------------------------------------

def col_igrejas():
    return get_db().collection("igrejas")


def doc_igreja(igreja_id: str):
    return col_igrejas().document(igreja_id)


def sub(igreja_id: str, nome: str):
    """Subcoleção de uma igreja: sub('sede', 'pessoas')."""
    return doc_igreja(igreja_id).collection(nome)


def col_usuarios():
    return get_db().collection("usuarios")
