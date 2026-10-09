from pathlib import Path

import pytest
from fastapi import HTTPException

from app.core.security import (
    Identidade,
    celula_do_escopo,
    exigir_pessoa_no_escopo,
)
from app.models.enums import PapelUsuario


def identidade(papel: PapelUsuario, celula_id: str | None = None) -> Identidade:
    return Identidade(
        uid="usuario-teste",
        email="teste@example.com",
        nome="Pessoa Teste",
        papel=papel,
        igreja_id="sede",
        celula_id=celula_id,
    )


def test_lider_sem_celula_falha_de_forma_segura():
    with pytest.raises(HTTPException) as erro:
        celula_do_escopo(identidade(PapelUsuario.LIDER_CELULA))

    assert erro.value.status_code == 403


def test_lider_so_pode_ver_pessoa_da_propria_celula():
    lider = identidade(PapelUsuario.LIDER_CELULA, "celula-a")

    exigir_pessoa_no_escopo(lider, {"celula_id": "celula-a"})

    with pytest.raises(HTTPException) as erro:
        exigir_pessoa_no_escopo(lider, {"celula_id": "celula-b"})

    assert erro.value.status_code == 404


def test_outros_papeis_nao_recebem_restricao_de_celula():
    secretaria = identidade(PapelUsuario.SECRETARIA)

    assert celula_do_escopo(secretaria) is None
    exigir_pessoa_no_escopo(secretaria, {"celula_id": "qualquer"})


def test_regras_do_firestore_nao_liberam_cliente_direto():
    regras = (Path(__file__).resolve().parents[2] / "firebase" / "firestore.rules").read_text(
        encoding="utf-8"
    )

    assert "allow read, write: if false;" in regras
    assert "allow read: if " not in regras
