"""Acesso ao Firestore para Pessoas, Cargos e Células.

Todas as funções recebem `igreja_id` explicitamente. Não existe consulta
"global" — o escopo da igreja é parâmetro obrigatório, não convenção.
"""

from __future__ import annotations

import unicodedata
from datetime import UTC, datetime
from typing import Any

from google.cloud.firestore_v1 import FieldFilter
from google.cloud.firestore_v1.base_query import BaseCompositeFilter

from app.core.firebase import get_db, sub
from app.core.datas import hoje_na_sede
from app.models.enums import (
    CARGOS_PADRAO,
    GrupoCargo,
    OrigemCadastro,
    SituacaoPessoa,
)
from app.schemas.pessoa import (
    Nascimento,
    PessoaCreate,
    PessoaPublicaCreate,
    PessoaUpdate,
)

PESSOAS = "pessoas"
CARGOS = "cargos"
CELULAS = "celulas"
LIMITE_LOTE = 450


def normalizar(texto: str) -> str:
    """Minúsculas sem acento, para busca que perdoa a digitação.

    'José' e 'jose' precisam achar a mesma pessoa — o Firestore não faz
    busca textual, então gravamos a versão normalizada junto.
    """
    sem_acento = unicodedata.normalize("NFKD", texto or "")
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return sem_acento.casefold().strip()


def _doc_pessoa(dados: dict[str, Any], nascimento: Nascimento | None) -> dict[str, Any]:
    """Achata o nascimento em campos indexáveis.

    `nasc_mes` isolado é o que torna "aniversariantes de setembro" uma
    consulta indexada em vez de leitura da coleção inteira.
    """
    dados = dict(dados)
    dados.pop("nascimento", None)
    dados["nasc_dia"] = nascimento.dia if nascimento else None
    dados["nasc_mes"] = nascimento.mes if nascimento else None
    dados["nasc_ano"] = nascimento.ano if nascimento else None
    if nome := dados.get("nome"):
        dados["nome_busca"] = normalizar(nome)
    return dados


# --- Cargos ---------------------------------------------------------------


async def semear_cargos(igreja_id: str) -> int:
    """Cria os cargos padrão numa igreja nova.

    A nomenclatura varia entre ministérios; a secretaria edita depois pela
    API sem precisar de deploy.
    """
    col = sub(igreja_id, CARGOS)
    existentes = [d async for d in col.limit(1).stream()]
    if existentes:
        return 0

    lote = get_db().batch()
    for nome, grupo, ordem in CARGOS_PADRAO:
        lote.set(
            col.document(),
            {"nome": nome, "grupo": grupo.value, "ordem": ordem, "ativo": True},
        )
    await lote.commit()
    return len(CARGOS_PADRAO)


async def listar_cargos(igreja_id: str, apenas_ativos: bool = False) -> list[dict]:
    col = sub(igreja_id, CARGOS)
    if apenas_ativos:
        col = col.where(filter=FieldFilter("ativo", "==", True))
    itens = [
        {"id": d.id, **(d.to_dict() or {})} async for d in col.stream()
    ]
    return sorted(itens, key=lambda c: (c.get("ordem", 100), c.get("nome", "")))


async def mapa_cargos(igreja_id: str) -> dict[str, dict]:
    return {c["id"]: c for c in await listar_cargos(igreja_id)}


async def criar_cargo(igreja_id: str, dados: dict) -> str:
    ref = sub(igreja_id, CARGOS).document()
    await ref.set(dados)
    return ref.id


async def atualizar_cargo(igreja_id: str, cargo_id: str, dados: dict) -> None:
    await sub(igreja_id, CARGOS).document(cargo_id).update(dados)


async def remover_cargo(igreja_id: str, cargo_id: str) -> int:
    """Desvincula quem tinha o cargo antes de apagá-lo.

    Deixar `cargo_id` apontando para documento inexistente produziria fichas
    com cargo em branco sem explicação.
    """
    afetados = 0
    consulta = sub(igreja_id, PESSOAS).where(
        filter=FieldFilter("cargo_id", "==", cargo_id)
    )
    lote = get_db().batch()
    no_lote = 0
    async for doc in consulta.stream():
        lote.update(doc.reference, {"cargo_id": None})
        afetados += 1
        no_lote += 1
        if no_lote == LIMITE_LOTE:
            await lote.commit()
            lote = get_db().batch()
            no_lote = 0
    if no_lote:
        await lote.commit()
    await sub(igreja_id, CARGOS).document(cargo_id).delete()
    return afetados


