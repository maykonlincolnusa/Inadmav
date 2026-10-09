"""Schemas de Pessoa — o núcleo do sistema.

Decisão central: a data de nascimento é guardada em três campos separados
(`nasc_dia`, `nasc_mes`, `nasc_ano`) em vez de um `date`.

Dois motivos, ambos vindos do uso real:

1. Muita gente não sabe ou não informa o ano. Se o campo for obrigatório,
   a secretária trava na digitação e volta para o caderno. `nasc_ano` é
   opcional; dia e mês bastam para a lista de aniversariantes.
2. "Quem faz aniversário em setembro" é a pergunta que a igreja faz toda
   semana. Com `nasc_mes` indexado isso é uma query direta no Firestore;
   com um `date` seria varredura da coleção inteira.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.enums import MESES_PT, OrigemCadastro, SituacaoPessoa
from app.core.datas import hoje_na_sede
from app.schemas.base import Atualizacao, DocumentoId

# Dias por mês, ignorando ano bissexto: 29/02 é data de nascimento válida.
DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]


class Nascimento(BaseModel):
    """Data de nascimento com ano opcional."""

    dia: int = Field(ge=1, le=31)
    mes: int = Field(ge=1, le=12)
    ano: int | None = Field(default=None, ge=1900, le=2100)

    @model_validator(mode="after")
    def _validar_dia_do_mes(self) -> Self:
        limite = DIAS_NO_MES[self.mes - 1]
        if self.dia > limite:
            raise ValueError(
                f"{MESES_PT[self.mes - 1].capitalize()} não tem dia {self.dia}."
            )
        if self.ano is not None:
            try:
                nascimento = date(self.ano, self.mes, self.dia)
            except ValueError:
                raise ValueError("Data de nascimento inválida para o ano informado.")
            if nascimento > hoje_na_sede():
                raise ValueError("Data de nascimento no futuro.")
        return self

    @property
    def formatado(self) -> str:
        """'12/04/1988' ou '12/04' quando o ano é desconhecido."""
        base = f"{self.dia:02d}/{self.mes:02d}"
        return f"{base}/{self.ano}" if self.ano else base

    def idade_em(self, ano_ref: int) -> int | None:
        """Idade que a pessoa completa no ano informado."""
        return None if self.ano is None else ano_ref - self.ano

    def idade_atual(self, hoje: date | None = None) -> int | None:
        if self.ano is None:
            return None
        hoje = hoje or hoje_na_sede()
        idade = hoje.year - self.ano
        if (hoje.month, hoje.day) < (self.mes, self.dia):
            idade -= 1
        return idade


class PessoaBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nome: str = Field(min_length=2, max_length=140)
    cargo_id: DocumentoId | None = None
    situacao: SituacaoPessoa = SituacaoPessoa.MEMBRO
    nascimento: Nascimento | None = None
    telefone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    endereco: str | None = Field(default=None, max_length=280)
    celula_id: DocumentoId | None = None
    observacoes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def _limpar_vazios(self) -> Self:
        """Campo em branco vira None — evita string vazia no Firestore."""
        for campo in ("telefone", "endereco", "observacoes", "cargo_id", "celula_id"):
            if getattr(self, campo) == "":
                setattr(self, campo, None)
        return self


class PessoaCreate(PessoaBase):
    pass


class PessoaUpdate(Atualizacao):
    """Atualização parcial: só o que vier no corpo é alterado."""

    obrigatorios = {"nome", "situacao", "revisado", "arquivado"}

    nome: str | None = Field(default=None, min_length=2, max_length=140)
    cargo_id: DocumentoId | None = None
    situacao: SituacaoPessoa | None = None
    nascimento: Nascimento | None = None
    telefone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    endereco: str | None = Field(default=None, max_length=280)
    celula_id: DocumentoId | None = None
    observacoes: str | None = Field(default=None, max_length=2000)
    revisado: bool | None = None
    arquivado: bool | None = None


class PessoaPublicaCreate(BaseModel):
    """O que o formulário aberto aceita.

    Deliberadamente menor que o cadastro da secretaria: quem preenche na
    porta da igreja não define o próprio papel administrativo, e nada aqui
    entra como conferido.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    nome: str = Field(min_length=2, max_length=140)
    nascimento: Nascimento | None = None
    telefone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    endereco: str | None = Field(default=None, max_length=280)
    situacao: SituacaoPessoa = SituacaoPessoa.VISITANTE
    cargo_id: DocumentoId | None = None
    celula_id: DocumentoId | None = None


