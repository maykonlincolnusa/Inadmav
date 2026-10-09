"""Enumerações do domínio da igreja."""

from enum import StrEnum


class GrupoCargo(StrEnum):
    """Agrupamento hierárquico dos cargos.

    A Natalia pediu abas de "Ministros", "Diáconos" e "Membros". "Ministro"
    não é um cargo — é o grupo que reúne Pastor, Evangelista e Presbítero.
    Por isso cargo e grupo são coisas separadas: a aba usa o grupo, a ficha
    mostra o cargo.
    """

    MINISTERIO = "ministerio"
    DIACONATO = "diaconato"
    COOPERACAO = "cooperacao"
    MEMBRESIA = "membresia"  # quem não tem cargo

    @property
    def rotulo(self) -> str:
        return {
            GrupoCargo.MINISTERIO: "Ministros",
            GrupoCargo.DIACONATO: "Diáconos",
            GrupoCargo.COOPERACAO: "Cooperadores",
            GrupoCargo.MEMBRESIA: "Membros",
        }[self]


class SituacaoPessoa(StrEnum):
    """Vínculo da pessoa com a igreja — eixo diferente do cargo.

    Alguém é Membro *e* Presbítero ao mesmo tempo.
    """

    MEMBRO = "membro"
    CONGREGADO = "congregado"
    VISITANTE = "visitante"

    @property
    def rotulo(self) -> str:
        return {
            SituacaoPessoa.MEMBRO: "Membro",
            SituacaoPessoa.CONGREGADO: "Congregado",
            SituacaoPessoa.VISITANTE: "Visitante",
        }[self]


class OrigemCadastro(StrEnum):
    MANUAL = "manual"          # digitado pela secretaria
    FORMULARIO = "formulario"  # a própria pessoa preencheu
    IMPORTACAO = "importacao"  # veio de planilha


class PapelUsuario(StrEnum):
    """Quem pode ver e fazer o quê.

    Ficha de membro é dado pessoal sensível pela LGPD (revela filiação
    religiosa), e o tesoureiro não precisa do endereço de todo mundo para
    lançar um dízimo.
    """

    ADMIN = "admin"              # pastor / responsável — tudo
    SECRETARIA = "secretaria"    # pessoas, cargos, células, eventos
    TESOUREIRO = "tesoureiro"    # financeiro + leitura de pessoas
    LIDER_CELULA = "lider_celula"  # só a própria célula
    LEITOR = "leitor"            # somente leitura, sem financeiro

    @property
    def rotulo(self) -> str:
        return {
            PapelUsuario.ADMIN: "Administrador",
            PapelUsuario.SECRETARIA: "Secretaria",
            PapelUsuario.TESOUREIRO: "Tesoureiro",
            PapelUsuario.LIDER_CELULA: "Líder de célula",
            PapelUsuario.LEITOR: "Leitor",
        }[self]


class TipoLancamento(StrEnum):
    DIZIMO = "dizimo"
    OFERTA = "oferta"
    ENTRADA = "entrada"
    SAIDA = "saida"

    @property
    def eh_saida(self) -> bool:
        return self is TipoLancamento.SAIDA


#: Cargos criados junto com a igreja. A secretaria edita depois pela API —
#: a nomenclatura varia entre ministérios e precisa ser confirmada com a
#: liderança da ADMAV.
CARGOS_PADRAO: list[tuple[str, GrupoCargo, int]] = [
    ("Pastor", GrupoCargo.MINISTERIO, 10),
    ("Pastora", GrupoCargo.MINISTERIO, 20),
    ("Evangelista", GrupoCargo.MINISTERIO, 30),
    ("Presbítero", GrupoCargo.MINISTERIO, 40),
    ("Diácono", GrupoCargo.DIACONATO, 50),
    ("Diaconisa", GrupoCargo.DIACONATO, 60),
    ("Cooperador", GrupoCargo.COOPERACAO, 70),
    ("Cooperadora", GrupoCargo.COOPERACAO, 80),
    ("Auxiliar", GrupoCargo.COOPERACAO, 90),
    ("Líder de célula", GrupoCargo.COOPERACAO, 100),
]

MESES_PT = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]

DIAS_SEMANA_PT = [
    "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
]
