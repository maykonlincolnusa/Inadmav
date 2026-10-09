"""Rotas de Eventos, Financeiro, Painel e Usuários."""

from __future__ import annotations

from app.core.datas import hoje_na_sede

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.firebase import col_usuarios, doc_igreja
from app.services.vinculos import exigir_registro, validar_vinculos
from google.cloud.firestore_v1 import FieldFilter
from app.core.security import (
    PODE_EDITAR_FINANCEIRO,
    PODE_EDITAR_PESSOAS,
    PODE_VER_FINANCEIRO,
    PODE_VER_PESSOAS,
    Identidade,
    celula_do_escopo,
    exige,
    usuario_atual,
)
from app.models.enums import GrupoCargo, PapelUsuario, SituacaoPessoa, TipoLancamento
from app.repositories import agenda as repo_ag
from app.repositories import pessoas as repo
from app.schemas.comuns import (
    EventoCreate,
    EventoOut,
    EventoUpdate,
    GrupoResumo,
    IgrejaOut,
    LancamentoCreate,
    LancamentoOut,
    LancamentoUpdate,
    PainelResumo,
    ResumoFinanceiro,
    UsuarioConvite,
    UsuarioOut,
    UsuarioUpdate,
)

router = APIRouter()


def _evento_out(doc: dict) -> EventoOut:
    d = date.fromisoformat(doc["data"]) if isinstance(doc.get("data"), str) else doc["data"]
    return EventoOut(
        id=doc["id"],
        titulo=doc.get("titulo", ""),
        data=d,
        horario=doc.get("horario"),
        local=doc.get("local"),
        descricao=doc.get("descricao"),
        inscritos=doc.get("inscritos", 0),
        ja_passou=d < hoje_na_sede(),
    )


# ============================ Eventos =====================================

@router.get("/eventos", response_model=list[EventoOut], tags=["eventos"])
async def listar_eventos(
    futuros: bool = Query(False, description="Só a partir de hoje"),
    user: Identidade = Depends(exige(*PODE_VER_PESSOAS)),
):
    docs = await repo_ag.listar_eventos(
        user.igreja_id, desde=hoje_na_sede() if futuros else None
    )
    return [_evento_out(d) for d in docs]


@router.post(
    "/eventos",
    response_model=EventoOut,
    status_code=status.HTTP_201_CREATED,
    tags=["eventos"],
)
async def criar_evento(
    dados: EventoCreate, user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))
):
    evento_id = await repo_ag.criar_evento(user.igreja_id, dados.model_dump())
    doc = await repo_ag.obter_evento(user.igreja_id, evento_id)
    return _evento_out(doc)  # type: ignore[arg-type]


@router.patch("/eventos/{evento_id}", response_model=EventoOut, tags=["eventos"])
async def atualizar_evento(
    evento_id: str,
    dados: EventoUpdate,
    user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS)),
):
    if not await repo_ag.obter_evento(user.igreja_id, evento_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evento não encontrado.")
    corpo = dados.model_dump(exclude_unset=True)
    if corpo:
        await repo_ag.atualizar_evento(user.igreja_id, evento_id, corpo)
    doc = await repo_ag.obter_evento(user.igreja_id, evento_id)
    return _evento_out(doc)  # type: ignore[arg-type]


@router.delete(
    "/eventos/{evento_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["eventos"],
)
async def remover_evento(
    evento_id: str, user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))
):
    await repo_ag.remover_evento(user.igreja_id, evento_id)


# ========================== Financeiro ====================================

@router.get(
    "/financeiro/lancamentos",
    response_model=list[LancamentoOut],
    tags=["financeiro"],
)
async def listar_lancamentos(
    competencia: str | None = Query(
        None, pattern=r"^[1-9]\d{3}-(0[1-9]|1[0-2])$", description="AAAA-MM; vazio = mês atual"
    ),
    tipo: TipoLancamento | None = None,
    pessoa_id: str | None = None,
    user: Identidade = Depends(exige(*PODE_VER_FINANCEIRO)),
):
    comp = competencia or hoje_na_sede().strftime("%Y-%m")
    docs = await repo_ag.listar_lancamentos(
        user.igreja_id, competencia=comp, tipo=tipo, pessoa_id=pessoa_id
    )

    # Resolve o nome de quem contribuiu, para o dízimo ter dono no relatório.
    ids = {d["pessoa_id"] for d in docs if d.get("pessoa_id")}
    nomes: dict[str, str] = {}
    for pid in ids:
        if p := await repo.obter_pessoa(user.igreja_id, pid):
            nomes[pid] = p.get("nome", "")

    return [
        LancamentoOut(
            id=d["id"],
            tipo=d["tipo"],
            valor=repo_ag.valor_de(d),
            data=date.fromisoformat(d["data"]),
            categoria=d.get("categoria"),
            descricao=d.get("descricao"),
            pessoa_id=d.get("pessoa_id"),
            pessoa_nome=nomes.get(d.get("pessoa_id") or ""),
            criado_por=d.get("criado_por"),
        )
        for d in docs
    ]


