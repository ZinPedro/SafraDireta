from fastapi import APIRouter, Depends
from psycopg import Connection

from app.database import get_connection
from app.services import anuncio_service

router = APIRouter(prefix="/api/categorias", tags=["Anúncios"])


@router.get(
    "",
    summary="Listar categorias, produtos e unidades",
    description="Rota pública. Alimenta o formulário de anúncio: devolve cada categoria "
                "com seus produtos e os campos obrigatórios do grupo dela.",
)
def listar(conn: Connection = Depends(get_connection)):
    return anuncio_service.listar_categorias(conn)