# --- Células --------------------------------------------------------------


async def listar_celulas(igreja_id: str) -> list[dict]:
    col = sub(igreja_id, CELULAS)
    itens = [{"id": d.id, **(d.to_dict() or {})} async for d in col.stream()]
    return sorted(itens, key=lambda c: normalizar(c.get("nome", "")))


async def mapa_celulas(igreja_id: str) -> dict[str, dict]:
    return {c["id"]: c for c in await listar_celulas(igreja_id)}


async def criar_celula(igreja_id: str, dados: dict) -> str:
    ref = sub(igreja_id, CELULAS).document()
    await ref.set(dados)
    return ref.id


async def atualizar_celula(igreja_id: str, celula_id: str, dados: dict) -> None:
    await sub(igreja_id, CELULAS).document(celula_id).update(dados)


async def remover_celula(igreja_id: str, celula_id: str) -> int:
    afetados = 0
    consulta = sub(igreja_id, PESSOAS).where(
        filter=FieldFilter("celula_id", "==", celula_id)
    )
    lote = get_db().batch()
    no_lote = 0
    async for doc in consulta.stream():
        lote.update(doc.reference, {"celula_id": None})
        afetados += 1
        no_lote += 1
        if no_lote == LIMITE_LOTE:
            await lote.commit()
            lote = get_db().batch()
            no_lote = 0
    if no_lote:
        await lote.commit()
    await sub(igreja_id, CELULAS).document(celula_id).delete()
    return afetados


async def contar_por_celula(igreja_id: str) -> dict[str, int]:
    contagem: dict[str, int] = {}
    async for doc in sub(igreja_id, PESSOAS).select(["celula_id", "arquivado"]).stream():
        if (doc.to_dict() or {}).get("arquivado"):
            continue
        cid = (doc.to_dict() or {}).get("celula_id")
        if cid:
            contagem[cid] = contagem.get(cid, 0) + 1
    return contagem


# --- Pessoas --------------------------------------------------------------


async def criar_pessoa(
    igreja_id: str,
    dados: PessoaCreate | PessoaPublicaCreate,
    *,
    origem: OrigemCadastro = OrigemCadastro.MANUAL,
    revisado: bool = True,
    criado_por: str | None = None,
) -> str:
    agora = datetime.now(UTC)
    corpo = dados.model_dump(mode="json", exclude_none=False)
    corpo = _doc_pessoa(corpo, dados.nascimento)
    corpo.update(
        {
            "origem": origem.value,
            "revisado": revisado,
            "criado_em": agora,
            "atualizado_em": agora,
            "criado_por": criado_por,
        }
    )
    ref = sub(igreja_id, PESSOAS).document()
    await ref.set(corpo)
    return ref.id


async def obter_pessoa(igreja_id: str, pessoa_id: str) -> dict | None:
    snap = await sub(igreja_id, PESSOAS).document(pessoa_id).get()
    if not snap.exists:
        return None
    return {"id": snap.id, **(snap.to_dict() or {})}


async def listar_opcoes_pessoas(igreja_id: str) -> list[dict[str, str]]:
    """List only the data required to identify a person in a selector."""
    itens = [
        {"id": doc.id, "nome": (doc.to_dict() or {}).get("nome") or ""}
        async for doc in sub(igreja_id, PESSOAS).select(["nome", "arquivado"]).stream()
        if not (doc.to_dict() or {}).get("arquivado")
    ]
    return sorted(itens, key=lambda pessoa: normalizar(pessoa["nome"]))


async def atualizar_pessoa(
    igreja_id: str, pessoa_id: str, dados: PessoaUpdate
) -> bool:
    corpo = dados.model_dump(mode="json", exclude_unset=True)
    if not corpo:
        return False

    if "nascimento" in corpo:
        corpo = _doc_pessoa(corpo, dados.nascimento)
    elif "nome" in corpo:
        corpo["nome_busca"] = normalizar(corpo["nome"])

    corpo["atualizado_em"] = datetime.now(UTC)
    await sub(igreja_id, PESSOAS).document(pessoa_id).update(corpo)
    return True


