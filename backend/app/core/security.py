"""Autenticação por Firebase Auth e autorização por papel.

O login acontece no frontend (Firebase Auth SDK). O que chega aqui é o ID
token, que verificamos contra o Firebase. Não guardamos senha nem emitimos
JWT próprio — uma superfície de ataque a menos.

O papel do usuário não vem do token: vem do documento `usuarios/{uid}` no
Firestore. Assim revogar acesso é editar um documento, e um token válido
não carrega privilégio antigo por 8 horas.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.concurrency import run_in_threadpool
from firebase_admin import auth as firebase_auth

from app.core.config import settings
from app.core.firebase import col_usuarios, get_db, init_firebase
from app.models.enums import PapelUsuario

logger = logging.getLogger(__name__)

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class Identidade:
    """Usuário autenticado, já resolvido com papel e igreja."""

    uid: str
    email: str | None
    nome: str | None
    papel: PapelUsuario
    igreja_id: str
    celula_id: str | None = None

    @property
    def eh_admin(self) -> bool:
        return self.papel is PapelUsuario.ADMIN

    def pode(self, *papeis: PapelUsuario) -> bool:
        return self.papel is PapelUsuario.ADMIN or self.papel in papeis


def celula_do_escopo(user: Identidade) -> str | None:
    """Return the cell that restricts a cell leader, if applicable.

    A cell leader without an assigned cell must never fall back to church-wide
    visibility. Failing closed here keeps every route consistent.
    """
    if user.papel is not PapelUsuario.LIDER_CELULA:
        return None
    if not user.celula_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seu perfil de lider de celula nao possui uma celula vinculada.",
        )
    return user.celula_id


def exigir_pessoa_no_escopo(user: Identidade, pessoa: dict) -> None:
    """Reject access to a person outside a cell leader's assigned cell."""
    celula_id = celula_do_escopo(user)
    if celula_id and pessoa.get("celula_id") != celula_id:
        # 404 avoids confirming that a person outside the scope exists.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pessoa nao encontrada.",
        )


# --- Conjuntos de permissão ----------------------------------------------
# Nomeados pelo que a pessoa faz, não pelo cargo dela.

PODE_EDITAR_PESSOAS = (PapelUsuario.SECRETARIA,)
PODE_VER_PESSOAS = (
    PapelUsuario.SECRETARIA,
    PapelUsuario.TESOUREIRO,
    PapelUsuario.LIDER_CELULA,
    PapelUsuario.LEITOR,
)
PODE_EDITAR_FINANCEIRO = (PapelUsuario.TESOUREIRO,)
PODE_VER_FINANCEIRO = (PapelUsuario.TESOUREIRO,)
PODE_GERIR_USUARIOS: tuple[PapelUsuario, ...] = ()  # só admin


async def _verificar_token(token: str) -> dict:
    init_firebase()
    try:
        # check_revoked pega logout forçado e conta desativada.
        return await run_in_threadpool(firebase_auth.verify_id_token, token, check_revoked=True)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Entre novamente.",
        )
    except (firebase_auth.RevokedIdTokenError, firebase_auth.UserDisabledError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão revogada. Entre novamente.",
        )
    except (firebase_auth.InvalidIdTokenError, ValueError) as exc:
        logger.warning("Token inválido: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido."
        )


async def _carregar_usuario(uid: str, email: str | None, nome: str | None) -> Identidade:
    """Busca o papel do usuário, criando o registro na primeira entrada.

    Um e-mail listado em BOOTSTRAP_ADMIN_EMAILS entra como admin — é assim
    que o primeiro acesso da igreja é liberado sem mexer no banco na mão.
    Qualquer outro e-mail desconhecido é recusado: cadastro no Firebase Auth
    não dá acesso ao sistema por si só.
    """
    snap = await col_usuarios().document(uid).get()

    if snap.exists:
        dados = snap.to_dict() or {}
        if not dados.get("ativo", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso desativado. Fale com a administração da igreja.",
            )
        return Identidade(
            uid=uid,
            email=dados.get("email") or email,
            nome=dados.get("nome") or nome,
            papel=PapelUsuario(dados.get("papel", PapelUsuario.LEITOR)),
            igreja_id=dados.get("igreja_id", "sede"),
            celula_id=dados.get("celula_id"),
        )

    email_norm = (email or "").lower()

    # Convite pendente: a administração já liberou o e-mail antes do cadastro.
    if email_norm:
        convites = (
            col_usuarios()
            .where("email", "==", email_norm)
            .where("pendente", "==", True)
            .limit(1)
        )
        async for conv in convites.stream():
            dados = conv.to_dict() or {}
            if not dados.get("ativo", True):
                raise HTTPException(403, "Este convite foi desativado. Procure a administração.")
            identidade = Identidade(
                uid=uid,
                email=email_norm,
                nome=nome or dados.get("nome"),
                papel=PapelUsuario(dados.get("papel", PapelUsuario.LEITOR)),
                igreja_id=dados.get("igreja_id", "sede"),
                celula_id=dados.get("celula_id"),
            )
            lote = get_db().batch()
            lote.set(col_usuarios().document(uid),
                {
                    "email": email_norm,
                    "nome": identidade.nome,
                    "papel": identidade.papel.value,
                    "igreja_id": identidade.igreja_id,
                    "celula_id": identidade.celula_id,
                    "ativo": True,
                    "pendente": False,
                    "criado_em": datetime.now(UTC),
                }
            )
            lote.delete(conv.reference)
            await lote.commit()
            logger.info("Convite aceito como %s", identidade.papel)
            return identidade

    # Primeiro administrador.
    if email_norm and email_norm in {e.lower() for e in settings.BOOTSTRAP_ADMIN_EMAILS}:
        identidade = Identidade(
            uid=uid,
            email=email_norm,
            nome=nome,
            papel=PapelUsuario.ADMIN,
            igreja_id="sede",
        )
        await col_usuarios().document(uid).set(
            {
                "email": email_norm,
                "nome": nome,
                "papel": PapelUsuario.ADMIN.value,
                "igreja_id": "sede",
                "ativo": True,
                "pendente": False,
                "criado_em": datetime.now(UTC),
            }
        )
        logger.info("Administrador inicial criado")
        return identidade

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Seu e-mail ainda não tem acesso. Peça à administração da igreja.",
    )


async def usuario_atual(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> Identidade:
    """Dependência padrão: exige login válido."""
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = await _verificar_token(cred.credentials)
    return await _carregar_usuario(
        uid=payload["uid"],
        email=payload.get("email"),
        nome=payload.get("name"),
    )


def exige(*papeis: PapelUsuario):
    """Fábrica de dependência que restringe uma rota a certos papéis.

        @router.post(..., dependencies=[Depends(exige(*PODE_EDITAR_PESSOAS))])

    Admin passa sempre.
    """

    async def _checar(user: Identidade = Depends(usuario_atual)) -> Identidade:
        if not user.pode(*papeis):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Seu perfil não permite esta ação. "
                    f"Necessário: {', '.join(p.rotulo for p in papeis) or 'administrador'}."
                ),
            )
        return user

    return _checar


def ip_do_cliente(request: Request) -> str:
    """IP real do cliente atrás do proxy do Cloud Run."""
    encaminhado = request.headers.get("x-forwarded-for")
    if encaminhado:
        return encaminhado.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"
