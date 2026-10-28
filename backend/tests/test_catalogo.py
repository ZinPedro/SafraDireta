"""Catalogo (US018), detalhe publico (US019) e arquivos das midias, com banco real."""
from io import BytesIO
from uuid import uuid4

import pytest
from PIL import Image

from tests.conftest import corpo_animal, corpo_graos


@pytest.fixture(autouse=True)
def uploads_temporarios(tmp_path, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture()
def vendedor(criar_vendedor):
    return criar_vendedor()


def _png() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (10, 10), "green").save(buf, format="PNG")
    return buf.getvalue()


def _foto(client, vendedor, anuncio):
    r = client.post(f"/api/vendedor/anuncios/{anuncio['id']}/midias", headers=vendedor["headers"],
                    files={"arquivo": ("foto.png", _png(), "image/png")})
    assert r.status_code == 201, r.text
    return r.json()


def _estado(client, anuncio, estado):
    client.db.execute(
        "UPDATE safradireta.anuncio SET estado_comercial = %s, "
        "vendido_em = CASE WHEN %s = 'VENDIDO' THEN now() END, "
        "origem_encerramento = CASE WHEN %s = 'VENDIDO' THEN 'MANUAL' END WHERE id = %s",
        (estado, estado, estado, anuncio["id"]))


def _ids(client, **params):
    r = client.get("/api/anuncios", params={"tamanho": 50, **params})
    assert r.status_code == 200, r.text
    return {i["id"] for i in r.json()["itens"]}


# ---------------------------------------------------------------- US018

def test_catalogo_e_publico_e_traz_o_resumo(client, vendedor, criar_anuncio):
    a = criar_anuncio(vendedor)
    r = client.get("/api/anuncios", params={"tamanho": 50})

    assert r.status_code == 200
    corpo = r.json()
    item = next(i for i in corpo["itens"] if i["id"] == a["id"])
    assert item["categoria"] == "ANIMAL" and item["produto"] == "Boi gordo"
    assert (item["cidade"], item["uf"]) == ("Campinas", "SP")
    assert item["precoTotal"] == 50000 and item["precoPorCabeca"] == 5000
    assert item["quantidadeCabecas"] == 10 and item["capa"] is None
    assert {"pagina", "tamanho", "total"} <= set(corpo)
    assert "vendedorId" not in item


def test_catalogo_so_mostra_anuncios_ativos(client, vendedor, criar_anuncio):
    ativo, pausado, vendido = (criar_anuncio(vendedor) for _ in range(3))
    _estado(client, pausado, "PAUSADO")
    _estado(client, vendido, "VENDIDO")

    ids = _ids(client)
    assert ativo["id"] in ids
    assert pausado["id"] not in ids and vendido["id"] not in ids


def test_catalogo_traz_a_capa_da_foto(client, vendedor, criar_anuncio):
    a = criar_anuncio(vendedor)
    midia = _foto(client, vendedor, a)

    item = next(i for i in client.get("/api/anuncios", params={"tamanho": 50}).json()["itens"] if i["id"] == a["id"])
    assert item["capa"] == {"id": midia["id"], "url": f"/api/midias/{midia['id']}"}


def test_filtros_do_catalogo(client, vendedor, criar_anuncio):
    boi = criar_anuncio(vendedor, titulo="Boi filtro unico", uf="GO", precoTotal=70000)
    soja = criar_anuncio(vendedor, tipo="graos", titulo="Soja filtro unica", uf="MT")
    milho = criar_anuncio(vendedor, tipo="graos", cultura="MILHO", subtipo="COMERCIAL_RACAO",
                          titulo="Milho filtro unico", uf="PR", precoTotal=200000)

    assert boi["id"] in _ids(client, categoria="ANIMAL") and soja["id"] not in _ids(client, categoria="ANIMAL")
    assert {soja["id"], milho["id"]} <= _ids(client, categoria="GRAOS")
    assert _ids(client, cultura="MILHO") & {soja["id"], milho["id"]} == {milho["id"]}
    assert _ids(client, uf="mt") & {boi["id"], soja["id"], milho["id"]} == {soja["id"]}
    assert _ids(client, precoMin=150000, uf="PR") == {milho["id"]}
    assert _ids(client, precoMax=60000, uf="GO") == set()
    assert _ids(client, busca="filtro unica") == {soja["id"]}


