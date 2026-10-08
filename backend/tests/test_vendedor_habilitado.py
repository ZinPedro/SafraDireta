
from unittest.mock import MagicMock

import pytest

from app.deps import vendedor_habilitado
from app.errors import ErroApp


def criar_conexao(estado):
    conn = MagicMock()
    conn.execute.return_value.fetchone.return_value = (
        {"estado": estado} if estado is not None else None
    )
    return conn


def test_vendedor_pendente_nao_pode_acessar():
    atual = {"conta_id": "conta-teste", "tipo": "PJ"}
    conn = criar_conexao("PENDENTE")

    with pytest.raises(ErroApp) as erro:
        vendedor_habilitado(atual=atual, conn=conn)

    assert erro.value.status == 403
    assert erro.value.codigo == "PROIBIDO"


def test_vendedor_sem_habilitacao_nao_pode_acessar():
    atual = {"conta_id": "conta-teste", "tipo": "PJ"}
    conn = criar_conexao(None)

    with pytest.raises(ErroApp) as erro:
        vendedor_habilitado(atual=atual, conn=conn)

    assert erro.value.status == 403
    assert erro.value.codigo == "PROIBIDO"


def test_vendedor_habilitado_pode_acessar():
    atual = {"conta_id": "conta-teste", "tipo": "PJ"}
    conn = criar_conexao("HABILITADO")

    resultado = vendedor_habilitado(atual=atual, conn=conn)

    assert resultado == atual


def test_conta_com_tipo_invalido_nao_pode_acessar():
    atual = {"conta_id": "conta-teste", "tipo": "INVALIDO"}
    conn = criar_conexao("HABILITADO")

    with pytest.raises(ErroApp) as erro:
        vendedor_habilitado(atual=atual, conn=conn)

    assert erro.value.status == 403
    assert erro.value.codigo == "PROIBIDO"
    conn.execute.assert_not_called()
