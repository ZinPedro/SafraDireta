from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from psycopg import Error
from psycopg_pool import ConnectionPool, PoolTimeout

from app.database import create_pool, get_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = create_pool()
    try:
        # A API so inicia quando consegue conectar ao banco.
        pool.open(wait=True, timeout=10)
        app.state.db_pool = pool
        yield
    finally:
        pool.close()


app = FastAPI(
    title="SafraDireta - base da Sprint 1",
    description="Conexao PostgreSQL pronta. Fluxos de cadastro, login e vendedor serao implementados pela equipe.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["Saude"])
def health():
    return {"status": "ok"}


@app.get("/health/db", tags=["Saude"])
def health_db(pool: ConnectionPool = Depends(get_pool)):
    try:
        with pool.connection() as conn:
            ready = conn.execute(
                "SELECT to_regclass('safradireta.conta') IS NOT NULL AS pronto"
            ).fetchone()["pronto"]
            if not ready:
                raise HTTPException(status_code=503, detail="Estrutura do banco indisponivel")
    except (Error, PoolTimeout):
        # Nao expor host, senha, query ou stacktrace na resposta HTTP.
        raise HTTPException(status_code=503, detail="Banco indisponivel") from None
    return {"status": "ok", "database": "conectado"}
