"""Fila de trabalho reservada à secretaria e à administração."""
from fastapi import APIRouter, Depends

from app.core.security import Identidade, PODE_EDITAR_PESSOAS, exige
from app.repositories import secretaria as repo
from app.schemas.secretaria import TarefaCreate, TarefaOut, TarefaUpdate
from app.services.vinculos import exigir_registro, validar_vinculos

router = APIRouter(prefix="/secretaria", tags=["secretaria"])


@router.get("/tarefas", response_model=list[TarefaOut])
async def listar_tarefas(user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))):
    return await repo.listar(user.igreja_id)


@router.post("/tarefas", response_model=TarefaOut, status_code=201)
async def criar_tarefa(dados: TarefaCreate, user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))):
    corpo = dados.model_dump(mode="json")
    await validar_vinculos(user.igreja_id, corpo)
    return await repo.criar(user.igreja_id, corpo, user.uid)


@router.patch("/tarefas/{tarefa_id}", response_model=TarefaOut)
async def atualizar_tarefa(tarefa_id: str, dados: TarefaUpdate,
                          user: Identidade = Depends(exige(*PODE_EDITAR_PESSOAS))):
    anterior = await exigir_registro(user.igreja_id, repo.COLECAO, tarefa_id)
    corpo = dados.model_dump(mode="json", exclude_unset=True)
    await validar_vinculos(user.igreja_id, corpo, anterior)
    return await repo.atualizar(user.igreja_id, tarefa_id, corpo, anterior, user.uid)
