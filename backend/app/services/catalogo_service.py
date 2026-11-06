"""
Catalogo publico (Sprint 3: US20, US21, US23, US24).
Suporte a busca por palavra-chave, filtros por categoria, peso, preco, ordenacao e paginacao.
"""
from decimal import ROUND_HALF_UP, Decimal
from psycopg import Connection
from app.errors import nao_encontrado
from app.services.anuncio_service import obter_anuncio

# Regra de visibilidade publica padrao da Sprint 3
_VISIVEL = "a.estado_comercial = 'ATIVO' AND a.estado_moderacao = 'LIBERADO'"

# Whitelist de ordenacao com desempate estavel por a.id DESC (US24)
_ORDEM_MAP = {
    "recentes": "a.publicado_em DESC NULLS LAST, a.id DESC",
    "menor_preco": "a.preco_lote ASC NULLS LAST, a.id DESC",
    "maior_preco": "a.preco_lote DESC NULLS LAST, a.id DESC",
    "menor_peso": "a.peso_total_kg ASC NULLS LAST, a.id DESC",
    "maior_peso": "a.peso_total_kg DESC NULLS LAST, a.id DESC",
}


def _url_midia(midia_id) -> str:
    return f"/api/midias/{midia_id}"


def _por_unidade(total, quantidade) -> float:
    if not quantidade or quantidade == 0:
        return 0.0
    return float((total / quantidade).quantize(Decimal("0.01"), ROUND_HALF_UP))


