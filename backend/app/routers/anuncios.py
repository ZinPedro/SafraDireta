from fastapi import APIRouter, Depends
from psycopg import Connection

from app.database import get_connection
from app.deps import vendedor_habilitado
from app.schemas.anuncio import AnuncioEntrada
from app.services import anuncio_service

router = APIRouter(prefix="/api/vendedor/anuncios", tags=["Anúncios"])


@router.post(
    "",
    status_code=201,
    summary="Cadastrar lote e publicar anúncio",
    description="Só vendedor habilitado. O anúncio fica ligado a quem o criou e já nasce "
                "ATIVO (disponível no marketplace).",
)
def criar(
    dados: AnuncioEntrada,
    atual: dict = Depends(vendedor_habilitado),
    conn: Connection = Depends(get_connection),
):
    return anuncio_service.criar_anuncio(conn, atual, dados)
