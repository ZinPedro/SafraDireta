"""Anuncios do vendedor (US010: lote de animais), com banco real."""
import pytest


@pytest.fixture()
def vendedor(criar_vendedor):
    return criar_vendedor()


def _produto(client, nome):
    return client.db.execute(
        "SELECT id FROM safradireta.produto WHERE nome = %s", (nome,)
    ).fetchone()["id"]


def _corpo(client, **extra):
    corpo = {
        "produtoId": str(_produto(client, "Boi gordo")),
        "titulo": "Lote de 30 bois nelore",
        "precoLote": 150000.50,
        "loteAnimal": {"quantidadeAnimais": 30, "raca": "Nelore"},
    }
    corpo.update(extra)
    return corpo


def _criar(client, headers, corpo):
    return client.post("/api/vendedor/anuncios", headers=headers, json=corpo)


def test_vendedor_cria_lote_de_animais_ja_disponivel(client, vendedor):
    r = _criar(client, vendedor["headers"], _corpo(client, pesoTotalKg=13500, descricao="Gado manso"))

    assert r.status_code == 201, r.text
    a = r.json()
    assert a["estadoComercial"] == "ATIVO"
    assert a["publicadoEm"] is not None
    assert a["precoLote"] == 150000.5
    assert a["pesoTotalKg"] == 13500
    assert a["produto"]["nome"] == "Boi gordo"
    assert a["categoria"]["grupo"] == "ANIMAIS"
    assert a["loteAnimal"]["quantidadeAnimais"] == 30
    assert a["loteAnimal"]["raca"] == "Nelore"
    assert a["midias"] == []


def test_anuncio_fica_ligado_ao_vendedor_que_criou(client, vendedor):
    a = _criar(client, vendedor["headers"], _corpo(client)).json()

    assert a["vendedorId"] == vendedor["id"]
    linha = client.db.execute(
        "SELECT vendedor_id FROM safradireta.anuncio WHERE id = %s", (a["id"],)
    ).fetchone()
    assert str(linha["vendedor_id"]) == vendedor["id"]


def test_vendedor_nao_consegue_criar_em_nome_de_outro(client, vendedor):
    """O dono vem sempre do token; um vendedorId enviado no corpo e ignorado."""
    a = _criar(client, vendedor["headers"], _corpo(client, vendedorId="00000000-0000-0000-0000-000000000000")).json()
    assert a["vendedorId"] == vendedor["id"]


def test_conta_sem_habilitacao_nao_cria_anuncio(client, criar_pf):
    pf = criar_pf()
    r = _criar(client, pf["headers"], _corpo(client))

    assert r.status_code == 403
    assert r.json()["erro"]["codigo"] == "PROIBIDO"


def test_sem_token_retorna_401(client):
    assert client.post("/api/vendedor/anuncios", json=_corpo(client)).status_code == 401


def test_campos_obrigatorios_faltando_retorna_422(client, vendedor):
    r = _criar(client, vendedor["headers"], {})

    assert r.status_code == 422
    assert {"produtoId", "titulo", "precoLote"} <= set(r.json()["erro"]["campos"])


def test_lote_de_animais_e_obrigatorio_para_boi(client, vendedor):
    corpo = _corpo(client)
    del corpo["loteAnimal"]
    r = _criar(client, vendedor["headers"], corpo)

    assert r.status_code == 422
    assert "loteAnimal" in r.json()["erro"]["campos"]


def test_quantidade_de_animais_obrigatoria_e_positiva(client, vendedor):
    sem = _criar(client, vendedor["headers"], _corpo(client, loteAnimal={"raca": "Nelore"}))
    zero = _criar(client, vendedor["headers"], _corpo(client, loteAnimal={"quantidadeAnimais": 0}))

    assert sem.status_code == zero.status_code == 422
    assert "loteAnimal.quantidadeAnimais" in sem.json()["erro"]["campos"]
    assert "loteAnimal.quantidadeAnimais" in zero.json()["erro"]["campos"]


@pytest.mark.parametrize("preco", [0, -10, 100.123])
def test_preco_invalido_retorna_422(client, vendedor, preco):
    r = _criar(client, vendedor["headers"], _corpo(client, precoLote=preco))

    assert r.status_code == 422
    assert "precoLote" in r.json()["erro"]["campos"]


def test_titulo_em_branco_retorna_422(client, vendedor):
    r = _criar(client, vendedor["headers"], _corpo(client, titulo="   "))

    assert r.status_code == 422
    assert "titulo" in r.json()["erro"]["campos"]


def test_produto_inexistente_retorna_422(client, vendedor):
    r = _criar(client, vendedor["headers"], _corpo(client, produtoId="00000000-0000-0000-0000-000000000000"))

    assert r.status_code == 422
    assert "produtoId" in r.json()["erro"]["campos"]


def test_graos_e_cafe_ainda_nao_aceitam_cadastro(client, vendedor):
    """Entram na US011; ate la a API recusa com mensagem clara."""
    r = _criar(client, vendedor["headers"], _corpo(client, produtoId=str(_produto(client, "Soja em grao"))))

    assert r.status_code == 422
    assert "produtoId" in r.json()["erro"]["campos"]
