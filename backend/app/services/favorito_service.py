"""Favoritos por conta, incluindo o histórico de anúncios indisponíveis."""
from psycopg import Connection

from app.errors import nao_encontrado
from app.services.catalogo_service import _VISIVEL, _url_midia


def adicionar(conn: Connection, conta_id, anuncio_id) -> None:
    with conn.transaction():
        anuncio = conn.execute(
            f"SELECT ({_VISIVEL}) AS disponivel FROM safradireta.anuncio a WHERE a.id = %s FOR SHARE",
            (anuncio_id,),
        ).fetchone()
        if anuncio is None:
            raise nao_encontrado("Anúncio não encontrado.")
        if not anuncio["disponivel"] and not conn.execute(
            "SELECT 1 FROM safradireta.favorito WHERE usuario_id = %s AND anuncio_id = %s",
            (conta_id, anuncio_id),
        ).fetchone():
            raise nao_encontrado("Anúncio não encontrado.")
        if anuncio["disponivel"]:
            conn.execute(
                """INSERT INTO safradireta.favorito (usuario_id, anuncio_id)
                   VALUES (%s, %s) ON CONFLICT (usuario_id, anuncio_id) DO NOTHING""",
                (conta_id, anuncio_id),
            )


def remover(conn: Connection, conta_id, anuncio_id) -> None:
    conn.execute(
        "DELETE FROM safradireta.favorito WHERE usuario_id = %s AND anuncio_id = %s",
        (conta_id, anuncio_id),
    )


def listar(conn: Connection, conta_id, pagina: int, tamanho: int) -> dict:
    total = conn.execute(
        "SELECT count(*) AS n FROM safradireta.favorito WHERE usuario_id = %s", (conta_id,),
    ).fetchone()["n"]
    linhas = conn.execute(
        f"""SELECT a.id, a.titulo, a.estado_comercial, a.preco_lote, f.adicionado_em,
                   ({_VISIVEL}) AS disponivel, l.municipio_publico, l.uf_publica, l.regiao_publica,
                   la.anuncio_id IS NOT NULL AS animal, lg.cultura,
                   CASE WHEN {_VISIVEL} THEN m.id END AS capa_id
            FROM safradireta.favorito f
            JOIN safradireta.anuncio a ON a.id = f.anuncio_id
            LEFT JOIN safradireta.localizacao_anuncio l ON l.anuncio_id = a.id
            LEFT JOIN safradireta.lote_animal la ON la.anuncio_id = a.id
            LEFT JOIN safradireta.lote_agricola lg ON lg.anuncio_id = a.id
            LEFT JOIN safradireta.midia_anuncio m ON m.anuncio_id = a.id AND m.capa
            WHERE f.usuario_id = %s
            ORDER BY f.adicionado_em DESC, f.anuncio_id
            LIMIT %s OFFSET %s""",
        (conta_id, tamanho, (pagina - 1) * tamanho),
    ).fetchall()

    itens = [{
        "id": r["id"], "titulo": r["titulo"], "estadoComercial": r["estado_comercial"],
        "disponivel": r["disponivel"], "adicionadoEm": r["adicionado_em"],
        "precoTotal": r["preco_lote"], "categoria": "ANIMAL" if r["animal"] else "GRAOS",
        "cultura": r["cultura"], "cidade": r["municipio_publico"], "municipio": r["municipio_publico"],
        "uf": r["uf_publica"], "regiaoAproximada": r["regiao_publica"],
        "capa": {"id": r["capa_id"], "url": _url_midia(r["capa_id"])} if r["capa_id"] else None,
    } for r in linhas]
    return {"itens": itens, "pagina": pagina, "tamanho": tamanho, "total": total}
