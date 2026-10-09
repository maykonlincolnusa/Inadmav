"""Configuração da aplicação, lida do ambiente.

Em Cloud Run as variáveis chegam por env vars do serviço e por Secret Manager.
Localmente vêm do .env (ver .env.example).
"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Aplicação ---
    APP_NAME: str = "inAdmav"
    ENV: Literal["local", "staging", "prod"] = "local"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # --- Google Cloud / Firebase ---
    GCP_PROJECT_ID: str = Field(default="", description="ID do projeto no Google Cloud")
    FIRESTORE_DATABASE: str = "(default)"

    # Caminho para o service account JSON. Em Cloud Run fica vazio: a
    # Application Default Credentials da própria service account do serviço
    # é usada automaticamente.
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None

    # Emulador do Firestore para desenvolvimento local (firebase emulators:start).
    FIRESTORE_EMULATOR_HOST: str | None = None
    FIREBASE_AUTH_EMULATOR_HOST: str | None = None

    # --- Segurança ---
    # Origens liberadas no CORS. Em prod, o domínio do frontend.
    #
    # NoDecode desliga o JSON automático que o pydantic-settings aplica a
    # campos de tipo composto. Sem ele a fonte tenta `json.loads` no valor
    # cru e estoura antes do validador abaixo rodar — ou seja,
    # `CORS_ORIGINS=https://exemplo.run.app` derrubaria o processo no
    # start, que é exatamente o formato que o Cloud Run e o .env usam.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # E-mails que recebem papel de administrador na primeira entrada.
    # Serve para dar acesso ao primeiro usuário sem precisar mexer no banco.
    BOOTSTRAP_ADMIN_EMAILS: Annotated[list[str], NoDecode] = []

    # --- Cadastro público ---
    CADASTRO_PUBLICO_ATIVO: bool = True
    # Quantos cadastros o mesmo IP pode enviar por hora no formulário aberto.
    CADASTRO_PUBLICO_RATE_LIMIT: int = 20

    @field_validator("DEBUG", mode="before")
    @classmethod
    def _normalizar_debug(cls, v: bool | str) -> bool | str:
        """Não deixa um `DEBUG=WARN` herdado do terminal impedir o start.

        Alguns ambientes usam DEBUG como nível de log global. Para este
        serviço só os valores booleanos têm sentido; níveis de log tornam o
        debug da aplicação falso, que é a escolha segura.
        """
        if isinstance(v, str) and v.strip().upper() in {"TRACE", "DEBUG", "INFO", "WARN", "WARNING", "ERROR", "CRITICAL"}:
            return False
        return v

    @field_validator("CORS_ORIGINS", "BOOTSTRAP_ADMIN_EMAILS", mode="before")
    @classmethod
    def _split_csv(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def usando_emulador(self) -> bool:
        return bool(self.FIRESTORE_EMULATOR_HOST)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