def listar_catalogo(conn: Connection, f: dict) -> dict:
    """Lista paginada do catalogo publico."""
    filtros = [_VISIVEL]
    params = []

    # Função blindada: ignora nulos, vazios e textos padrão injetados pelo Swagger
    def _valido(valor, ignorar_textos=()):
        if valor is None:
            return False
        texto = str(valor).strip()
        if texto == "" or texto == "string" or texto in ignorar_textos:
            return False
        return True

    # 1. Busca por palavra-chave (US20)
    busca_raw = f.get("q") or f.get("busca")
    if _valido(busca_raw, ("busca", "q")):
        termo_limpo = str(busca_raw).replace("%", "\\%").replace("_", "\\_").strip()
        if termo_limpo:
            filtros.append("(a.titulo ILIKE %s OR a.descricao ILIKE %s)")
            param_busca = f"%{termo_limpo}%"
            params.extend([param_busca, param_busca])

    # 2. Filtro por Categoria (US21)
    categoria_id = f.get("categoria_id")
    if _valido(categoria_id, ("categoria_id",)):
        filtros.append("p.categoria_id = %s")
        params.append(categoria_id)

    # Suporte a categorias legado
    cat = f.get("categoria")
    if _valido(cat, ("categoria",)):
        if cat == "ANIMAL":
            filtros.append("la.anuncio_id IS NOT NULL")
        elif cat == "GRAOS":
            filtros.append("lg.anuncio_id IS NOT NULL")

    cult = f.get("cultura")
    if _valido(cult, ("cultura",)):
        filtros.append("lg.cultura = %s")
        params.append(cult)

    uf = f.get("uf")
    if _valido(uf, ("uf",)):
        filtros.append("l.uf_publica = %s")
        params.append(str(uf).upper())

    # 3. Filtro por Preco do Lote (US23)
    preco_min = f.get("preco_min") or f.get("precoMin")
    if _valido(preco_min, ("precoMin", "preco_min")):
        filtros.append("a.preco_lote >= %s")
        params.append(preco_min)

    preco_max = f.get("preco_max") or f.get("precoMax")
    if _valido(preco_max, ("precoMax", "preco_max")):
        filtros.append("a.preco_lote <= %s")
        params.append(preco_max)

    # 4. Filtro por Peso Total (US23)
    peso_min = f.get("peso_min") or f.get("pesoMin")
    if _valido(peso_min, ("pesoMin", "peso_min")):
        filtros.append("a.peso_total_kg >= %s")
        params.append(peso_min)

    peso_max = f.get("peso_max") or f.get("pesoMax")
    if _valido(peso_max, ("pesoMax", "peso_max")):
        filtros.append("a.peso_total_kg <= %s")
        params.append(peso_max)

    # Cláusula FROM / JOINs comuns
    de = """FROM safradireta.anuncio a
            JOIN safradireta.produto p ON p.id = a.produto_id
            LEFT JOIN safradireta.categoria c ON c.id = p.categoria_id
            LEFT JOIN safradireta.localizacao_anuncio l ON l.anuncio_id = a.id
            LEFT JOIN safradireta.lote_animal la ON la.anuncio_id = a.id
            LEFT JOIN safradireta.lote_agricola lg ON lg.anuncio_id = a.id
            LEFT JOIN safradireta.midia_anuncio m ON m.anuncio_id = a.id AND m.capa
            WHERE """ + " AND ".join(filtros)

    # Contagem total
    total = conn.execute(f"SELECT count(*) AS n {de}", params).fetchone()["n"]

    # Paginação segura contra tipos inválidos
    try:
        tamanho = int(f.get("tamanho") or f.get("tamanho_pagina") or 12)
    except ValueError:
        tamanho = 12

    try:
        pagina = int(f.get("pagina") or 1)
    except ValueError:
        pagina = 1

    offset = (pagina - 1) * tamanho

    # Ordenacao (US24)
    ordem_chave = str(f.get("ordem") or f.get("ordenar_por") or "recentes").strip()
    if ordem_chave not in _ORDEM_MAP:
        ordem_chave = "recentes"
    clausula_ordem = _ORDEM_MAP[ordem_chave]

    linhas = conn.execute(
        f"""SELECT a.id, a.titulo, a.descricao, a.preco_lote, a.peso_total_kg, a.modo_preco, a.publicado_em,
                   p.nome AS produto, c.nome AS categoria_nome, l.municipio_publico, l.uf_publica, l.regiao_publica,
                   la.quantidade_animais, lg.cultura, lg.quantidade AS sacas, m.id AS capa_id
            {de} ORDER BY {clausula_ordem} LIMIT %s OFFSET %s""",
        [*params, tamanho, offset],
    ).fetchall()

    itens = []
    for r in linhas:
        animal = r["quantidade_animais"] is not None
        qtd = r["quantidade_animais"] if animal else (int(r["sacas"]) if r["sacas"] is not None else None)
        item = {
            "id": str(r["id"]),
            "titulo": r["titulo"],
            "descricao": r["descricao"],
            "categoria": r["categoria_nome"] or ("ANIMAL" if animal else "GRAOS"),
            "produto": r["produto"],
            "cidade": r["municipio_publico"],
            "uf": r["uf_publica"],
            "municipio": r["municipio_publico"],
            "regiaoAproximada": r["regiao_publica"],
            "precoTotal": float(r["preco_lote"]) if r["preco_lote"] is not None else None,
            "pesoTotalKg": float(r["peso_total_kg"]) if r["peso_total_kg"] is not None else None,
            "pricingMode": r["modo_preco"],
            "publicadoEm": r["publicado_em"],
            "capa": None if r["capa_id"] is None else {"id": str(r["capa_id"]), "url": _url_midia(r["capa_id"])},
        }
        if animal:
            item.update({"quantidadeCabecas": qtd, "precoPorCabeca": _por_unidade(r["preco_lote"], qtd) if qtd else None})
        elif qtd is not None:
            item.update({"cultura": r["cultura"], "quantidadeSacas": qtd,
                         "precoPorSaca": _por_unidade(r["preco_lote"], qtd)})
        itens.append(item)

    return {"itens": itens, "pagina": pagina, "tamanho": tamanho, "total": total}


def detalhe_publico(conn: Connection, anuncio_id) -> dict:
    visivel = conn.execute(
        f"SELECT a.vendedor_id FROM safradireta.anuncio a WHERE a.id = %s AND {_VISIVEL}",
        (anuncio_id,),
    ).fetchone()
    if visivel is None:
        raise nao_encontrado("Anúncio não encontrado.")

    anuncio = obter_anuncio(conn, anuncio_id)
    if anuncio["estadoComercial"] != "ATIVO":
        raise nao_encontrado("Anúncio não encontrado.")
    for campo in ("vendedorId", "encerradoEm", "motivoEncerramento", "observacoesEncerramento"):
        anuncio.pop(campo)
    vendedor = conn.execute(
        """SELECT COALESCE(pf.nome, e.nome_fantasia, e.razao_social, c.nome_publico) AS nome
           FROM safradireta.conta c
           LEFT JOIN safradireta.perfil_pf pf ON pf.conta_id = c.id
           LEFT JOIN safradireta.empresa e ON e.conta_id = c.id
           WHERE c.id = %s""",
        (visivel["vendedor_id"],),
    ).fetchone()
    anuncio["vendedor"] = {"nome": vendedor["nome"] if vendedor else None}
    for midia in anuncio.get("midias", []):
        midia["url"] = _url_midia(midia["id"])
    return anuncio


def arquivo_da_midia(conn: Connection, midia_id) -> dict:
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