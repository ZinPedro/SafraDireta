def test_termo_vigente_e_publico_e_tem_o_formato_do_contrato(client):
    r = client.get("/api/termos/vigente")  # sem token de proposito: a rota e publica
    assert r.status_code == 200
    dados = r.json()
    assert set(dados) == {"versao", "referenciaConteudo", "vigenteDesde"}
    assert dados["versao"]


def test_rota_de_api_inexistente_retorna_404_padrao(client):
    r = client.get("/api/nao-existe")
    assert r.status_code == 404
    assert r.json()["erro"]["codigo"] == "NAO_ENCONTRADO"
