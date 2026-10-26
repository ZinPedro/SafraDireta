
import pytest


def test_pausar_anuncio_ativo(client, criar_vendedor, criar_anuncio):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/pausar",
        headers=vendedor["headers"],
    )

    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["estadoComercial"] == "PAUSADO"


def test_reativar_anuncio_pausado(client, criar_vendedor, criar_anuncio):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/pausar",
        headers=vendedor["headers"],
    )

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/reativar",
        headers=vendedor["headers"],
    )

    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["estadoComercial"] == "ATIVO"


def test_nao_pausar_duas_vezes(client, criar_vendedor, criar_anuncio):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)
    url = f"/api/vendedor/anuncios/{anuncio['id']}/pausar"

    primeira = client.post(url, headers=vendedor["headers"])
    segunda = client.post(url, headers=vendedor["headers"])

    assert primeira.status_code == 200
    assert segunda.status_code == 409


def test_nao_reativar_anuncio_ativo(client, criar_vendedor, criar_anuncio):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/reativar",
        headers=vendedor["headers"],
    )

    assert resposta.status_code == 409


def test_outro_vendedor_nao_pode_pausar(
    client, criar_vendedor, criar_anuncio
):
    dono = criar_vendedor()
    outro = criar_vendedor()
    anuncio = criar_anuncio(dono)

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/pausar",
        headers=outro["headers"],
    )

    assert resposta.status_code == 403


def test_pausar_sem_token_retorna_401(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/pausar"
    )

    assert resposta.status_code == 401


def test_anuncio_inexistente_retorna_404(client, criar_vendedor):
    vendedor = criar_vendedor()

    resposta = client.post(
        "/api/vendedor/anuncios/00000000-0000-4000-8000-000000000000/pausar",
        headers=vendedor["headers"],
    )

    assert resposta.status_code == 404

def test_estado_e_versao_persistidos(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)
    url = f"/api/vendedor/anuncios/{anuncio['id']}"

    antes = client.get(url, headers=vendedor["headers"])
    assert antes.status_code == 200

    resposta = client.post(
        f"{url}/pausar",
        headers=vendedor["headers"],
    )
    assert resposta.status_code == 200

    depois = client.get(url, headers=vendedor["headers"])
    assert depois.status_code == 200
    assert depois.json()["estadoComercial"] == "PAUSADO"
    assert depois.json()["versao"] == antes.json()["versao"] + 1


def test_reativar_duas_vezes_retorna_409(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)
    url = f"/api/vendedor/anuncios/{anuncio['id']}"

    assert client.post(
        f"{url}/pausar", headers=vendedor["headers"]
    ).status_code == 200

    primeira = client.post(
        f"{url}/reativar", headers=vendedor["headers"]
    )
    segunda = client.post(
        f"{url}/reativar", headers=vendedor["headers"]
    )

    assert primeira.status_code == 200
    assert segunda.status_code == 409
def test_auditoria_ao_pausar(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/pausar",
        headers=vendedor["headers"],
    )

    assert resposta.status_code == 200, resposta.text

    evento = client.db.execute(
        """
        SELECT acao, resumo
        FROM safradireta.evento_auditoria
        WHERE entidade = 'anuncio'
          AND entidade_id = %s
          AND acao = 'ANUNCIO_PAUSADO'
        LIMIT 1
        """,
        (anuncio["id"],),
    ).fetchone()

    assert evento is not None
    assert evento["acao"] == "ANUNCIO_PAUSADO"
    assert evento["resumo"]["estadoAnterior"] == "ATIVO"
    assert evento["resumo"]["estadoNovo"] == "PAUSADO"


def test_anuncio_vendido_nao_pode_pausar_nem_reativar(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    client.db.execute(
    """
    UPDATE safradireta.anuncio
    SET estado_comercial = 'VENDIDO',
        vendido_em = now(),
        origem_encerramento = 'MANUAL'
    WHERE id = %s
    """,
    (anuncio["id"],),
    )

    url = f"/api/vendedor/anuncios/{anuncio['id']}"

    pausar = client.post(
        f"{url}/pausar",
        headers=vendedor["headers"],
    )

    reativar = client.post(
        f"{url}/reativar",
        headers=vendedor["headers"],
    )

    assert pausar.status_code == 409
    assert reativar.status_code == 409

    estado = client.db.execute(
        """
        SELECT estado_comercial
        FROM safradireta.anuncio
        WHERE id = %s
        """,
        (anuncio["id"],),
    ).fetchone()

    assert estado["estado_comercial"] == "VENDIDO"
