"""Conexao e transacoes. Nao cria tabelas e nao usa o usuario administrador."""
import os
from collections.abc import Iterator
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Request
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


def create_pool() -> ConnectionPool:
    env_file = Path(os.environ.get(
        "SAFRADIRETA_ENV_FILE", str(Path(__file__).resolve().parents[1] / ".env")
    ))
    if "SAFRADIRETA_ENV_FILE" in os.environ and not env_file.is_file():
        raise RuntimeError("Arquivo SAFRADIRETA_ENV_FILE nao encontrado")
    load_dotenv(env_file, override=False)
    url = os.environ.get("DATABASE_URL", "")
    if not url and not all(os.environ.get(key) for key in (
        "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"
    )):
        raise RuntimeError("Configure .env ou as variaveis PG* antes de iniciar a API")
    return ConnectionPool(
        conninfo=url,
        min_size=1,
        max_size=5,
        timeout=5,
        open=False,
        check=ConnectionPool.check_connection,
        kwargs={
            "autocommit": True,
            "connect_timeout": 5,
            "row_factory": dict_row,
            "application_name": "safradireta-fastapi",
            "options": "-c search_path=safradireta,pg_catalog -c timezone=UTC",
        },
    )


def get_pool(request: Request) -> ConnectionPool:
    return request.app.state.db_pool


def get_connection(request: Request) -> Iterator[Connection]:
    """Use Depends(get_connection) nas rotas; escrita multipla exige conn.transaction()."""
    with get_pool(request).connection() as conn:
        yield conn
