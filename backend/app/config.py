"""Configuracoes da aplicacao, lidas do ambiente (.env)."""
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv # carrega o .env aqui para as configuracoes do back


def _carregar_env() -> None:
    caminho = Path(os.environ.get(
        "SAFRADIRETA_ENV_FILE", str(Path(__file__).resolve().parents[1] / ".env")
    ))
    load_dotenv(caminho, override=False)


@dataclass(frozen=True)
class Settings:
    cors_origins: list[str]
    sessao_horas: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Com o cache, o .env e lido uma unica vez, e nao a cada login ou cadastro.
    _carregar_env()
    origens = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
    return Settings(
        cors_origins=[o.strip() for o in origens.split(",") if o.strip()],
        sessao_horas=int(os.environ.get("SESSAO_HORAS", "12")),
    )