class PessoaOut(PessoaBase):
    """Pessoa como sai da API, com os campos derivados já prontos.

    O frontend não recalcula idade nem resolve nome de cargo/célula: quem
    conhece a regra é o backend.
    """

    id: str
    origem: OrigemCadastro = OrigemCadastro.MANUAL
    revisado: bool = True
    arquivado: bool = False
    criado_em: datetime | None = None
    atualizado_em: datetime | None = None

    # Derivados
    cargo_nome: str | None = None
    cargo_grupo: str = "membresia"
    celula_nome: str | None = None
    idade: int | None = None
    nascimento_formatado: str | None = None
    whatsapp_url: str | None = None

    @classmethod
    def montar(
        cls,
        doc_id: str,
        dados: dict[str, Any],
        *,
        cargos: dict[str, dict] | None = None,
        celulas: dict[str, dict] | None = None,
    ) -> PessoaOut:
        """Converte o documento cru do Firestore no objeto de saída."""
        cargos = cargos or {}
        celulas = celulas or {}

        nascimento = None
        if dados.get("nasc_mes") and dados.get("nasc_dia"):
            nascimento = Nascimento(
                dia=dados["nasc_dia"],
                mes=dados["nasc_mes"],
                ano=dados.get("nasc_ano"),
            )

        cargo = cargos.get(dados.get("cargo_id") or "")
        celula = celulas.get(dados.get("celula_id") or "")

        return cls(
            id=doc_id,
            nome=dados.get("nome", ""),
            cargo_id=dados.get("cargo_id"),
            situacao=dados.get("situacao", SituacaoPessoa.MEMBRO),
            nascimento=nascimento,
            telefone=dados.get("telefone"),
            email=dados.get("email"),
            endereco=dados.get("endereco"),
            celula_id=dados.get("celula_id"),
            observacoes=dados.get("observacoes"),
            origem=dados.get("origem", OrigemCadastro.MANUAL),
            revisado=dados.get("revisado", True),
            arquivado=dados.get("arquivado", False),
            criado_em=dados.get("criado_em"),
            atualizado_em=dados.get("atualizado_em"),
            cargo_nome=cargo.get("nome") if cargo else None,
            cargo_grupo=(cargo.get("grupo") if cargo else None) or "membresia",
            celula_nome=celula.get("nome") if celula else None,
            idade=nascimento.idade_atual() if nascimento else None,
            nascimento_formatado=nascimento.formatado if nascimento else None,
            whatsapp_url=whatsapp_url(dados.get("telefone")),
        )


class PessoaOpcao(BaseModel):
    """Minimal person projection used in financial contribution forms."""

    id: str
    nome: str


class Aniversariante(BaseModel):
    """Linha da lista de aniversariantes do mês."""

    id: str
    nome: str
    dia: int
    mes: int
    idade_que_faz: int | None = None
    cargo_nome: str | None = None
    cargo_grupo: str = "membresia"
    telefone: str | None = None
    whatsapp_url: str | None = None
    eh_hoje: bool = False


class ListaAniversariantes(BaseModel):
    """Resposta pronta para virar tela, cartaz ou mensagem de WhatsApp."""

    mes: int
    ano: int
    mes_nome: str
    total: int
    aniversariantes: list[Aniversariante]
    texto_para_compartilhar: str


def whatsapp_url(telefone: str | None) -> str | None:
    """Monta o link wa.me a partir de um telefone brasileiro.

    Aceita o número como a secretária digita: '(11) 98888-1010'.
    """
    if not telefone:
        return None
    digitos = "".join(c for c in telefone if c.isdigit())
    if len(digitos) < 10:
        return None
    if len(digitos) >= 12 and digitos.startswith("55"):
        return f"https://wa.me/{digitos}"
    return f"https://wa.me/55{digitos}"
