"""Acesso ao Firestore para Eventos e Lançamentos financeiros."""

from __future__ import annotations

from app.core.datas import hoje_na_sede

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from google.cloud.firestore_v1 import FieldFilter

from app.core.firebase import sub
from app.models.enums import TipoLancamento

EVENTOS = "eventos"
LANCAMENTOS = "lancamentos"


def _iso(d: date) -> str:
    """Datas viram string 'AAAA-MM-DD'.

    Ordena lexicograficamente igual a cronologicamente, e o filtro por
    competência ('AAAA-MM') vira comparação de prefixo — sem malabarismo
    de fuso, que é o que quebra relatório de igreja.
    """
    return d.isoformat()


# --- Eventos --------------------------------------------------------------


async def listar_eventos(
    igreja_id: str, *, desde: date | None = None, limite: int | None = None
) -> list[dict]:
    consulta = sub(igreja_id, EVENTOS)
    if desde:
        consulta = consulta.where(filter=FieldFilter("data", ">=", _iso(desde)))
    consulta = consulta.order_by("data")
    if limite:
        consulta = consulta.limit(limite)
    return [{"id": d.id, **(d.to_dict() or {})} async for d in consulta.stream()]


async def obter_evento(igreja_id: str, evento_id: str) -> dict | None:
    snap = await sub(igreja_id, EVENTOS).document(evento_id).get()
    return {"id": snap.id, **(snap.to_dict() or {})} if snap.exists else None


async def criar_evento(igreja_id: str, dados: dict) -> str:
    dados = dict(dados)
    if isinstance(dados.get("data"), date):
        dados["data"] = _iso(dados["data"])
    dados["criado_em"] = datetime.now(UTC)
    ref = sub(igreja_id, EVENTOS).document()
    await ref.set(dados)
    return ref.id


async def atualizar_evento(igreja_id: str, evento_id: str, dados: dict) -> None:
    dados = dict(dados)
    if isinstance(dados.get("data"), date):
        dados["data"] = _iso(dados["data"])
    await sub(igreja_id, EVENTOS).document(evento_id).update(dados)


async def remover_evento(igreja_id: str, evento_id: str) -> None:
    await sub(igreja_id, EVENTOS).document(evento_id).delete()


async def proximo_evento(igreja_id: str) -> dict | None:
    eventos = await listar_eventos(igreja_id, desde=hoje_na_sede(), limite=1)
    return eventos[0] if eventos else None


# --- Financeiro -----------------------------------------------------------


async def listar_lancamentos(
    igreja_id: str,
    *,
    competencia: str | None = None,
    tipo: TipoLancamento | None = None,
    pessoa_id: str | None = None,
) -> list[dict]:
    """Lista lançamentos, opcionalmente de uma competência 'AAAA-MM'."""
    consulta = sub(igreja_id, LANCAMENTOS)

    if competencia:
        consulta = consulta.where(
            filter=FieldFilter("data", ">=", f"{competencia}-01")
        ).where(filter=FieldFilter("data", "<=", f"{competencia}-31"))
    if tipo:
        consulta = consulta.where(filter=FieldFilter("tipo", "==", tipo.value))
    if pessoa_id:
        consulta = consulta.where(filter=FieldFilter("pessoa_id", "==", pessoa_id))

    itens = [{"id": d.id, **(d.to_dict() or {})} async for d in consulta.stream()]
    return sorted(itens, key=lambda x: x.get("data", ""), reverse=True)


async def criar_lancamento(igreja_id: str, dados: dict, criado_por: str) -> str:
    dados = dict(dados)
    if isinstance(dados.get("data"), date):
        dados["data"] = _iso(dados["data"])
    # Dinheiro vira centavos inteiros: float em Firestore perde precisão e
    # prestação de contas de igreja não pode fechar com centavo de diferença.
    dados["valor_centavos"] = int(Decimal(str(dados.pop("valor"))) * 100)
    dados["criado_por"] = criado_por
    dados["criado_em"] = datetime.now(UTC)
    ref = sub(igreja_id, LANCAMENTOS).document()
    await ref.set(dados)
    return ref.id


async def atualizar_lancamento(igreja_id: str, lanc_id: str, dados: dict) -> None:
    dados = dict(dados)
    if isinstance(dados.get("data"), date):
        dados["data"] = _iso(dados["data"])
    if "valor" in dados:
        dados["valor_centavos"] = int(Decimal(str(dados.pop("valor"))) * 100)
    await sub(igreja_id, LANCAMENTOS).document(lanc_id).update(dados)


async def remover_lancamento(igreja_id: str, lanc_id: str) -> None:
    await sub(igreja_id, LANCAMENTOS).document(lanc_id).delete()


def valor_de(doc: dict[str, Any]) -> Decimal:
    return Decimal(doc.get("valor_centavos", 0)) / 100


async def resumo_financeiro(igreja_id: str, competencia: str) -> dict[str, Any]:
    """Entradas, saídas e saldo de uma competência 'AAAA-MM'."""
    lancamentos = await listar_lancamentos(igreja_id, competencia=competencia)
    entradas = Decimal(0)
    saidas = Decimal(0)
    for lanc in lancamentos:
        valor = valor_de(lanc)
        if lanc.get("tipo") == TipoLancamento.SAIDA.value:
            saidas += valor
        else:
            entradas += valor
    return {
        "competencia": competencia,
        "entradas": entradas,
        "saidas": saidas,
        "saldo": entradas - saidas,
        "total_lancamentos": len(lancamentos),
    }


async def contar_celulas(igreja_id: str) -> int:
    total = 0
    async for doc in sub(igreja_id, "celulas").select(["ativa"]).stream():
        if (doc.to_dict() or {}).get("ativa", True):
            total += 1
    return total
