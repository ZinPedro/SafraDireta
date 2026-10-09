
from app.validators import (
    normalizar_cnpj,
    normalizar_cpf,
    normalizar_cep,
    normalizar_uf,
    validar_cpf,
    validar_cnpj,
    validar_cep,
    validar_uf,
    transicao_verificacao_permitida,
)


def test_cpf():
    assert validar_cpf("529.982.247-25")
    assert not validar_cpf("111.111.111-11")
    assert not validar_cpf("529.982.247-26")
    assert not validar_cpf("123")
    assert normalizar_cpf("529.982.247-25") == "52998224725"


def test_cnpj_numerico():
    assert validar_cnpj("11.222.333/0001-81")
    assert not validar_cnpj("11.222.333/0001-82")
    assert not validar_cnpj("00.000.000/0000-00")


def test_cnpj_alfanumerico():
    base = "12ABC34501DE"

    from app.validators import _digito_cnpj

    primeiro = _digito_cnpj(
        base,
        (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
    )

    segundo = _digito_cnpj(
        base + primeiro,
        (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
    )

    assert validar_cnpj(base + primeiro + segundo)
    assert normalizar_cnpj("12abc345/01de") == base


def test_cep_uf():
    assert validar_cep("13000-000")
    assert not validar_cep("1300")
    assert normalizar_cep("13000-000") == "13000000"

    assert validar_uf(" sp ")
    assert not validar_uf("XX")
    assert normalizar_uf(" sp ") == "SP"


def test_transicoes():
    assert transicao_verificacao_permitida("RASCUNHO", "ENVIADA")
    assert transicao_verificacao_permitida("ENVIADA", "EM_ANALISE")
    assert transicao_verificacao_permitida("EM_ANALISE", "APROVADA")

    assert not transicao_verificacao_permitida("RASCUNHO", "APROVADA")
    assert not transicao_verificacao_permitida("APROVADA", "ENVIADA")
    assert not transicao_verificacao_permitida("INVALIDO", "ENVIADA")
