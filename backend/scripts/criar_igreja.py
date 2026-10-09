"""Cria uma igreja e os cargos iniciais no Firestore.

Rode uma vez, antes do primeiro acesso:

    cd backend
    python scripts/criar_igreja.py --id sede --nome "Igreja ADMAV"

O `--id` vira parte do link do formulário público
(`/cadastro/<id>`), então prefira algo curto e estável: "sede",
"congregacao-centro". Trocar depois quebra links já distribuídos.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path

# Permite rodar o script direto, sem instalar o pacote.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.firebase import doc_igreja  # noqa: E402
from app.repositories.pessoas import semear_cargos  # noqa: E402


async def criar(igreja_id: str, nome: str, sigla: str | None) -> None:
    ref = doc_igreja(igreja_id)
    snap = await ref.get()

    if snap.exists:
        print(f"A igreja '{igreja_id}' já existe — nada foi alterado.")
    else:
        await ref.set(
            {
                "nome": nome,
                "sigla": sigla,
                "cadastro_publico_ativo": True,
                "criado_em": datetime.now(UTC),
            }
        )
        print(f"Igreja criada: {nome} (id: {igreja_id})")

    criados = await semear_cargos(igreja_id)
    if criados:
        print(f"{criados} cargos padrão criados.")
        print(
            "Confirme a nomenclatura com a liderança e ajuste em "
            "Configurações — ela varia entre ministérios."
        )
    else:
        print("Cargos já existiam — nada foi alterado.")

    print(f"\nLink do formulário público: /cadastro/{igreja_id}")


def main() -> None:
    p = argparse.ArgumentParser(description="Cria uma igreja no inAdmav.")
    p.add_argument("--id", default="sede", help="Identificador (padrão: sede)")
    p.add_argument("--nome", required=True, help='Ex.: "Igreja ADMAV"')
    p.add_argument("--sigla", default=None, help="Ex.: ADMAV")
    args = p.parse_args()

    asyncio.run(criar(args.id, args.nome, args.sigla))


if __name__ == "__main__":
    main()