def test_ordem_e_paginacao(client, vendedor, criar_anuncio):
    baratos = [criar_anuncio(vendedor, titulo=f"Pagina teste {n}", uf="AC", precoTotal=1000 * n) for n in (3, 1, 2)]
    params = {"uf": "AC", "tamanho": 2}

    r = client.get("/api/anuncios", params={**params, "ordem": "menor_preco"}).json()
    assert [i["precoTotal"] for i in r["itens"]] == [1000, 2000] and r["total"] == 3
    r2 = client.get("/api/anuncios", params={**params, "ordem": "menor_preco", "pagina": 2}).json()
    assert [i["precoTotal"] for i in r2["itens"]] == [3000] and r2["pagina"] == 2
    r3 = client.get("/api/anuncios", params={**params, "ordem": "maior_preco"}).json()
    assert r3["itens"][0]["precoTotal"] == 3000
    assert len(baratos) == 3


@pytest.mark.parametrize("params", [
    {"categoria": "PEIXE"}, {"cultura": "ARROZ"}, {"ordem": "aleatoria"}, {"pagina": 0},
    {"tamanho": 51}, {"uf": "SAO"}, {"precoMin": -1},
])
def test_parametros_invalidos_retornam_422(client, params):
    assert client.get("/api/anuncios", params=params).status_code == 422


# ---------------------------------------------------------------- US019

def test_detalhe_publico_do_anuncio(client, vendedor, criar_anuncio):
    a = criar_anuncio(vendedor, tipo="graos")
    r = client.get(f"/api/anuncios/{a['id']}")  # sem token

    assert r.status_code == 200
    d = r.json()
    assert d["id"] == a["id"] and d["cultura"] == "SOJA" and d["quantidadeSacas"] == 1000
    assert d["precoPorSaca"] == 130 and d["pesoTotalToneladas"] == 60
    assert d["vendedor"]["nome"]  # so o nome do vendedor


def test_detalhe_nao_expoe_dados_internos(client, vendedor, criar_anuncio):
    a = criar_anuncio(vendedor)
    d = client.get(f"/api/anuncios/{a['id']}").json()

    assert "vendedorId" not in d
    assert vendedor["id"] not in str(d)


def test_detalhe_traz_midias_com_url(client, vendedor, criar_anuncio):
    a = criar_anuncio(vendedor)
    midia = _foto(client, vendedor, a)

    d = client.get(f"/api/anuncios/{a['id']}").json()
    assert d["midias"] == [{"id": midia["id"], "tipo": "FOTO", "ordem": 0, "capa": True,
                            "url": f"/api/midias/{midia['id']}"}]


@pytest.mark.parametrize("estado", ["PAUSADO", "VENDIDO"])
def test_detalhe_de_anuncio_nao_ativo_retorna_404(client, vendedor, criar_anuncio, estado):
    a = criar_anuncio(vendedor)
    _estado(client, a, estado)
    assert client.get(f"/api/anuncios/{a['id']}").status_code == 404


def test_detalhe_inexistente_ou_id_invalido(client):
    assert client.get(f"/api/anuncios/{uuid4()}").status_code == 404
    assert client.get("/api/anuncios/abc").status_code == 422


# ---------------------------------------------------------------- arquivos das midias

def test_arquivo_da_foto_e_servido_ao_publico(client, vendedor, criar_anuncio):
    a = criar_anuncio(vendedor)
    midia = _foto(client, vendedor, a)

    r = client.get(f"/api/midias/{midia['id']}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png" and r.content == _png()


def test_arquivo_de_anuncio_pausado_nao_e_servido(client, vendedor, criar_anuncio):
    a = criar_anuncio(vendedor)
    midia = _foto(client, vendedor, a)
    _estado(client, a, "PAUSADO")
    assert client.get(f"/api/midias/{midia['id']}").status_code == 404


def test_midia_inexistente_retorna_404(client):
    assert client.get(f"/api/midias/{uuid4()}").status_code == 404
