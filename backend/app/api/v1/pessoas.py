"""Rotas de Pessoas, Cargos, Células e Aniversariantes."""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from app.core.datas import hoje_na_sede
from app.schemas.base import DocumentoId
from app.services.vinculos import exigir_registro, validar_vinculos

from app.core.security import (
    PODE_EDITAR_PESSOAS,
    PODE_VER_FINANCEIRO,
    PODE_VER_PESSOAS,
    Identidade,
    celula_do_escopo,
    exigir_pessoa_no_escopo,
    exige,
)
from app.models.enums import DIAS_SEMANA_PT, GrupoCargo, SituacaoPessoa
from app.repositories import pessoas as repo
from app.schemas.comuns import (
    CargoCreate,
    CargoOut,
    CargoUpdate,
    CelulaCreate,
    CelulaOut,
    CelulaUpdate,
    GrupoResumo,
)
from app.schemas.pessoa import (
    ListaAniversariantes,
    PessoaOpcao,
    PessoaCreate,
    PessoaOut,
    PessoaUpdate,
)
from app.services import aniversariantes as serv_aniv

router = APIRouter()


# =========================== Pessoas ======================================

@router.get("/pessoas", response_model=list[PessoaOut], tags=["pessoas"])
async def listar_pessoas(
    grupo: GrupoCargo | None = Query(None, description="Aba de cargo"),
    cargo_id: str | None = None,
    celula_id: str | None = None,
    situacao: SituacaoPessoa | None = None,
    pendentes: bool = Query(False, description="Só cadastros ainda não conferidos"),
    busca: str | None = Query(None, min_length=1, max_length=80),
    arquivados: bool = False,
    user: Identidade = Depends(exige(*PODE_VER_PESSOAS)),
):
    # Líder de célula enxerga apenas a própria célula.
    celula_id = celula_do_escopo(user) or celula_id

    docs = await repo.listar_pessoas(
        user.igreja_id,
        grupo=grupo,
        cargo_id=cargo_id,
        celula_id=celula_id,
        situacao=situacao,
        apenas_pendentes=pendentes,
        busca=busca,
        arquivados=arquivados,
    )
    cargos = await repo.mapa_cargos(user.igreja_id)
    celulas = await repo.mapa_celulas(user.igreja_id)
    return [
        PessoaOut.montar(d["id"], d, cargos=cargos, celulas=celulas) for d in docs
    ]


@router.get("/pessoas/grupos", response_model=list[GrupoResumo], tags=["pessoas"])
async def resumo_por_grupo(user: Identidade = Depends(exige(*PODE_VER_PESSOAS))):
    """Contagem de cada aba — alimenta os números das abas na tela."""
    stats = await repo.estatisticas(
        user.igreja_id, celula_id=celula_do_escopo(user)
    )
    return [
        GrupoResumo(grupo=g, rotulo=g.rotulo, total=stats["por_grupo"].get(g.value, 0))
        for g in GrupoCargo
    ]


@router.get(
    "/pessoas/opcoes-financeiro",
    response_model=list[PessoaOpcao],
    tags=["pessoas"],
)
async def listar_opcoes_financeiro(
    user: Identidade = Depends(exige(*PODE_VER_FINANCEIRO)),
):
    """Return only id and name for financial contribution selectors."""
    return await repo.listar_opcoes_pessoas(user.igreja_id)


@router.get("/pessoas/{pessoa_id}", response_model=PessoaOut, tags=["pessoas"])
async def obter_pessoa(
    pessoa_id: str, user: Identidade = Depends(exige(*PODE_VER_PESSOAS))
):
    doc = await repo.obter_pessoa(user.igreja_id, pessoa_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pessoa não encontrada.")
    exigir_pessoa_no_escopo(user, doc)
    cargos = await repo.mapa_cargos(user.igreja_id)
    celulas = await repo.mapa_celulas(user.igreja_id)
    return PessoaOut.montar(doc["id"], doc, cargos=cargos, celulas=celulas)


@router.post(
    "/pessoas",
    response_model=PessoaOut,
    status_code=status.HTTP_201_CREATED,
    tags=["pessoas"],
)
async def criar_pessoa(
    dados: PessoaCreate, user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))
):
    await validar_vinculos(user.igreja_id, dados.model_dump())
    pessoa_id = await repo.criar_pessoa(user.igreja_id, dados, criado_por=user.uid)
    doc = await repo.obter_pessoa(user.igreja_id, pessoa_id)
    cargos = await repo.mapa_cargos(user.igreja_id)
    celulas = await repo.mapa_celulas(user.igreja_id)
    return PessoaOut.montar(doc["id"], doc, cargos=cargos, celulas=celulas)  # type: ignore[arg-type]


@router.patch("/pessoas/{pessoa_id}", response_model=PessoaOut, tags=["pessoas"])
async def atualizar_pessoa(
    pessoa_id: str,
    dados: PessoaUpdate,
    user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS)),
):
    anterior = await repo.obter_pessoa(user.igreja_id, pessoa_id)
    if not anterior:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pessoa não encontrada.")
    await validar_vinculos(user.igreja_id, dados.model_dump(exclude_unset=True), anterior)
    await repo.atualizar_pessoa(user.igreja_id, pessoa_id, dados)
    doc = await repo.obter_pessoa(user.igreja_id, pessoa_id)
    cargos = await repo.mapa_cargos(user.igreja_id)
    celulas = await repo.mapa_celulas(user.igreja_id)
    return PessoaOut.montar(doc["id"], doc, cargos=cargos, celulas=celulas)  # type: ignore[arg-type]


