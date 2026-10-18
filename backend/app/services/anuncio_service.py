"""Regras e consultas de anuncios."""
from decimal import ROUND_HALF_UP, Decimal
from typing import get_args

from fastapi.exceptions import RequestValidationError
from psycopg import Connection
from psycopg.types.json import Jsonb
from pydantic import TypeAdapter, ValidationError

from app.errors import conflito, invalido, nao_encontrado
from app.schemas.anuncio import AnuncioAnimal, AnuncioEntrada, AnuncioGraos
from app.services.anuncio_regras import PENEIRAS, RACAS, SACA_KG, SUBTIPOS, conferir

_COMUNS = ["titulo", "cidade", "uf", "pricingMode", "precoTotal"]
# Campos que o formulario precisa pedir, por tipo de formulario ("ANIMAL" ou "GRAOS").
CAMPOS_OBRIGATORIOS = {
    "ANIMAL": ["categoria", "especie", "raca", "finalidade", "quantidadeCabecas", "pesoMedioKg"] + _COMUNS,
    "GRAOS": ["categoria", "cultura", "subtipo", "safra", "embalagem", "umidadePercentual", "quantidadeSacas"] + _COMUNS,
}
_FORMULARIO_DO_GRUPO = {"ANIMAIS": "ANIMAL", "GRAOS": "GRAOS", "CAFE": "GRAOS"}


def _opcoes() -> dict:
    return {
        "racas": RACAS,
        "finalidades": list(get_args(AnuncioAnimal.model_fields["finalidade"].annotation)),
        "culturas": list(get_args(AnuncioGraos.model_fields["cultura"].annotation)),
        "embalagens": list(get_args(AnuncioGraos.model_fields["embalagem"].annotation)),
        "peneirasCafe": PENEIRAS,
        "subtipos": {
            cultura: [{"codigo": codigo, "rotulo": rotulo} for codigo, rotulo in itens.items()]
            for cultura, itens in SUBTIPOS.items()
        },
    }


def listar_categorias(conn: Connection) -> dict:
    """Categorias ativas com produtos e campos obrigatorios, mais unidades e opcoes do formulario."""
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
                "formulario": _FORMULARIO_DO_GRUPO[c["grupo"]],
                "camposObrigatorios": CAMPOS_OBRIGATORIOS[_FORMULARIO_DO_GRUPO[c["grupo"]]],
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
        "opcoes": _opcoes(),
    }


# ---------------------------------------------------------------- gravacao

def _nome_do_produto(d) -> str:
    """O front nao manda produto: o backend escolhe pelo tipo do anuncio."""
    if isinstance(d, AnuncioAnimal):
        return "Boi gordo"
    if d.cultura == "CAFE":
        return "Cafe conilon" if d.subtipo == "CONILON_ROBUSTA" else "Cafe arabica"
    return {"SOJA": "Soja em grao", "MILHO": "Milho em grao",
            "TRIGO": "Trigo em grao", "OUTRO": "Outro grao"}[d.cultura]


def _id_por(conn: Connection, tabela: str, coluna: str, valor: str):
    linha = conn.execute(f"SELECT id FROM safradireta.{tabela} WHERE {coluna} = %s", (valor,)).fetchone()
    if linha is None:
        raise RuntimeError(f"{tabela} '{valor}' nao cadastrado: rode sql/06_seed_anuncios.sql")
    return linha["id"]


def _dados_do_lote(conn: Connection, d, laudo: dict):
    """Devolve (tabela do lote, colunas do lote, peso total em kg)."""
    if isinstance(d, AnuncioAnimal):
        colunas = {
            "especie": d.especie, "raca": d.raca,
            "raca_personalizada": d.raca_personalizada if d.raca == "OUTRA" else None,
            "finalidade": d.finalidade, "quantidade_animais": d.quantidade_cabecas,
            "peso_medio_kg": d.peso_medio_kg, "idade_media_meses": d.idade_meses,
        }
        return "lote_animal", colunas, (d.peso_medio_kg * d.quantidade_cabecas).quantize(Decimal("0.001"))

    colunas = {
        "cultura": d.cultura,
        "cultura_personalizada": d.cultura_personalizada if d.cultura == "OUTRO" else None,
        "subtipo": d.subtipo,
        "subtipo_personalizado": d.subtipo_personalizado if d.subtipo == "OUTRO" else None,
        "safra": d.safra, "embalagem": d.embalagem, "umidade_percentual": d.umidade_percentual,
        "quantidade": d.quantidade_sacas,  # sempre em sacas de 60 kg
        "unidade_id": _id_por(conn, "unidade_medida", "codigo", "SACA_60KG"),
        "laudo_tecnico": Jsonb(laudo),
    }
    return "lote_agricola", colunas, Decimal(d.quantidade_sacas) * SACA_KG


