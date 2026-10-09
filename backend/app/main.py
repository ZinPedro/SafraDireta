from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # novo
from psycopg import Error
from psycopg_pool import ConnectionPool, PoolTimeout

from app.config import get_settings  # novo
from app.database import create_pool, get_pool
from app.errors import registrar_handlers  # novo
from app.routers import auth, termos, vendedores


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

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
registrar_handlers(app)
app.include_router(auth.router)  # novo
app.include_router(termos.router)  # novo
app.include_router(vendedores.router)
app.include_router(auth.perfil_router)


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