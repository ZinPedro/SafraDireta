"""Erros de validacao do cadastro PJ saem com chaves planas, como o formulario espera."""


def _corpo_invalido():
    return {
        "company": {"cnpj": "123", "razaoSocial": "Coop Teste"},
        "address": {"cep": "1", "logradouro": "Rua A", "numero": "1", "bairro": "Centro", "cidade": "Campinas", "uf": "SP"},
        "representative": {"nome": "Joao Souza", "cpf": "111", "vinculo": "Diretor"},
        "documents": {"hasCompanyDoc": False, "hasRepresentativeDoc": False, "fileNames": []},
        "access": {"email": "x", "telefone": "1", "senha": "senhaForte123", "acceptedTerms": False},
    }


def test_erros_do_pj_vem_com_chaves_planas(client):
    r = client.post("/api/auth/register-corporate", json=_corpo_invalido())
    assert r.status_code == 422
    campos = r.json()["erro"]["campos"]
    for chave in ("cnpj", "cep", "repCpf", "companyDoc", "representativeDoc", "email", "telefone", "acceptedTerms"):
        assert chave in campos, chave
    assert not any("." in chave for chave in campos)