@router.get(
    "/financeiro/resumo", response_model=ResumoFinanceiro, tags=["financeiro"]
)
async def resumo_financeiro(
    competencia: str | None = Query(None, pattern=r"^[1-9]\d{3}-(0[1-9]|1[0-2])$"),
    user: Identidade = Depends(exige(*PODE_VER_FINANCEIRO)),
):
    comp = competencia or hoje_na_sede().strftime("%Y-%m")
    return ResumoFinanceiro(**await repo_ag.resumo_financeiro(user.igreja_id, comp))


@router.post(
    "/financeiro/lancamentos",
    status_code=status.HTTP_201_CREATED,
    tags=["financeiro"],
)
async def criar_lancamento(
    dados: LancamentoCreate,
    user: Identidade = Depends(exige(*PODE_EDITAR_FINANCEIRO)),
):
    await validar_vinculos(user.igreja_id, dados.model_dump())
    lanc_id = await repo_ag.criar_lancamento(
        user.igreja_id, dados.model_dump(), criado_por=user.uid
    )
    return {"id": lanc_id}


@router.patch("/financeiro/lancamentos/{lanc_id}", tags=["financeiro"])
async def atualizar_lancamento(
    lanc_id: str,
    dados: LancamentoUpdate,
    user: Identidade = Depends(exige(*PODE_EDITAR_FINANCEIRO)),
):
    corpo = dados.model_dump(exclude_unset=True)
    if not corpo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nada para atualizar.")
    anterior = await exigir_registro(user.igreja_id, "lancamentos", lanc_id)
    await validar_vinculos(user.igreja_id, corpo, anterior)
    await repo_ag.atualizar_lancamento(user.igreja_id, lanc_id, corpo)
    return {"ok": True}


@router.delete(
    "/financeiro/lancamentos/{lanc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["financeiro"],
)
async def remover_lancamento(
    lanc_id: str, user: Identidade = Depends(exige(*PODE_EDITAR_FINANCEIRO))
):
    await repo_ag.remover_lancamento(user.igreja_id, lanc_id)


# ============================ Painel ======================================

@router.get("/painel", response_model=PainelResumo, tags=["painel"])
async def painel(user: Identidade = Depends(usuario_atual)):
    """Tudo que a tela inicial precisa, numa chamada só."""
    celula_escopo = celula_do_escopo(user)
    stats = await repo.estatisticas(user.igreja_id, celula_id=celula_escopo)
    evento = await repo_ag.proximo_evento(user.igreja_id)

    # O tesoureiro e o admin veem o financeiro; os demais, não.
    resumo_fin = None
    if user.pode(*PODE_VER_FINANCEIRO):
        comp = hoje_na_sede().strftime("%Y-%m")
        resumo_fin = ResumoFinanceiro(
            **await repo_ag.resumo_financeiro(user.igreja_id, comp)
        )

    return PainelResumo(
        total_pessoas=stats["total"],
        total_membros=stats["por_situacao"].get(SituacaoPessoa.MEMBRO.value, 0),
        total_visitantes=stats["por_situacao"].get(SituacaoPessoa.VISITANTE.value, 0),
        total_obreiros=stats["com_cargo"],
        por_grupo=[
            GrupoResumo(
                grupo=g, rotulo=g.rotulo, total=stats["por_grupo"].get(g.value, 0)
            )
            for g in GrupoCargo
        ],
        total_celulas=1 if celula_escopo else await repo_ag.contar_celulas(user.igreja_id),
        aniversariantes_mes=stats["aniversariantes_mes"],
        proximo_aniversariante=stats["proximo_aniversariante"],
        cadastros_pendentes=stats["pendentes"],
        proximo_evento=_evento_out(evento) if evento else None,
        resumo_financeiro=resumo_fin,
        cadastros_sem_contato=stats["sem_contato"],
        cadastros_sem_nascimento=stats["sem_nascimento"],
    )


