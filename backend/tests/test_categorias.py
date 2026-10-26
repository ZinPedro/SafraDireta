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

    animais = por_nome["Boi gordo"]
    assert animais["formulario"] == "ANIMAL"
    assert {"raca", "finalidade", "quantidadeCabecas", "pesoMedioKg", "precoTotal"} <= set(animais["camposObrigatorios"])
    assert "quantidadeSacas" not in animais["camposObrigatorios"]
    for nome in ("Soja", "Milho", "Cafe"):
        assert por_nome[nome]["formulario"] == "GRAOS"
        campos = por_nome[nome]["camposObrigatorios"]
        assert {"cultura", "subtipo", "safra", "embalagem", "quantidadeSacas"} <= set(campos)
        assert "quantidadeCabecas" not in campos


def test_traz_as_opcoes_do_formulario(client):
    opcoes = _listar(client)["opcoes"]

    assert "Nelore" in opcoes["racas"] and "OUTRA" in opcoes["racas"]
    assert set(opcoes["culturas"]) == {"SOJA", "MILHO", "CAFE", "TRIGO", "OUTRO"}
    assert "CONILON_ROBUSTA" in {s["codigo"] for s in opcoes["subtipos"]["CAFE"]}
    assert "ENGORDA_ABATE" in opcoes["finalidades"]
    assert "GRANEL" in opcoes["embalagens"]


def test_traz_as_unidades(client):
    unidades = {u["codigo"]: u for u in _listar(client)["unidades"]}

    assert {"KG", "TON", "SACA_60KG", "CABECA"} <= set(unidades)
    assert unidades["KG"]["dimensao"] == "MASSA"
    assert unidades["CABECA"]["dimensao"] == "CONTAGEM"

