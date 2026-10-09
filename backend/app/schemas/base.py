"""Contratos compartilhados das entradas da API."""

from typing import Annotated, ClassVar, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

DocumentoId = Annotated[str, Field(min_length=1, max_length=128, pattern=r"^[^/]+$")]
Horario = Annotated[str, Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


class Atualizacao(BaseModel):
    """Omitir um campo preserva seu valor; null só limpa campos opcionais."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    obrigatorios: ClassVar[set[str]] = set()

    @model_validator(mode="after")
    def rejeitar_nulos(self) -> Self:
        for campo in self.obrigatorios & self.model_fields_set:
            if getattr(self, campo) is None:
                raise ValueError(f"O campo {campo} não pode ficar vazio.")
        return self
