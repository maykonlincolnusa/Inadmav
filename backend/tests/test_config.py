"""O Cloud Run entrega listas como texto separado por vírgula.

O `deploy.ps1` passa `CORS_ORIGINS=https://...` e `BOOTSTRAP_ADMIN_EMAILS=a@b,c@d`
como env vars comuns. Sem `NoDecode`, o pydantic-settings tenta `json.loads`
no valor cru e o processo morre no start — falha que só aparece em produção,
como "container failed to start", porque com os defaults tudo passa.
"""

from app.core.config import Settings


def variaveis(monkeypatch, **valores: str) -> None:
    """Isola o teste do .env do desenvolvedor e de env vars herdadas."""
    for chave in ("CORS_ORIGINS", "BOOTSTRAP_ADMIN_EMAILS"):
        monkeypatch.delenv(chave, raising=False)
    for chave, valor in valores.items():
        monkeypatch.setenv(chave, valor)


def test_lista_de_um_item_vinda_do_ambiente(monkeypatch):
    variaveis(monkeypatch, CORS_ORIGINS="https://inadmav-web.run.app")

    config = Settings(_env_file=None)

    assert config.CORS_ORIGINS == ["https://inadmav-web.run.app"]


def test_lista_separada_por_virgula_com_espacos(monkeypatch):
    variaveis(monkeypatch, BOOTSTRAP_ADMIN_EMAILS="um@igreja.org, dois@igreja.org")

    config = Settings(_env_file=None)

    assert config.BOOTSTRAP_ADMIN_EMAILS == ["um@igreja.org", "dois@igreja.org"]


def test_sem_variavel_usa_o_padrao(monkeypatch):
    variaveis(monkeypatch)

    config = Settings(_env_file=None)

    assert config.CORS_ORIGINS == ["http://localhost:3000"]
    assert config.BOOTSTRAP_ADMIN_EMAILS == []
