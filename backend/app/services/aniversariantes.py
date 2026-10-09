"""Regra de negócio da lista de aniversariantes.

A lista não termina na tela: ela vira anúncio no culto e mensagem no grupo
do WhatsApp. Se a secretária tiver que redigitar, nada foi otimizado — por
isso a API já devolve o texto formatado pronto para colar.
"""

from __future__ import annotations

from app.core.datas import hoje_na_sede

from datetime import date

from app.models.enums import MESES_PT, GrupoCargo
from app.repositories import pessoas as repo
from app.schemas.pessoa import Aniversariante, ListaAniversariantes, whatsapp_url


async def montar_lista(
    igreja_id: str,
    mes: int,
    ano: int,
    *,
    grupo: GrupoCargo | None = None,
    celula_id: str | None = None,
    hoje: date | None = None,
) -> ListaAniversariantes:
    """Monta a lista do mês, opcionalmente filtrada por grupo de cargo."""
    hoje = hoje or hoje_na_sede()
    cargos = await repo.mapa_cargos(igreja_id)
    docs = await repo.aniversariantes_do_mes(igreja_id, mes)

    itens: list[Aniversariante] = []
    for doc in docs:
        if celula_id and doc.get("celula_id") != celula_id:
            continue
        cargo = cargos.get(doc.get("cargo_id") or "")
        grupo_doc = GrupoCargo(cargo["grupo"]) if cargo else GrupoCargo.MEMBRESIA
        if grupo is not None and grupo_doc is not grupo:
            continue

        nasc_ano = doc.get("nasc_ano")
        itens.append(
            Aniversariante(
                id=doc["id"],
                nome=doc.get("nome", ""),
                dia=doc["nasc_dia"],
                mes=mes,
                idade_que_faz=(ano - nasc_ano) if nasc_ano else None,
                cargo_nome=cargo["nome"] if cargo else None,
                cargo_grupo=grupo_doc.value,
                telefone=doc.get("telefone"),
                whatsapp_url=whatsapp_url(doc.get("telefone")),
                eh_hoje=(mes == hoje.month and doc["nasc_dia"] == hoje.day
                         and ano == hoje.year),
            )
        )

    itens.sort(key=lambda a: (a.dia, a.nome))

    return ListaAniversariantes(
        mes=mes,
        ano=ano,
        mes_nome=MESES_PT[mes - 1],
        total=len(itens),
        aniversariantes=itens,
        texto_para_compartilhar=formatar_para_compartilhar(itens, mes, grupo),
    )


def formatar_para_compartilhar(
    itens: list[Aniversariante], mes: int, grupo: GrupoCargo | None = None
) -> str:
    """Texto pronto para colar no grupo da igreja."""
    nome_mes = MESES_PT[mes - 1].capitalize()

    if not itens:
        return f"Nenhum aniversariante em {nome_mes.lower()}."

    titulo = f"🎂 Aniversariantes de {nome_mes}"
    if grupo is not None:
        titulo += f" — {grupo.rotulo}"

    linhas = [
        f"{a.dia:02d}/{mes:02d} — {a.nome}"
        + (f" ({a.idade_que_faz} anos)" if a.idade_que_faz is not None else "")
        for a in itens
    ]
    return "\n".join([titulo, "─" * 28, *linhas])
