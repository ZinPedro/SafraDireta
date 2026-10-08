from fastapi import APIRouter, Depends
from psycopg import Connection

from app.database import get_connection
from app.schemas.auth import RegistroPF, SessaoResposta
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


@router.post(
    "/register",
    status_code=201,
    response_model=SessaoResposta,
    summary="Cadastrar conta de pessoa física",
    description="Cria a conta, registra o aceite do termo vigente e já devolve a sessão.",
)
def registrar(dados: RegistroPF, conn: Connection = Depends(get_connection)):
    return auth_service.registrar_pf(conn, dados)

