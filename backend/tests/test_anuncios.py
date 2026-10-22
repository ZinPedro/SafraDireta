"""Criacao de anuncios (US010 animais e US011 graos/cafe) no formato do front, com banco real."""
import pytest

from tests.conftest import corpo_animal, corpo_graos


@pytest.fixture()
def vendedor(criar_vendedor):
    return criar_vendedor()


def _criar(client, vendedor, corpo):
    return client.post("/api/vendedor/anuncios", headers=vendedor["headers"], json=corpo)


def _campos(r):
    return r.json()["erro"]["campos"]


# ---------------------------------------------------------------- animais

def test_vendedor_cria_lote_de_animais_ja_disponivel(client, vendedor):
    r = _criar(client, vendedor, corpo_animal(descricao="Gado manso"))

    assert r.status_code == 201, r.text
    a = r.json()
    assert a["estadoComercial"] == "ATIVO" and a["publicadoEm"] is not None
    assert a["categoria"] == "ANIMAL" and a["produto"]["nome"] == "Boi gordo"
    assert a["precoTotal"] == 50000 and a["pricingMode"] == "TOTAL"
    assert a["precoPorCabeca"] == 5000
    assert (a["cidade"], a["uf"]) == ("Campinas", "SP")
    assert a["quantidadeCabecas"] == 10 and a["pesoMedioKg"] == 480
    assert a["midias"] == [] and a["versao"] == 1


def test_peso_total_dos_animais_e_calculado_no_banco(client, vendedor):
    a = _criar(client, vendedor, corpo_animal()).json()
    linha = client.db.execute(
        "SELECT peso_total_kg FROM safradireta.anuncio WHERE id = %s", (a["id"],)
    ).fetchone()
    assert float(linha["peso_total_kg"]) == 4800


def test_anuncio_fica_ligado_ao_vendedor_do_token(client, vendedor):
    a = _criar(client, vendedor, corpo_animal(vendedorId="00000000-0000-0000-0000-000000000000")).json()
    assert a["vendedorId"] == vendedor["id"]


def test_conta_sem_habilitacao_nao_cria(client, criar_pf):
    r = _criar(client, criar_pf(), corpo_animal())
    assert r.status_code == 403 and r.json()["erro"]["codigo"] == "PROIBIDO"


def test_sem_token_retorna_401(client):
    assert client.post("/api/vendedor/anuncios", json=corpo_animal()).status_code == 401


def test_campos_obrigatorios_do_animal(client, vendedor):
    r = _criar(client, vendedor, {"categoria": "ANIMAL"})
    assert r.status_code == 422
    assert {"especie", "titulo", "raca", "finalidade", "quantidadeCabecas",
            "pesoMedioKg", "cidade", "uf", "pricingMode", "precoTotal"} <= set(_campos(r))


def test_categoria_desconhecida_ou_ausente_retorna_422(client, vendedor):
    assert _criar(client, vendedor, {"titulo": "x"}).status_code == 422
    assert _criar(client, vendedor, {"categoria": "PEIXE"}).status_code == 422


@pytest.mark.parametrize("campo,valor", [
    ("quantidadeCabecas", 0), ("pesoMedioKg", 0), ("precoTotal", 0), ("precoTotal", -5),
    ("precoTotal", 10.123), ("titulo", "   "), ("titulo", "abc"), ("finalidade", "PASSEIO"),
    ("especie", "SUINO"),
])
def test_valores_invalidos_do_animal(client, vendedor, campo, valor):
    r = _criar(client, vendedor, corpo_animal(**{campo: valor}))
    assert r.status_code == 422 and campo in _campos(r)


def test_uf_invalida_retorna_422(client, vendedor):
    r = _criar(client, vendedor, corpo_animal(uf="XX"))
    assert r.status_code == 422 and "uf" in _campos(r)


def test_raca_fora_da_lista_e_recusada(client, vendedor):
    r = _criar(client, vendedor, corpo_animal(raca="DRAGAO"))
    assert r.status_code == 422 and "raca" in _campos(r)


def test_raca_outra_exige_nome_personalizado(client, vendedor):
    sem = _criar(client, vendedor, corpo_animal(raca="OUTRA"))
    com = _criar(client, vendedor, corpo_animal(raca="OUTRA", racaPersonalizada="Curraleiro"))

    assert sem.status_code == 422 and "racaPersonalizada" in _campos(sem)
    assert com.status_code == 201 and com.json()["racaPersonalizada"] == "Curraleiro"


def test_preco_por_cabeca_precisa_bater_com_o_total(client, vendedor):
    errado = _criar(client, vendedor, corpo_animal(pricingMode="PER_HEAD", precoPorCabeca=4000))
    certo = _criar(client, vendedor, corpo_animal(pricingMode="PER_HEAD", precoPorCabeca=5000))

    assert errado.status_code == 422 and "precoPorCabeca" in _campos(errado)
    assert certo.status_code == 201 and certo.json()["pricingMode"] == "PER_HEAD"


def test_fotos_e_video_nao_vao_no_cadastro(client, vendedor):
    r = _criar(client, vendedor, corpo_animal(fotos=["a.jpg"]))
    assert r.status_code == 422 and "fotos" in _campos(r)
    r = _criar(client, vendedor, corpo_animal(video={"tipo": "LINK"}))
    assert r.status_code == 422 and "video" in _campos(r)


def test_dados_de_graos_nao_valem_em_animal(client, vendedor):
    r = _criar(client, vendedor, corpo_animal(cultura="SOJA"))
    assert r.status_code == 201 and "cultura" not in r.json()


# ---------------------------------------------------------------- graos e cafe