def _gravar_localizacao(conn: Connection, anuncio_id, d) -> None:
    conn.execute(
        """INSERT INTO safradireta.localizacao_anuncio (anuncio_id, municipio_publico, uf_publica)
           VALUES (%s, %s, %s)
           ON CONFLICT (anuncio_id) DO UPDATE
           SET municipio_publico = EXCLUDED.municipio_publico, uf_publica = EXCLUDED.uf_publica""",
        (anuncio_id, d.cidade, d.uf.upper()),
    )


def criar_anuncio(conn: Connection, atual: dict, dados) -> dict:
    """Cria e ja publica um anuncio do vendedor logado."""
    laudo = conferir(dados)
    produto_id = _id_por(conn, "produto", "nome", _nome_do_produto(dados))
    tabela, colunas, peso_kg = _dados_do_lote(conn, dados, laudo)

    with conn.transaction():
        anuncio = conn.execute(
            """INSERT INTO safradireta.anuncio
                   (vendedor_id, produto_id, titulo, descricao, preco_lote, modo_preco,
                    peso_total_kg, estado_comercial, publicado_em)
               VALUES (%s, %s, %s, %s, %s, %s, %s, 'ATIVO', now())
               RETURNING id""",
            (atual["conta_id"], produto_id, dados.titulo, dados.descricao, dados.preco_total,
             dados.pricing_mode, peso_kg),
        ).fetchone()
        _gravar_localizacao(conn, anuncio["id"], dados)
        nomes = ", ".join(colunas)
        conn.execute(
            f"INSERT INTO safradireta.{tabela} (anuncio_id, {nomes}) "
            f"VALUES (%s{', %s' * len(colunas)})",
            (anuncio["id"], *colunas.values()),
        )
    return obter_anuncio(conn, anuncio["id"])


# ---------------------------------------------------------------- leitura

def _num(valor):
    return None if valor is None else float(valor)


def _por_unidade(total, quantidade):
    return float((total / quantidade).quantize(Decimal("0.01"), ROUND_HALF_UP))


def obter_anuncio(conn: Connection, anuncio_id) -> dict:
    """Anuncio completo no formato do formulario (os mesmos nomes que o front envia)."""
    a = conn.execute(
        """SELECT a.*, p.nome AS produto_nome, l.municipio_publico, l.uf_publica
           FROM safradireta.anuncio a
           JOIN safradireta.produto p ON p.id = a.produto_id
           LEFT JOIN safradireta.localizacao_anuncio l ON l.anuncio_id = a.id
           WHERE a.id = %s""",
        (anuncio_id,),
    ).fetchone()
    if a is None:
        raise nao_encontrado("Anúncio não encontrado.")

    animal = conn.execute("SELECT * FROM safradireta.lote_animal WHERE anuncio_id = %s", (anuncio_id,)).fetchone()
    graos = conn.execute("SELECT * FROM safradireta.lote_agricola WHERE anuncio_id = %s", (anuncio_id,)).fetchone()
    midias = conn.execute(
        "SELECT id, tipo, ordem, capa FROM safradireta.midia_anuncio WHERE anuncio_id = %s ORDER BY ordem",
        (anuncio_id,),
    ).fetchall()

    resposta = {
        "id": str(a["id"]),
        "vendedorId": str(a["vendedor_id"]),
        "produto": {"id": str(a["produto_id"]), "nome": a["produto_nome"]},
        "estadoComercial": a["estado_comercial"],
        "versao": a["versao"],
        "criadoEm": a["criado_em"],
        "atualizadoEm": a["atualizado_em"],
        "publicadoEm": a["publicado_em"],
        "titulo": a["titulo"],
        "descricao": a["descricao"],
        "cidade": a["municipio_publico"],
        "uf": a["uf_publica"],
        "pricingMode": a["modo_preco"],
        "precoTotal": _num(a["preco_lote"]),
        "midias": [{"id": str(m["id"]), "tipo": m["tipo"], "ordem": m["ordem"], "capa": m["capa"]} for m in midias],
    }
    if animal is not None:
        qtd = animal["quantidade_animais"]
        resposta.update({
            "categoria": "ANIMAL", "especie": animal["especie"], "raca": animal["raca"],
            "racaPersonalizada": animal["raca_personalizada"], "finalidade": animal["finalidade"],
            "quantidadeCabecas": qtd, "pesoMedioKg": _num(animal["peso_medio_kg"]),
            "idadeMeses": None if animal["idade_media_meses"] is None else int(animal["idade_media_meses"]),
            "precoPorCabeca": _por_unidade(a["preco_lote"], qtd),
        })
    elif graos is not None:
        sacas = int(graos["quantidade"])
        resposta.update({
            "categoria": "GRAOS", "cultura": graos["cultura"],
            "culturaPersonalizada": graos["cultura_personalizada"], "subtipo": graos["subtipo"],
            "subtipoPersonalizado": graos["subtipo_personalizado"], "safra": graos["safra"],
            "embalagem": graos["embalagem"], "umidadePercentual": _num(graos["umidade_percentual"]),
            "quantidadeSacas": sacas, "pesoTotalToneladas": _num(a["peso_total_kg"] / 1000),
            "precoPorSaca": _por_unidade(a["preco_lote"], sacas), "laudoTecnico": graos["laudo_tecnico"],
        })
    return resposta


