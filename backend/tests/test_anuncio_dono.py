"""Dependencia anuncio_do_dono: so o dono do anuncio passa (base das US012, US014 e US015)."""
from uuid import UUID

import pytest

from app.deps import anuncio_do_dono
from app.errors import ErroApp


def _atual(conta_id):
    """Simula o que a autenticacao entrega: o conta_id como UUID."""
    return {"conta_id": UUID(str(conta_id))}


@pytest.fixture()
def anuncio(client, criar_vendedor, criar_anuncio):
    dono = criar_vendedor()
    criado = criar_anuncio(dono)
    return {"id": criado["id"], "dono_id": dono["id"]}


def test_dono_recebe_o_anuncio(client, anuncio):
    linha = anuncio_do_dono(anuncio_id=anuncio["id"], atual=_atual(anuncio["dono_id"]), conn=client.db)

    assert str(linha["id"]) == anuncio["id"]
    assert linha["estado_comercial"] == "ATIVO"


def test_outro_vendedor_recebe_403(client, anuncio, criar_vendedor):
    outro = criar_vendedor()

    with pytest.raises(ErroApp) as erro:
        anuncio_do_dono(anuncio_id=anuncio["id"], atual=_atual(outro["id"]), conn=client.db)

    assert erro.value.status == 403


def test_anuncio_inexistente_recebe_404(client, anuncio):
    with pytest.raises(ErroApp) as erro:
        anuncio_do_dono(
            anuncio_id="00000000-0000-0000-0000-000000000000",
            atual=_atual(anuncio["dono_id"]), conn=client.db,
        )

    assert erro.value.status == 404