async def atualizar_pessoa_bruto(
    igreja_id: str, pessoa_id: str, campos: dict[str, Any]
) -> None:
    """Grava campos internos que não passam por schema (ex.: ip_origem)."""
    await sub(igreja_id, PESSOAS).document(pessoa_id).update(campos)


async def remover_pessoa(igreja_id: str, pessoa_id: str) -> None:
    # Preserva vínculos financeiros e permite restaurar a ficha.
    await sub(igreja_id, PESSOAS).document(pessoa_id).update(
        {"arquivado": True, "atualizado_em": datetime.now(UTC)}
    )


async def contar_por_cargo(
    igreja_id: str, *, celula_id: str | None = None
) -> dict[str, int]:
    contagem: dict[str, int] = {}
    consulta = sub(igreja_id, PESSOAS)
    if celula_id:
        consulta = consulta.where(filter=FieldFilter("celula_id", "==", celula_id))
    async for doc in consulta.select(["cargo_id", "arquivado"]).stream():
        if (doc.to_dict() or {}).get("arquivado"):
            continue
        cid = (doc.to_dict() or {}).get("cargo_id")
        if cid:
            contagem[cid] = contagem.get(cid, 0) + 1
    return contagem


async def listar_pessoas(
    igreja_id: str,
    *,
    grupo: GrupoCargo | None = None,
    cargo_id: str | None = None,
    celula_id: str | None = None,
    situacao: SituacaoPessoa | None = None,
    apenas_pendentes: bool = False,
    busca: str | None = None,
    arquivados: bool = False,
) -> list[dict]:
    """Lista pessoas com os filtros da tela.

    O filtro por grupo de cargo é resolvido em memória: o grupo mora no
    documento do cargo, não no da pessoa. São dezenas de cargos e no máximo
    alguns milhares de pessoas — desnormalizar o grupo em cada pessoa
    custaria uma migração a cada renomeação de cargo, e a igreja não tem
    volume que justifique isso.
    """
    consulta = sub(igreja_id, PESSOAS)

    filtros = []
    if cargo_id:
        filtros.append(FieldFilter("cargo_id", "==", cargo_id))
    if celula_id:
        filtros.append(FieldFilter("celula_id", "==", celula_id))
    if situacao:
        filtros.append(FieldFilter("situacao", "==", situacao.value))
    if apenas_pendentes:
        filtros.append(FieldFilter("revisado", "==", False))

    if len(filtros) == 1:
        consulta = consulta.where(filter=filtros[0])
    elif filtros:
        consulta = consulta.where(
            filter=BaseCompositeFilter("AND", filtros)  # type: ignore[arg-type]
        )

    itens = [{"id": d.id, **(d.to_dict() or {})} async for d in consulta.stream()]
    itens = [p for p in itens if bool(p.get("arquivado", False)) == arquivados]

    if grupo is not None:
        cargos = await mapa_cargos(igreja_id)

        def do_grupo(p: dict) -> bool:
            cargo = cargos.get(p.get("cargo_id") or "")
            atual = GrupoCargo(cargo["grupo"]) if cargo else GrupoCargo.MEMBRESIA
            return atual is grupo

        itens = [p for p in itens if do_grupo(p)]

    if busca:
        alvo = normalizar(busca)
        itens = [
            p
            for p in itens
            if alvo in p.get("nome_busca", normalizar(p.get("nome", "")))
            or alvo in normalizar(p.get("telefone") or "")
            or alvo in normalizar(p.get("email") or "")
            or alvo in normalizar(p.get("endereco") or "")
        ]

    return sorted(itens, key=lambda p: normalizar(p.get("nome", "")))


