from fastapi import APIRouter, Depends
from psycopg import Connection

from app.database import get_connection
from app.schemas.termos import TermoVigente
from app.services import termos_service

router = APIRouter(prefix="/api/termos", tags=["Termos de uso"])


@router.get(
    "/vigente",
    response_model=TermoVigente,
    summary="Consultar o termo de uso vigente",
    description="Rota pública. Devolve versão, referência do conteúdo e data de início da vigência.",
)
def vigente(conn: Connection = Depends(get_connection)):
    return termos_service.termo_vigente(conn)
