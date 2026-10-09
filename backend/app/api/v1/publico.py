"""Formulário público de cadastro — a única rota sem autenticação.

Serve o caso que a Natalia precisa: um tablet na entrada da igreja, ou um
link no grupo do WhatsApp, onde a própria pessoa preenche os dados e eles
caem direto na lista da secretaria.

Como é rota aberta, ela é deliberadamente estreita:
  - grava sempre com `revisado=False` — entra na lista marcado como novo,
    nunca como membro conferido;
  - aceita menos campos que o cadastro interno;
  - tem limite por IP;
  - devolve apenas o primeiro nome de volta, nunca dados de terceiros.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.firebase import doc_igreja
from app.core.security import ip_do_cliente
from app.models.enums import OrigemCadastro
from app.repositories import pessoas as repo
from app.schemas.pessoa import PessoaPublicaCreate
from app.services.vinculos import validar_vinculos

router = APIRouter(tags=["público"])


class OpcoesFormulario(BaseModel):
    """O que o formulário aberto precisa saber para se desenhar."""

    igreja_nome: str
    ativo: bool
    cargos: list[dict]
    celulas: list[dict]


class RespostaCadastro(BaseModel):
    ok: bool
    primeiro_nome: str
    mensagem: str


async def _igreja_ativa(igreja_id: str) -> dict:
    snap = await doc_igreja(igreja_id).get()
    if not snap.exists:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Igreja não encontrada.")
    dados = snap.to_dict() or {}
    if not settings.CADASTRO_PUBLICO_ATIVO or not dados.get(
        "cadastro_publico_ativo", True
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "O cadastro online está fechado no momento. Procure a secretaria.",
        )
    return dados


@router.get("/publico/{igreja_id}/formulario", response_model=OpcoesFormulario)
async def opcoes_do_formulario(igreja_id: str):
    """Dados para montar o formulário: nome da igreja, cargos e células."""
    igreja = await _igreja_ativa(igreja_id)
    cargos = await repo.listar_cargos(igreja_id, apenas_ativos=True)
    celulas = await repo.listar_celulas(igreja_id)
    return OpcoesFormulario(
        igreja_nome=igreja.get("nome", "Igreja"),
        ativo=True,
        cargos=[
            {"id": c["id"], "nome": c["nome"], "grupo": c["grupo"]} for c in cargos
        ],
        celulas=[
            {"id": c["id"], "nome": c.get("nome", "")}
            for c in celulas
            if c.get("ativa", True)
        ],
    )


@router.post(
    "/publico/{igreja_id}/cadastro",
    response_model=RespostaCadastro,
    status_code=status.HTTP_201_CREATED,
)
async def cadastro_publico(
    igreja_id: str, dados: PessoaPublicaCreate, request: Request
):
    await _igreja_ativa(igreja_id)
    await validar_vinculos(igreja_id, dados.model_dump())

    ip = ip_do_cliente(request)
    uma_hora_atras = datetime.now(UTC) - timedelta(hours=1)
    recentes = await repo.contar_cadastros_recentes_do_ip(
        igreja_id, ip, uma_hora_atras
    )
    if recentes >= settings.CADASTRO_PUBLICO_RATE_LIMIT:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Muitos cadastros deste aparelho. Tente de novo mais tarde.",
        )

    pessoa_id = await repo.criar_pessoa(
        igreja_id,
        dados,
        origem=OrigemCadastro.FORMULARIO,
        revisado=False,  # entra como novo, aguardando conferência
    )
    # Guarda o IP só para o limite acima; não sai em nenhuma resposta.
    await repo.atualizar_pessoa_bruto(igreja_id, pessoa_id, {"ip_origem": ip})

    primeiro = dados.nome.split()[0]
    return RespostaCadastro(
        ok=True,
        primeiro_nome=primeiro,
        mensagem=(
            f"Obrigado, {primeiro}! Seu cadastro foi enviado para a secretaria."
        ),
    )