@router.delete(
    "/pessoas/{pessoa_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["pessoas"],
)
async def remover_pessoa(
    pessoa_id: str, user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))
):
    if not await repo.obter_pessoa(user.igreja_id, pessoa_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pessoa não encontrada.")
    await repo.remover_pessoa(user.igreja_id, pessoa_id)


@router.post("/pessoas/conferir", tags=["pessoas"])
async def conferir_cadastros(
    ids: list[DocumentoId] = Body(
        ..., embed=True, max_length=450, description="IDs dos cadastros conferidos na tela"
    ),
    user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS)),
):
    """Marca cadastros vindos do formulário como conferidos pela secretaria."""
    total = await repo.marcar_revisados(user.igreja_id, ids)
    return {"conferidos": total}


# ======================== Aniversariantes =================================

@router.get(
    "/aniversariantes",
    response_model=ListaAniversariantes,
    tags=["aniversariantes"],
)
async def listar_aniversariantes(
    mes: int = Query(default=0, ge=0, le=12, description="0 = mês atual"),
    ano: int = Query(default=0, ge=0, le=2100, description="0 = ano atual"),
    grupo: GrupoCargo | None = None,
    user: Identidade = Depends(exige(*PODE_VER_PESSOAS)),
):
    """Aniversariantes do mês, com o texto pronto para compartilhar.

    A Natalia consulta em agosto quem faz aniversário em setembro — a tela
    navega entre meses, então mês e ano são parâmetros, não "hoje".
    """
    hoje = hoje_na_sede()
    return await serv_aniv.montar_lista(
        user.igreja_id,
        mes=mes or hoje.month,
        ano=ano or hoje.year,
        grupo=grupo,
        celula_id=celula_do_escopo(user),
    )


# ============================ Cargos ======================================

@router.get("/cargos", response_model=list[CargoOut], tags=["cargos"])
async def listar_cargos(
    apenas_ativos: bool = False,
    user: Identidade = Depends(exige(*PODE_VER_PESSOAS)),
):
    cargos = await repo.listar_cargos(user.igreja_id, apenas_ativos)
    contagem = await repo.contar_por_cargo(
        user.igreja_id, celula_id=celula_do_escopo(user)
    )
    return [CargoOut.montar(c["id"], c, contagem.get(c["id"], 0)) for c in cargos]


@router.post(
    "/cargos",
    response_model=CargoOut,
    status_code=status.HTTP_201_CREATED,
    tags=["cargos"],
)
async def criar_cargo(
    dados: CargoCreate, user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))
):
    cargo_id = await repo.criar_cargo(user.igreja_id, dados.model_dump(mode="json"))
    return CargoOut.montar(cargo_id, dados.model_dump(mode="json"), 0)


@router.patch("/cargos/{cargo_id}", tags=["cargos"])
async def atualizar_cargo(
    cargo_id: str,
    dados: CargoUpdate,
    user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS)),
):
    corpo = dados.model_dump(mode="json", exclude_unset=True)
    if not corpo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nada para atualizar.")
    await exigir_registro(user.igreja_id, "cargos", cargo_id)
    await repo.atualizar_cargo(user.igreja_id, cargo_id, corpo)
    return {"ok": True}


@router.delete("/cargos/{cargo_id}", tags=["cargos"])
async def remover_cargo(
    cargo_id: str, user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))
):
    """Remove o cargo e desvincula quem o tinha."""
    afetados = await repo.remover_cargo(user.igreja_id, cargo_id)
    return {"removido": True, "pessoas_desvinculadas": afetados}


# ============================ Células =====================================

@router.get("/celulas", response_model=list[CelulaOut], tags=["celulas"])
async def listar_celulas(user: Identidade = Depends(exige(*PODE_VER_PESSOAS))):
    celulas = await repo.listar_celulas(user.igreja_id)
    celula_escopo = celula_do_escopo(user)
    if celula_escopo:
        celulas = [celula for celula in celulas if celula["id"] == celula_escopo]
    contagem = await repo.contar_por_celula(user.igreja_id)
    return [
        CelulaOut(
            id=c["id"],
            nome=c.get("nome", ""),
            lider_id=c.get("lider_id"),
            lider_nome=c.get("lider_nome"),
            dia_semana=c.get("dia_semana"),
            dia_semana_nome=(
                DIAS_SEMANA_PT[c["dia_semana"]] if c.get("dia_semana") is not None else None
            ),
            horario=c.get("horario"),
            endereco=c.get("endereco"),
            ativa=c.get("ativa", True),
            total_pessoas=contagem.get(c["id"], 0),
        )
        for c in celulas
    ]


@router.post(
    "/celulas",
    status_code=status.HTTP_201_CREATED,
    tags=["celulas"],
)
async def criar_celula(
    dados: CelulaCreate, user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))
):
    await validar_vinculos(user.igreja_id, dados.model_dump())
    celula_id = await repo.criar_celula(user.igreja_id, dados.model_dump(mode="json"))
    return {"id": celula_id}


@router.patch("/celulas/{celula_id}", tags=["celulas"])
async def atualizar_celula(
    celula_id: str,
    dados: CelulaUpdate,
    user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS)),
):
    corpo = dados.model_dump(mode="json", exclude_unset=True)
    if not corpo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nada para atualizar.")
    anterior = await exigir_registro(user.igreja_id, "celulas", celula_id)
    await validar_vinculos(user.igreja_id, corpo, anterior)
    await repo.atualizar_celula(user.igreja_id, celula_id, corpo)
    return {"ok": True}


@router.delete("/celulas/{celula_id}", tags=["celulas"])
async def remover_celula(
    celula_id: str, user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))
):
    afetados = await repo.remover_celula(user.igreja_id, celula_id)
    return {"removida": True, "pessoas_desvinculadas": afetados}
