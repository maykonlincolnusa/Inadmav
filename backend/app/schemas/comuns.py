"""Schemas de cargo, célula, evento, financeiro, usuário e igreja."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import GrupoCargo, PapelUsuario, TipoLancamento
from app.schemas.base import Atualizacao, DocumentoId, Horario

# --- Igreja ---------------------------------------------------------------


class IgrejaBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nome: str = Field(min_length=2, max_length=140)
    sigla: str | None = Field(default=None, max_length=16)
    endereco: str | None = Field(default=None, max_length=280)
    telefone: str | None = Field(default=None, max_length=32)
    cadastro_publico_ativo: bool = True


class IgrejaCreate(IgrejaBase):
    pass


class IgrejaOut(IgrejaBase):
    id: str
    criado_em: datetime | None = None


# --- Cargo ----------------------------------------------------------------


class CargoBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nome: str = Field(min_length=2, max_length=60)
    grupo: GrupoCargo
    ordem: int = 100
    ativo: bool = True


class CargoCreate(CargoBase):
    pass


class CargoUpdate(Atualizacao):
    obrigatorios = {"nome", "grupo", "ordem", "ativo"}

    nome: str | None = Field(default=None, min_length=2, max_length=60)
    grupo: GrupoCargo | None = None
    ordem: int | None = None
    ativo: bool | None = None


class CargoOut(CargoBase):
    id: str
    grupo_rotulo: str = ""
    total_pessoas: int = 0

    @classmethod
    def montar(cls, doc_id: str, dados: dict[str, Any], total: int = 0) -> CargoOut:
        grupo = GrupoCargo(dados.get("grupo", GrupoCargo.MEMBRESIA))
        return cls(
            id=doc_id,
            nome=dados.get("nome", ""),
            grupo=grupo,
            grupo_rotulo=grupo.rotulo,
            ordem=dados.get("ordem", 100),
            ativo=dados.get("ativo", True),
            total_pessoas=total,
        )


class GrupoResumo(BaseModel):
    """Uma aba da tela de Pessoas."""

    grupo: GrupoCargo
    rotulo: str
    total: int


# --- Célula ---------------------------------------------------------------


class CelulaBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nome: str = Field(min_length=2, max_length=100)
    lider_id: DocumentoId | None = None
    lider_nome: str | None = Field(default=None, max_length=140)
    dia_semana: int | None = Field(default=None, ge=0, le=6)
    horario: Horario | None = None
    endereco: str | None = Field(default=None, max_length=280)
    ativa: bool = True


class CelulaCreate(CelulaBase):
    pass


class CelulaUpdate(Atualizacao):
    obrigatorios = {"nome", "ativa"}

    nome: str | None = Field(default=None, min_length=2, max_length=100)
    lider_id: DocumentoId | None = None
    lider_nome: str | None = Field(default=None, max_length=140)
    dia_semana: int | None = Field(default=None, ge=0, le=6)
    horario: Horario | None = None
    endereco: str | None = Field(default=None, max_length=280)
    ativa: bool | None = None


class CelulaOut(CelulaBase):
    id: str
    dia_semana_nome: str | None = None
    total_pessoas: int = 0


# --- Evento ---------------------------------------------------------------


class EventoBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    titulo: str = Field(min_length=2, max_length=140)
    data: date
    horario: Horario | None = None
    local: str | None = Field(default=None, max_length=180)
    descricao: str | None = Field(default=None, max_length=2000)
    inscritos: int = Field(default=0, ge=0)


class EventoCreate(EventoBase):
    pass


class EventoUpdate(Atualizacao):
    obrigatorios = {"titulo", "data", "inscritos"}

    titulo: str | None = Field(default=None, min_length=2, max_length=140)
    data: date | None = None
    horario: Horario | None = None
    local: str | None = Field(default=None, max_length=180)
    descricao: str | None = Field(default=None, max_length=2000)
    inscritos: int | None = Field(default=None, ge=0)


class EventoOut(EventoBase):
    id: str
    ja_passou: bool = False


# --- Financeiro -----------------------------------------------------------


class LancamentoBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    tipo: TipoLancamento
    valor: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    data: date
    categoria: str | None = Field(default=None, max_length=80)
    descricao: str | None = Field(default=None, max_length=280)
    # Dízimo ligado a quem contribuiu — permite recibo e acompanhamento.
    pessoa_id: DocumentoId | None = None


class LancamentoCreate(LancamentoBase):
    pass


class LancamentoUpdate(Atualizacao):
    obrigatorios = {"tipo", "valor", "data"}

    tipo: TipoLancamento | None = None
    valor: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    data: date | None = None
    categoria: str | None = Field(default=None, max_length=80)
    descricao: str | None = Field(default=None, max_length=280)
    pessoa_id: DocumentoId | None = None


class LancamentoOut(LancamentoBase):
    id: str
    pessoa_nome: str | None = None
    criado_por: str | None = None


class ResumoFinanceiro(BaseModel):
    competencia: str  # 'AAAA-MM'
    entradas: Decimal
    saidas: Decimal
    saldo: Decimal
    total_lancamentos: int


# --- Usuário --------------------------------------------------------------


class UsuarioOut(BaseModel):
    uid: str
    email: EmailStr | None = None
    nome: str | None = None
    papel: PapelUsuario
    igreja_id: str
    celula_id: str | None = None
    ativo: bool = True
    pendente: bool = False
    criado_em: datetime | None = None


class UsuarioConvite(BaseModel):
    """Dá acesso a um e-mail antes mesmo dele criar a conta no Firebase."""

    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    papel: PapelUsuario = PapelUsuario.LEITOR
    nome: str | None = None
    celula_id: DocumentoId | None = None


class UsuarioUpdate(Atualizacao):
    obrigatorios = {"papel", "ativo"}
    papel: PapelUsuario | None = None
    celula_id: DocumentoId | None = None
    ativo: bool | None = None


# --- Painel ---------------------------------------------------------------


class PainelResumo(BaseModel):
    """Tudo que o painel inicial precisa, numa chamada só."""

    total_pessoas: int
    total_membros: int
    total_visitantes: int
    total_obreiros: int
    por_grupo: list[GrupoResumo]
    total_celulas: int
    aniversariantes_mes: int
    proximo_aniversariante: str | None = None
    cadastros_pendentes: int
    proximo_evento: EventoOut | None = None
    resumo_financeiro: ResumoFinanceiro | None = None
    cadastros_sem_contato: int = 0
    cadastros_sem_nascimento: int = 0
