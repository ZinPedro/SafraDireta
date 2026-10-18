"""Regras e consultas de anuncios."""
from psycopg import Connection

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