@router.get("/igreja", response_model=IgrejaOut, tags=["painel"])
async def minha_igreja(user: Identidade = Depends(usuario_atual)):
    snap = await doc_igreja(user.igreja_id).get()
    if not snap.exists:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Igreja não encontrada.")
    return IgrejaOut(id=snap.id, **(snap.to_dict() or {}))


# =========================== Usuários =====================================

@router.get("/eu", response_model=UsuarioOut, tags=["usuarios"])
async def quem_sou_eu(user: Identidade = Depends(usuario_atual)):
    return UsuarioOut(
        uid=user.uid,
        email=user.email,
        nome=user.nome,
        papel=user.papel,
        igreja_id=user.igreja_id,
        celula_id=user.celula_id,
    )


@router.get("/usuarios", response_model=list[UsuarioOut], tags=["usuarios"])
async def listar_usuarios(user: Identidade = Depends(exige())):
    """Somente administradores."""
    itens = []
    async for doc in col_usuarios().where("igreja_id", "==", user.igreja_id).stream():
        d = doc.to_dict() or {}
        itens.append(
            UsuarioOut(
                uid=doc.id,
                email=d.get("email"),
                nome=d.get("nome"),
                papel=PapelUsuario(d.get("papel", PapelUsuario.LEITOR)),
                igreja_id=d.get("igreja_id", user.igreja_id),
                celula_id=d.get("celula_id"),
                ativo=d.get("ativo", True),
                pendente=d.get("pendente", False),
                criado_em=d.get("criado_em"),
            )
        )
    return itens


@router.post("/usuarios/convidar", tags=["usuarios"])
async def convidar_usuario(
    dados: UsuarioConvite, user: Identidade = Depends(exige())
):
    """Libera um e-mail antes dele criar a conta.

    Quando a pessoa entrar pela primeira vez com esse e-mail, o papel já
    está definido — ninguém precisa mexer no Firestore na mão.
    """
    email = dados.email.lower()
    if dados.papel is PapelUsuario.LIDER_CELULA and not dados.celula_id:
        raise HTTPException(400, "Selecione a célula do líder.")
    await validar_vinculos(user.igreja_id, dados.model_dump())
    existentes = col_usuarios().where(filter=FieldFilter("email", "==", email)).limit(1)
    if any([doc async for doc in existentes.stream()]):
        raise HTTPException(409, "Este e-mail já possui acesso ou convite. Edite o acesso existente.")
    ref = col_usuarios().document()
    await ref.set(
        {
            "email": email,
            "nome": dados.nome,
            "papel": dados.papel.value,
            "igreja_id": user.igreja_id,
            "celula_id": dados.celula_id,
            "ativo": True,
            "pendente": True,
        }
    )
    return {"convidado": email, "papel": dados.papel.value}


@router.patch("/usuarios/{uid}", tags=["usuarios"])
async def atualizar_usuario(
    uid: str, dados: UsuarioUpdate, user: Identidade = Depends(exige())
):
    ref = col_usuarios().document(uid)
    snap = await ref.get()
    anterior = snap.to_dict() or {}
    if not snap.exists or anterior.get("igreja_id") != user.igreja_id:
        raise HTTPException(404, "Usuário não encontrado nesta igreja.")
    if uid == user.uid and (dados.ativo is False or (dados.papel and dados.papel is not PapelUsuario.ADMIN)):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Você não pode remover o próprio acesso de administrador.",
        )
    corpo = dados.model_dump(mode="json", exclude_unset=True)
    if not corpo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nada para atualizar.")
    combinado = {**anterior, **corpo}
    if combinado.get("papel") == PapelUsuario.LIDER_CELULA:
        if not combinado.get("celula_id"):
            raise HTTPException(400, "Selecione a célula do líder.")
        await validar_vinculos(user.igreja_id, {"celula_id": combinado["celula_id"]})
    else:
        corpo["celula_id"] = None
    await ref.update(corpo)
    return {"ok": True}
