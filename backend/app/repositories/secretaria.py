"""Persistência das tarefas, sempre limitada à igreja autenticada."""
from datetime import UTC, datetime

from app.core.firebase import sub

COLECAO = "tarefas"


async def listar(igreja_id: str) -> list[dict]:
    itens = [{**doc.to_dict(), "id": doc.id} async for doc in sub(igreja_id, COLECAO).stream()]
    return sorted(itens, key=lambda t: (
        t["status"] == "concluida", t.get("prazo") or "9999-12-31",
        t.get("prioridade") != "alta", t["titulo"].casefold(),
    ))


async def criar(igreja_id: str, dados: dict, uid: str) -> dict:
    agora = datetime.now(UTC)
    corpo = {**dados, "status": "aberta", "criada_em": agora,
             "atualizada_em": agora, "criada_por": uid, "atualizada_por": uid,
             "concluida_em": None}
    ref = sub(igreja_id, COLECAO).document()
    await ref.set(corpo)
    return {**corpo, "id": ref.id}


async def atualizar(igreja_id: str, tarefa_id: str, dados: dict, anterior: dict, uid: str) -> dict:
    agora = datetime.now(UTC)
    corpo = {**dados, "atualizada_em": agora, "atualizada_por": uid}
    if "status" in dados and dados["status"] != anterior["status"]:
        corpo["concluida_em"] = agora if dados["status"] == "concluida" else None
    await sub(igreja_id, COLECAO).document(tarefa_id).update(corpo)
    return {**anterior, **corpo, "id": tarefa_id}
