"""Validação de referências dentro da igreja, antes de qualquer gravação."""

from fastapi import HTTPException

from app.core.firebase import sub


async def exigir_registro(igreja_id: str, colecao: str, registro_id: str) -> dict:
    snap = await sub(igreja_id, colecao).document(registro_id).get()
    if not snap.exists:
        raise HTTPException(404, "Registro não encontrado nesta igreja.")
    return {"id": snap.id, **(snap.to_dict() or {})}


async def validar_vinculos(igreja_id: str, campos: dict, anterior: dict | None = None) -> None:
    for campo, colecao, ativo in (
        ("cargo_id", "cargos", "ativo"),
        ("celula_id", "celulas", "ativa"),
        ("pessoa_id", "pessoas", None),
        ("lider_id", "pessoas", None),
    ):
        valor = campos.get(campo)
        if not valor or (anterior and anterior.get(campo) == valor):
            continue
        registro = await exigir_registro(igreja_id, colecao, valor)
        if registro.get("arquivado") or (ativo and not registro.get(ativo, True)):
            raise HTTPException(400, "Escolha um registro ativo para este vínculo.")
