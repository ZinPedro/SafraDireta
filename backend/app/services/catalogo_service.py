"""Catalogo publico (US018) e detalhe publico do anuncio (US019). So anuncios ATIVOS e liberados."""
from decimal import ROUND_HALF_UP, Decimal

from psycopg import Connection

from app.errors import nao_encontrado
from app.services.anuncio_service import obter_anuncio

_VISIVEL = "a.estado_comercial = 'ATIVO' AND a.estado_moderacao = 'LIBERADO'"
_ORDEM = {
    "recentes": "a.publicado_em DESC, a.id",
    "menor_preco": "a.preco_lote ASC, a.id",
    "maior_preco": "a.preco_lote DESC, a.id",
}


def _url_midia(midia_id) -> str:
    return f"/api/midias/{midia_id}"


def _por_unidade(total, quantidade) -> float:
    return float((total / quantidade).quantize(Decimal("0.01"), ROUND_HALF_UP))


def listar_catalogo(conn: Connection, f: dict) -> dict:
    """Lista paginada. 'f' traz os filtros ja validados pelo router."""
    filtros, params = [_VISIVEL], []
    if f["categoria"] == "ANIMAL":
        filtros.append("la.anuncio_id IS NOT NULL")
    elif f["categoria"] == "GRAOS":
        filtros.append("lg.anuncio_id IS NOT NULL")
    if f["cultura"]:
        filtros.append("lg.cultura = %s")
        params.append(f["cultura"])
    if f["uf"]:
        filtros.append("l.uf_publica = %s")
        params.append(f["uf"].upper())
    if f["preco_min"] is not None:
        filtros.append("a.preco_lote >= %s")
        params.append(f["preco_min"])
    if f["preco_max"] is not None:
        filtros.append("a.preco_lote <= %s")
        params.append(f["preco_max"])
    if f["busca"]:
        filtros.append("a.titulo ILIKE %s")
        params.append(f"%{f['busca']}%")

    de = """FROM safradireta.anuncio a
            JOIN safradireta.produto p ON p.id = a.produto_id
            LEFT JOIN safradireta.localizacao_anuncio l ON l.anuncio_id = a.id
            LEFT JOIN safradireta.lote_animal la ON la.anuncio_id = a.id
            LEFT JOIN safradireta.lote_agricola lg ON lg.anuncio_id = a.id
            LEFT JOIN safradireta.midia_anuncio m ON m.anuncio_id = a.id AND m.capa
            WHERE """ + " AND ".join(filtros)

    total = conn.execute(f"SELECT count(*) AS n {de}", params).fetchone()["n"]
    tamanho, pagina = f["tamanho"], f["pagina"]
    linhas = conn.execute(
        f"""SELECT a.id, a.titulo, a.preco_lote, a.modo_preco, a.publicado_em,
                   p.nome AS produto, l.municipio_publico, l.uf_publica,
                   la.quantidade_animais, lg.cultura, lg.quantidade AS sacas, m.id AS capa_id
            {de} ORDER BY {_ORDEM[f['ordem']]} LIMIT %s OFFSET %s""",
        [*params, tamanho, (pagina - 1) * tamanho],
    ).fetchall()

    itens = []
    for r in linhas:
        animal = r["quantidade_animais"] is not None
        qtd = r["quantidade_animais"] if animal else int(r["sacas"])
        item = {
            "id": str(r["id"]),
            "titulo": r["titulo"],
            "categoria": "ANIMAL" if animal else "GRAOS",
            "produto": r["produto"],
            "cidade": r["municipio_publico"],
            "uf": r["uf_publica"],
            "precoTotal": float(r["preco_lote"]),
            "pricingMode": r["modo_preco"],
            "publicadoEm": r["publicado_em"],
            "capa": None if r["capa_id"] is None else {"id": str(r["capa_id"]), "url": _url_midia(r["capa_id"])},
        }
        if animal:
            item.update({"quantidadeCabecas": qtd, "precoPorCabeca": _por_unidade(r["preco_lote"], qtd)})
        else:
            item.update({"cultura": r["cultura"], "quantidadeSacas": qtd,
                         "precoPorSaca": _por_unidade(r["preco_lote"], qtd)})
        itens.append(item)

    return {"itens": itens, "pagina": pagina, "tamanho": tamanho, "total": total}


def detalhe_publico(conn: Connection, anuncio_id) -> dict:
    """Anuncio completo para o publico. Pausado, vendido ou bloqueado dao 404."""
    visivel = conn.execute(
        f"SELECT a.vendedor_id FROM safradireta.anuncio a WHERE a.id = %s AND {_VISIVEL}",
        (anuncio_id,),
    ).fetchone()
    if visivel is None:
        raise nao_encontrado("Anúncio não encontrado.")

    anuncio = obter_anuncio(conn, anuncio_id)
    anuncio.pop("vendedorId")  # dado interno: o publico ve so o nome
    vendedor = conn.execute(
        """SELECT COALESCE(pf.nome, e.nome_fantasia, e.razao_social, c.nome_publico) AS nome
           FROM safradireta.conta c
           LEFT JOIN safradireta.perfil_pf pf ON pf.conta_id = c.id
           LEFT JOIN safradireta.empresa e ON e.conta_id = c.id
           WHERE c.id = %s""",
        (visivel["vendedor_id"],),
    ).fetchone()
    anuncio["vendedor"] = {"nome": vendedor["nome"] if vendedor else None}
    for midia in anuncio["midias"]:
        midia["url"] = _url_midia(midia["id"])
    return anuncio


def arquivo_da_midia(conn: Connection, midia_id) -> dict:
    """Dados do arquivo de uma midia de anuncio visivel ao publico."""
    linha = conn.execute(
        f"""SELECT f.chave_storage, f.mime_type
            FROM safradireta.midia_anuncio m
            JOIN safradireta.anuncio a ON a.id = m.anuncio_id
            JOIN safradireta.arquivo f ON f.id = m.arquivo_id AND f.removido_em IS NULL
            WHERE m.id = %s AND {_VISIVEL}""",
        (midia_id,),
    ).fetchone()
    if linha is None:
        raise nao_encontrado("Arquivo não encontrado.")
    return linha