async def aniversariantes_do_mes(igreja_id: str, mes: int) -> list[dict]:
    """Quem faz aniversário no mês — a consulta que a igreja mais faz.

    Indexada por (nasc_mes, nasc_dia). Ver firebase/firestore.indexes.json.
    """
    consulta = (
        sub(igreja_id, PESSOAS)
        .where(filter=FieldFilter("nasc_mes", "==", mes))
        .order_by("nasc_dia")
    )
    return [
        {"id": d.id, **(d.to_dict() or {})} async for d in consulta.stream()
        if not (d.to_dict() or {}).get("arquivado")
    ]


async def contar_pendentes(igreja_id: str) -> int:
    consulta = sub(igreja_id, PESSOAS).where(
        filter=FieldFilter("revisado", "==", False)
    )
    total = 0
    async for _ in consulta.select([]).stream():
        total += 1
    return total


async def marcar_revisados(igreja_id: str, ids: list[str]) -> int:
    """Marca cadastros do formulário como conferidos pela secretaria."""
    lote = get_db().batch()
    total = 0
    no_lote = 0

    # IDs explícitos: uma busca filtrada jamais confere registros invisíveis.
    for pid in dict.fromkeys(ids):
        doc = await obter_pessoa(igreja_id, pid)
        if not doc or doc.get("arquivado") or doc.get("revisado", True):
            continue
        lote.update(sub(igreja_id, PESSOAS).document(pid), {
            "revisado": True, "atualizado_em": datetime.now(UTC),
        })
        total += 1
        no_lote += 1
        if no_lote == LIMITE_LOTE:
            await lote.commit()
            lote = get_db().batch()
            no_lote = 0

    if no_lote:
        await lote.commit()
    return total


async def contar_cadastros_recentes_do_ip(
    igreja_id: str, ip: str, desde: datetime
) -> int:
    """Anti-abuso do formulário aberto: quantos vieram deste IP na última hora."""
    consulta = (
        sub(igreja_id, PESSOAS)
        .where(filter=FieldFilter("ip_origem", "==", ip))
        .where(filter=FieldFilter("criado_em", ">=", desde))
    )
    total = 0
    async for _ in consulta.select([]).stream():
        total += 1
    return total


async def estatisticas(igreja_id: str, *, celula_id: str | None = None) -> dict[str, Any]:
    """Contagens do painel numa varredura só."""
    cargos = await mapa_cargos(igreja_id)
    hoje = hoje_na_sede()

    total = 0
    por_situacao: dict[str, int] = {}
    por_grupo: dict[str, int] = {g.value: 0 for g in GrupoCargo}
    com_cargo = 0
    pendentes = 0
    sem_contato = 0
    sem_nascimento = 0
    aniv_mes: list[tuple[int, str]] = []

    consulta = sub(igreja_id, PESSOAS)
    if celula_id:
        consulta = consulta.where(filter=FieldFilter("celula_id", "==", celula_id))

    async for doc in consulta.stream():
        p = doc.to_dict() or {}
        if p.get("arquivado"):
            continue
        total += 1
        if not p.get("telefone") and not p.get("email"):
            sem_contato += 1
        if not p.get("nasc_dia") or not p.get("nasc_mes"):
            sem_nascimento += 1

        situacao = p.get("situacao", SituacaoPessoa.MEMBRO.value)
        por_situacao[situacao] = por_situacao.get(situacao, 0) + 1

        cargo = cargos.get(p.get("cargo_id") or "")
        grupo = cargo["grupo"] if cargo else GrupoCargo.MEMBRESIA.value
        por_grupo[grupo] = por_grupo.get(grupo, 0) + 1
        if cargo and grupo != GrupoCargo.MEMBRESIA.value:
            com_cargo += 1

        if not p.get("revisado", True):
            pendentes += 1

        if p.get("nasc_mes") == hoje.month and p.get("nasc_dia"):
            aniv_mes.append((p["nasc_dia"], p.get("nome", "")))

    aniv_mes.sort()
    proximo = next(
        (nome for dia, nome in aniv_mes if dia >= hoje.day),
        None,
    )

    return {
        "total": total,
        "por_situacao": por_situacao,
        "por_grupo": por_grupo,
        "com_cargo": com_cargo,
        "pendentes": pendentes,
        "sem_contato": sem_contato,
        "sem_nascimento": sem_nascimento,
        "aniversariantes_mes": len(aniv_mes),
        "proximo_aniversariante": proximo,
    }