# ---------------------------------------------------------------- edicao

# O que a resposta traz alem do formulario: nao volta para a validacao da edicao.
_FORA_DO_FORMULARIO = {
    "id", "vendedorId", "produto", "estadoComercial", "versao", "criadoEm", "atualizadoEm",
    "publicadoEm", "midias", "precoPorCabeca", "precoPorSaca", "pesoTotalToneladas",
}
_IMUTAVEIS = ("categoria", "especie", "cultura")
_ENTRADA = TypeAdapter(AnuncioEntrada)


def editar_anuncio(conn: Connection, anuncio: dict, corpo: dict) -> dict:
    """Edicao parcial: junta o que veio com o anuncio atual e valida tudo como na criacao.

    'anuncio' ja foi validado como sendo do vendedor logado.
    """
    if anuncio["estado_comercial"] == "VENDIDO":
        raise conflito("Anúncio vendido não pode ser editado.")
    if not corpo:
        raise invalido("Envie ao menos um campo para alterar.", {"corpo": "Envie ao menos um campo."})

    completo = obter_anuncio(conn, anuncio["id"])
    atual = {k: v for k, v in completo.items() if k not in _FORA_DO_FORMULARIO}
    # Valores derivados que o front devolve como vieram do GET sao so eco: ignorados.
    corpo = {k: v for k, v in corpo.items()
             if not (k in ("precoPorCabeca", "precoPorSaca", "pesoTotalToneladas") and v == completo.get(k))}
    for campo in _IMUTAVEIS:
        if campo in corpo and corpo[campo] != atual.get(campo):
            raise invalido("Dados inválidos.", {campo: "Este campo não pode ser alterado."})

    try:
        dados = _ENTRADA.validate_python({**atual, **corpo})
    except ValidationError as erro:
        raise RequestValidationError(erro.errors()) from None
    laudo = conferir(dados)
    produto_id = _id_por(conn, "produto", "nome", _nome_do_produto(dados))
    tabela, colunas, peso_kg = _dados_do_lote(conn, dados, laudo)

    with conn.transaction():
        conn.execute(
            """UPDATE safradireta.anuncio
               SET titulo = %s, descricao = %s, preco_lote = %s, modo_preco = %s, peso_total_kg = %s,
                   produto_id = %s, versao = versao + 1, atualizado_em = now()
               WHERE id = %s""",
            (dados.titulo, dados.descricao, dados.preco_total, dados.pricing_mode, peso_kg,
             produto_id, anuncio["id"]),
        )
        _gravar_localizacao(conn, anuncio["id"], dados)
        atribuicoes = ", ".join(f"{c} = %s" for c in colunas)
        conn.execute(
            f"UPDATE safradireta.{tabela} SET {atribuicoes} WHERE anuncio_id = %s",
            (*colunas.values(), anuncio["id"]),
        )
    return obter_anuncio(conn, anuncio["id"])
