"""Rota de categorias (base dos anuncios). Usa os dados de sql/06_seed_anuncios.sql."""


def _listar(client):
    r = client.get("/api/categorias")
    assert r.status_code == 200, r.text
    return r.json()


def test_rota_e_publica_e_lista_as_categorias_com_produtos(client):
    dados = _listar(client)
    por_nome = {c["nome"]: c for c in dados["categorias"]}

    assert {"Boi gordo", "Soja", "Milho", "Cafe"} <= set(por_nome)
    assert por_nome["Boi gordo"]["grupo"] == "ANIMAIS"
    assert por_nome["Soja"]["grupo"] == "GRAOS"
    assert por_nome["Cafe"]["grupo"] == "CAFE"
    assert {p["nome"] for p in por_nome["Cafe"]["produtos"]} == {"Cafe arabica", "Cafe conilon"}
    assert all(p["id"] for c in dados["categorias"] for p in c["produtos"])


def test_cada_grupo_traz_seus_campos_obrigatorios(client):
    por_nome = {c["nome"]: c for c in _listar(client)["categorias"]}

    assert "loteAnimal.quantidadeAnimais" in por_nome["Boi gordo"]["camposObrigatorios"]
    assert "loteAgricola.quantidade" not in por_nome["Boi gordo"]["camposObrigatorios"]
    for nome in ("Soja", "Milho", "Cafe"):
        campos = por_nome[nome]["camposObrigatorios"]
        assert "loteAgricola.unidadeId" in campos
        assert "loteAnimal.quantidadeAnimais" not in campos
        assert {"produtoId", "titulo", "precoLote"} <= set(campos)


def test_traz_as_unidades(client):
    unidades = {u["codigo"]: u for u in _listar(client)["unidades"]}

    assert {"KG", "TON", "SACA_60KG", "CABECA"} <= set(unidades)
    assert unidades["KG"]["dimensao"] == "MASSA"
    assert unidades["CABECA"]["dimensao"] == "CONTAGEM"