def test_vendedor_cria_lote_de_soja(client, vendedor):
    r = _criar(client, vendedor, corpo_graos())

    assert r.status_code == 201, r.text
    a = r.json()
    assert a["categoria"] == "GRAOS" and a["cultura"] == "SOJA"
    assert a["produto"]["nome"] == "Soja em grao"
    assert a["quantidadeSacas"] == 1000 and a["precoPorSaca"] == 130
    assert a["pesoTotalToneladas"] == 60
    assert a["laudoTecnico"] == {}


@pytest.mark.parametrize("cultura,subtipo,produto", [
    ("MILHO", "COMERCIAL_RACAO", "Milho em grao"),
    ("TRIGO", "PAO_TIPO1", "Trigo em grao"),
    ("CAFE", "ARABICA_TIPO6_DURA", "Cafe arabica"),
    ("CAFE", "CONILON_ROBUSTA", "Cafe conilon"),
])
def test_produto_e_escolhido_pela_cultura(client, vendedor, cultura, subtipo, produto):
    laudo = {}
    if cultura == "CAFE":
        laudo = {"cafePeneira": "17_18_ACIMA", "cafeCatacaoDefeitos": "5 defeitos", "cafePontuacaoSca": 82}
    if cultura == "TRIGO":
        laudo = {"trigoPhKgHl": 78}
    r = _criar(client, vendedor, corpo_graos(cultura=cultura, subtipo=subtipo, laudoTecnico=laudo))

    assert r.status_code == 201, r.text
    assert r.json()["produto"]["nome"] == produto


def test_outro_grao_exige_cultura_personalizada(client, vendedor):
    base = corpo_graos(cultura="OUTRO", subtipo="OUTRO")
    sem = _criar(client, vendedor, base)
    com = _criar(client, vendedor, {**base, "culturaPersonalizada": "Sorgo"})

    assert sem.status_code == 422 and "culturaPersonalizada" in _campos(sem)
    assert com.status_code == 201 and com.json()["produto"]["nome"] == "Outro grao"


def test_campos_obrigatorios_dos_graos(client, vendedor):
    r = _criar(client, vendedor, {"categoria": "GRAOS"})
    assert r.status_code == 422
    assert {"cultura", "subtipo", "titulo", "safra", "embalagem", "umidadePercentual",
            "quantidadeSacas", "cidade", "uf", "pricingMode", "precoTotal"} <= set(_campos(r))


def test_subtipo_precisa_ser_da_cultura(client, vendedor):
    r = _criar(client, vendedor, corpo_graos(subtipo="PAO_TIPO1"))
    assert r.status_code == 422 and "subtipo" in _campos(r)


@pytest.mark.parametrize("safra", ["2025", "2025/2027", "25/26", "abc"])
def test_safra_invalida(client, vendedor, safra):
    r = _criar(client, vendedor, corpo_graos(safra=safra))
    assert r.status_code == 422 and "safra" in _campos(r)


@pytest.mark.parametrize("campo,valor", [
    ("quantidadeSacas", 0), ("umidadePercentual", 0), ("umidadePercentual", 51),
    ("embalagem", "CAIXA"), ("cultura", "ARROZ"),
])
def test_valores_invalidos_dos_graos(client, vendedor, campo, valor):
    r = _criar(client, vendedor, corpo_graos(**{campo: valor}))
    assert r.status_code == 422 and campo in _campos(r)


def test_peso_em_toneladas_enviado_precisa_bater(client, vendedor):
    errado = _criar(client, vendedor, corpo_graos(pesoTotalToneladas=10))
    certo = _criar(client, vendedor, corpo_graos(pesoTotalToneladas=60))

    assert errado.status_code == 422 and "pesoTotalToneladas" in _campos(errado)
    assert certo.status_code == 201


def test_preco_por_saca_precisa_bater_com_o_total(client, vendedor):
    errado = _criar(client, vendedor, corpo_graos(pricingMode="PER_SACK", precoPorSaca=100))
    certo = _criar(client, vendedor, corpo_graos(pricingMode="PER_SACK", precoPorSaca=130))

    assert errado.status_code == 422 and "precoPorSaca" in _campos(errado)
    assert certo.status_code == 201


def test_cafe_exige_peneira_no_laudo(client, vendedor):
    corpo = corpo_graos(cultura="CAFE", subtipo="ARABICA_TIPO6_DURA")
    sem = _criar(client, vendedor, corpo)
    ruim = _criar(client, vendedor, {**corpo, "laudoTecnico": {"cafePeneira": "99"}})

    assert sem.status_code == 422 and "laudoTecnico.cafePeneira" in _campos(sem)
    assert ruim.status_code == 422 and "laudoTecnico.cafePeneira" in _campos(ruim)


def test_laudo_com_valor_fora_da_faixa_ou_campo_desconhecido(client, vendedor):
    fora = _criar(client, vendedor, corpo_graos(laudoTecnico={"sojaProteinaPercentual": 150}))
    desconhecido = _criar(client, vendedor, corpo_graos(laudoTecnico={"xyz": 1}))

    assert fora.status_code == 422 and desconhecido.status_code == 422
    assert "laudoTecnico.xyz" in _campos(desconhecido)


def test_laudo_valido_fica_salvo(client, vendedor):
    laudo = {"cafePeneira": "17_18_ACIMA", "cafeCatacaoDefeitos": "5 defeitos", "cafePontuacaoSca": 82.5}
    a = _criar(client, vendedor, corpo_graos(cultura="CAFE", subtipo="ARABICA_MOLE_ESPECIAL",
                                             laudoTecnico=laudo)).json()
    assert a["laudoTecnico"] == laudo
