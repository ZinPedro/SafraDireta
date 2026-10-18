"""Abrir e editar anuncio (US014), com banco real."""
import pytest

SEM_ANUNCIO = "00000000-0000-0000-0000-000000000000"


@pytest.fixture()
def vendedor(criar_vendedor):
    return criar_vendedor()


@pytest.fixture()
def anuncio(vendedor, criar_anuncio):
    return criar_anuncio(vendedor, titulo="Lote original", descricao="Gado manso")


def _url(anuncio):
    return f"/api/vendedor/anuncios/{anuncio['id']}"


def _editar(client, vendedor, anuncio, corpo):
    return client.patch(_url(anuncio), headers=vendedor["headers"], json=corpo)


def _campos(r):
    return r.json()["erro"]["campos"]


# ---------------------------------------------------------------- abrir

def test_dono_abre_o_anuncio_com_os_campos_preenchidos(client, vendedor, anuncio):
    r = client.get(_url(anuncio), headers=vendedor["headers"])

    assert r.status_code == 200
    a = r.json()
    assert a["titulo"] == "Lote original" and a["quantidadeCabecas"] == 10
    assert a["raca"] == "Nelore" and a["cidade"] == "Campinas"


def test_outro_vendedor_nao_abre_nem_edita(client, anuncio, criar_vendedor):
    outro = criar_vendedor()

    assert client.get(_url(anuncio), headers=outro["headers"]).status_code == 403
    assert _editar(client, outro, anuncio, {"titulo": "Roubado de verdade"}).status_code == 403


def test_sem_token_ou_sem_habilitacao_nao_acessa(client, anuncio, criar_pf):
    assert client.get(_url(anuncio)).status_code == 401
    assert client.patch(_url(anuncio), json={"titulo": "Qualquer titulo"}).status_code == 401
    assert client.get(_url(anuncio), headers=criar_pf()["headers"]).status_code == 403


def test_anuncio_inexistente_retorna_404(client, vendedor):
    r = client.get(f"/api/vendedor/anuncios/{SEM_ANUNCIO}", headers=vendedor["headers"])
    assert r.status_code == 404


# ---------------------------------------------------------------- editar animais

def test_edicao_parcial_muda_so_o_que_foi_enviado_e_fica_salva(client, vendedor, anuncio):
    r = _editar(client, vendedor, anuncio, {"titulo": "Titulo novo do lote", "quantidadeCabecas": 20})

    assert r.status_code == 200, r.text
    a = r.json()
    assert a["titulo"] == "Titulo novo do lote" and a["quantidadeCabecas"] == 20
    assert a["raca"] == "Nelore" and a["descricao"] == "Gado manso"
    assert a["precoPorCabeca"] == 2500  # total continua 50000
    assert a["versao"] == 2
    assert client.get(_url(anuncio), headers=vendedor["headers"]).json()["quantidadeCabecas"] == 20


def test_formulario_inteiro_devolvido_pelo_get_tambem_vale(client, vendedor, anuncio):
    """O front pode pegar o GET, mexer num campo e reenviar tudo."""
    atual = client.get(_url(anuncio), headers=vendedor["headers"]).json()
    atual["precoTotal"] = 60000
    r = _editar(client, vendedor, anuncio, atual)

    assert r.status_code == 200, r.text
    assert r.json()["precoTotal"] == 60000


def test_edicao_atualiza_peso_total_e_cidade(client, vendedor, anuncio):
    _editar(client, vendedor, anuncio, {"pesoMedioKg": 500, "cidade": "Jundiai"})

    linha = client.db.execute(
        "SELECT a.peso_total_kg, l.municipio_publico FROM safradireta.anuncio a "
        "JOIN safradireta.localizacao_anuncio l ON l.anuncio_id = a.id WHERE a.id = %s", (anuncio["id"],)
    ).fetchone()
    assert float(linha["peso_total_kg"]) == 5000 and linha["municipio_publico"] == "Jundiai"


def test_edicao_nao_muda_o_estado_nem_o_dono(client, vendedor, anuncio):
    r = _editar(client, vendedor, anuncio, {"estadoComercial": "PAUSADO", "vendedorId": SEM_ANUNCIO})

    assert r.status_code == 200
    assert r.json()["estadoComercial"] == "ATIVO" and r.json()["vendedorId"] == vendedor["id"]


