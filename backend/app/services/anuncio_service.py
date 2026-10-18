"""Regras e consultas de anuncios."""
from psycopg import Connection

from app.errors import invalido, nao_encontrado
from app.schemas.anuncio import AnuncioEntrada

# Campos que o formulario precisa pedir. O nome "bloco.campo" diz onde o front
# deve mandar o dado no JSON. E a unica lista de obrigatorios: o front a le na
# rota de categorias e a validacao da criacao usa as mesmas regras.
_COMUNS = ["produtoId", "titulo", "precoLote"]
CAMPOS_OBRIGATORIOS = {
    "ANIMAIS": _COMUNS + ["loteAnimal.quantidadeAnimais"],
    "GRAOS": _COMUNS + ["loteAgricola.quantidade", "loteAgricola.unidadeId"],
    "CAFE": _COMUNS + ["loteAgricola.quantidade", "loteAgricola.unidadeId"],
}


def listar_categorias(conn: Connection) -> dict:
    """Categorias ativas com seus produtos e campos obrigatorios, mais as unidades."""
    categorias = conn.execute(
        "SELECT id, nome, grupo FROM safradireta.categoria WHERE ativa ORDER BY nome"
    ).fetchall()
    produtos = conn.execute(
        """SELECT p.id, p.nome, p.categoria_id
           FROM safradireta.produto p
           JOIN safradireta.categoria c ON c.id = p.categoria_id AND c.ativa
           ORDER BY p.nome"""
    ).fetchall()
    unidades = conn.execute(
        "SELECT id, codigo, descricao, dimensao FROM safradireta.unidade_medida ORDER BY codigo"
    ).fetchall()

    return {
        "categorias": [
            {
                "id": str(c["id"]),
                "nome": c["nome"],
                "grupo": c["grupo"],
                "camposObrigatorios": CAMPOS_OBRIGATORIOS[c["grupo"]],
                "produtos": [
                    {"id": str(p["id"]), "nome": p["nome"]}
                    for p in produtos if p["categoria_id"] == c["id"]
                ],
            }
            for c in categorias
        ],
        "unidades": [
            {"id": str(u["id"]), "codigo": u["codigo"],
             "descricao": u["descricao"], "dimensao": u["dimensao"]}
            for u in unidades
        ],
    }


def criar_anuncio(conn: Connection, atual: dict, dados: AnuncioEntrada) -> dict:
    """Cria e ja publica um anuncio do vendedor logado."""
    produto = conn.execute(
        """SELECT c.grupo
           FROM safradireta.produto p
           JOIN safradireta.categoria c ON c.id = p.categoria_id AND c.ativa
           WHERE p.id = %s""",
        (dados.produto_id,),
    ).fetchone()
    if produto is None:
        raise invalido("Produto inválido.", {"produtoId": "Escolha um produto da lista."})
    if produto["grupo"] != "ANIMAIS":
        # Grãos e café entram na US011.
        raise invalido("Esta categoria ainda não aceita cadastro de lote.", {"produtoId": "Categoria indisponível."})
    if dados.lote_animal is None:
        raise invalido("Informe os dados do lote.", {"loteAnimal": "Informe os dados do lote de animais."})

    with conn.transaction():
        anuncio = conn.execute(
            """INSERT INTO safradireta.anuncio
                   (vendedor_id, produto_id, titulo, descricao, preco_lote, peso_total_kg,
                    estado_comercial, publicado_em)
               VALUES (%s, %s, %s, %s, %s, %s, 'ATIVO', now())
               RETURNING id""",
            (atual["conta_id"], dados.produto_id, dados.titulo, dados.descricao,
             dados.preco_lote, dados.peso_total_kg),
        ).fetchone()
        lote = dados.lote_animal
        conn.execute(
            """INSERT INTO safradireta.lote_animal
                   (anuncio_id, quantidade_animais, raca, sexo_lote, idade_media_meses, observacoes)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (anuncio["id"], lote.quantidade_animais, lote.raca, lote.sexo_lote,
             lote.idade_media_meses, lote.observacoes),
        )
    return obter_anuncio(conn, anuncio["id"])


def _num(valor):
    return None if valor is None else float(valor)


def obter_anuncio(conn: Connection, anuncio_id) -> dict:
    """Anuncio completo, no formato que o front recebe."""
    a = conn.execute(
        """SELECT a.*, p.nome AS produto_nome, c.id AS categoria_id,
                  c.nome AS categoria_nome, c.grupo
           FROM safradireta.anuncio a
           JOIN safradireta.produto p ON p.id = a.produto_id
           JOIN safradireta.categoria c ON c.id = p.categoria_id
           WHERE a.id = %s""",
        (anuncio_id,),
    ).fetchone()
    if a is None:
        raise nao_encontrado("Anúncio não encontrado.")

    animal = conn.execute(
        "SELECT * FROM safradireta.lote_animal WHERE anuncio_id = %s", (anuncio_id,)
    ).fetchone()
    midias = conn.execute(
        """SELECT id, tipo, ordem, capa FROM safradireta.midia_anuncio
           WHERE anuncio_id = %s ORDER BY ordem""",
        (anuncio_id,),
    ).fetchall()

    return {
        "id": str(a["id"]),
        "vendedorId": str(a["vendedor_id"]),
        "produto": {"id": str(a["produto_id"]), "nome": a["produto_nome"]},
        "categoria": {"id": str(a["categoria_id"]), "nome": a["categoria_nome"], "grupo": a["grupo"]},
        "titulo": a["titulo"],
        "descricao": a["descricao"],
        "precoLote": _num(a["preco_lote"]),
        "moeda": a["moeda"],
        "pesoTotalKg": _num(a["peso_total_kg"]),
        "estadoComercial": a["estado_comercial"],
        "versao": a["versao"],
        "criadoEm": a["criado_em"],
        "atualizadoEm": a["atualizado_em"],
        "publicadoEm": a["publicado_em"],
        "loteAnimal": None if animal is None else {
            "quantidadeAnimais": animal["quantidade_animais"],
            "raca": animal["raca"],
            "sexoLote": animal["sexo_lote"],
            "idadeMediaMeses": _num(animal["idade_media_meses"]),
            "observacoes": animal["observacoes"],
        },
        "midias": [
            {"id": str(m["id"]), "tipo": m["tipo"], "ordem": m["ordem"], "capa": m["capa"]}
            for m in midias
        ],
    }
