"""Atendimentos e pendências da secretaria da ADMAV Sede."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import Atualizacao, DocumentoId

StatusTarefa = Literal["aberta", "andamento", "concluida"]
CategoriaTarefa = Literal["cadastro", "documento", "atendimento", "visita", "outro"]
PrioridadeTarefa = Literal["normal", "alta"]


class TarefaCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    titulo: str = Field(min_length=3, max_length=140)
    categoria: CategoriaTarefa = "atendimento"
    prioridade: PrioridadeTarefa = "normal"
    prazo: date | None = None
    responsavel: str | None = Field(default=None, max_length=100)
    pessoa_id: DocumentoId | None = None
    descricao: str | None = Field(default=None, max_length=2000)


class TarefaUpdate(Atualizacao):
    obrigatorios = {"titulo", "categoria", "prioridade", "status"}
    titulo: str | None = Field(default=None, min_length=3, max_length=140)
    categoria: CategoriaTarefa | None = None
    prioridade: PrioridadeTarefa | None = None
    status: StatusTarefa | None = None
    prazo: date | None = None
    responsavel: str | None = Field(default=None, max_length=100)
    pessoa_id: DocumentoId | None = None
    descricao: str | None = Field(default=None, max_length=2000)


class TarefaOut(TarefaCreate):
    id: str
    status: StatusTarefa = "aberta"
    criada_em: datetime
    atualizada_em: datetime
    concluida_em: datetime | None = None
    criada_por: str
    atualizada_por: str