def test_descricao_pode_ser_limpa_com_null(client, vendedor, anuncio):
    r = _editar(client, vendedor, anuncio, {"descricao": None})
    assert r.status_code == 200 and r.json()["descricao"] is None


def test_edicao_segue_as_mesmas_regras_da_criacao(client, vendedor, anuncio):
    r = _editar(client, vendedor, anuncio, {"raca": "OUTRA"})
    assert r.status_code == 422 and "racaPersonalizada" in _campos(r)

    r = _editar(client, vendedor, anuncio, {"pricingMode": "PER_HEAD", "precoPorCabeca": 1})
    assert r.status_code == 422 and "precoPorCabeca" in _campos(r)


@pytest.mark.parametrize("corpo,campo", [
    ({"titulo": "abc"}, "titulo"), ({"precoTotal": 0}, "precoTotal"),
    ({"quantidadeCabecas": 0}, "quantidadeCabecas"), ({"uf": "ZZ"}, "uf"),
])
def test_valores_invalidos_retornam_422(client, vendedor, anuncio, corpo, campo):
    r = _editar(client, vendedor, anuncio, corpo)
    assert r.status_code == 422 and campo in _campos(r)


def test_corpo_vazio_retorna_422(client, vendedor, anuncio):
    assert _editar(client, vendedor, anuncio, {}).status_code == 422


def test_fotos_e_video_nao_vao_na_edicao(client, vendedor, anuncio):
    r = _editar(client, vendedor, anuncio, {"fotos": ["a.jpg"]})
    assert r.status_code == 422 and "fotos" in _campos(r)


def test_categoria_e_especie_nao_mudam(client, vendedor, anuncio):
    r = _editar(client, vendedor, anuncio, {"categoria": "GRAOS"})
    assert r.status_code == 422 and "categoria" in _campos(r)


# ---------------------------------------------------------------- editar graos

def test_edita_lote_de_graos(client, vendedor, criar_anuncio):
    graos = criar_anuncio(vendedor, tipo="graos")
    r = _editar(client, vendedor, graos, {"quantidadeSacas": 500, "embalagem": "BIG_BAG"})

    assert r.status_code == 200, r.text
    a = r.json()
    assert a["quantidadeSacas"] == 500 and a["embalagem"] == "BIG_BAG"
    assert a["pesoTotalToneladas"] == 30 and a["precoPorSaca"] == 260


def test_cultura_nao_muda(client, vendedor, criar_anuncio):
    graos = criar_anuncio(vendedor, tipo="graos")
    r = _editar(client, vendedor, graos, {"cultura": "MILHO", "subtipo": "COMERCIAL_RACAO"})
    assert r.status_code == 422 and "cultura" in _campos(r)


def test_subtipo_de_cafe_conilon_troca_o_produto(client, vendedor, criar_anuncio):
    cafe = criar_anuncio(vendedor, tipo="graos", cultura="CAFE", subtipo="ARABICA_TIPO6_DURA",
                         laudoTecnico={"cafePeneira": "17_18_ACIMA"})
    assert cafe["produto"]["nome"] == "Cafe arabica"

    r = _editar(client, vendedor, cafe, {"subtipo": "CONILON_ROBUSTA"})
    assert r.status_code == 200, r.text
    assert r.json()["produto"]["nome"] == "Cafe conilon"


def test_subtipo_de_outra_cultura_e_recusado(client, vendedor, criar_anuncio):
    graos = criar_anuncio(vendedor, tipo="graos")
    r = _editar(client, vendedor, graos, {"subtipo": "PAO_TIPO1"})
    assert r.status_code == 422 and "subtipo" in _campos(r)


# ---------------------------------------------------------------- estado

def test_anuncio_pausado_pode_ser_editado_e_vendido_nao(client, vendedor, anuncio):
    def estado(valor):
        client.db.execute(
            "UPDATE safradireta.anuncio SET estado_comercial = %s, "
            "vendido_em = CASE WHEN %s = 'VENDIDO' THEN now() END, "
            "origem_encerramento = CASE WHEN %s = 'VENDIDO' THEN 'MANUAL' END WHERE id = %s",
            (valor, valor, valor, anuncio["id"]))

    estado("PAUSADO")
    assert _editar(client, vendedor, anuncio, {"titulo": "Pausado editado ok"}).status_code == 200

    estado("VENDIDO")
    r = _editar(client, vendedor, anuncio, {"titulo": "Vendido nao edita"})
    assert r.status_code == 409 and r.json()["erro"]["codigo"] == "CONFLITO"
