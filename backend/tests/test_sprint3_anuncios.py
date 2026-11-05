from io import BytesIO
from hashlib import sha256

import pytest
from PIL import Image

from conftest import corpo_animal


@pytest.mark.parametrize("status", ["VENDIDO", "CANCELADO"])
def test_encerramento_revoga_documentos_e_preserva_favorito(
    client, criar_vendedor, criar_pf, criar_anuncio, monkeypatch, tmp_path, status,
):
    from app.services import midia_service

    monkeypatch.setattr(midia_service, "pasta_uploads", lambda: tmp_path)
    vendedor = criar_vendedor()["headers"]
    comprador = criar_pf()["headers"]
    terceiro = criar_pf()["headers"]
    anuncio = criar_anuncio({"headers": vendedor}, regiaoAproximada="Polo de Campinas")
    rota = f'/api/anuncios/{anuncio["id"]}'
    documentos = f"{rota}/documentos"

    imagem = BytesIO()
    Image.new("RGB", (4, 4)).save(imagem, "PNG")
    upload = client.post(documentos, headers=vendedor, data={"tipo": "GTA"},
                         files={"arquivo": ("gta.png", imagem.getvalue(), "image/png")})
    assert upload.status_code == 201, upload.text
    visualizacao = f'/api/documentos/{upload.json()["id"]}/visualizar'
    assert client.get(visualizacao, headers=comprador).status_code == 403
    metadados = client.get(documentos, headers=comprador).json()["documentos"]
    assert metadados[0]["mimeType"] == "image/png"
    assert "chave_storage" not in metadados[0]

    pedido = client.post(f"{documentos}/solicitar", headers=comprador, json={"mensagem": "Interesse no lote"})
    assert pedido.status_code == 201, pedido.text
    decisao = f'/api/documentos/solicitacoes/{pedido.json()["id"]}'
    assert client.patch(decisao, headers=terceiro, json={"status": "APROVADO"}).status_code == 403
    assert client.patch(decisao, headers=vendedor, json={"status": "APROVADO"}).status_code == 200
    assert client.get(visualizacao, headers=terceiro).status_code == 403
    assert client.get(visualizacao, headers=comprador).content == imagem.getvalue()

    for _ in range(2):
        assert client.post(f"{rota}/favoritar", headers=comprador).status_code == 204
    assert client.get("/api/favoritos", headers=terceiro).json()["total"] == 0
    payload = {"status": status, "motivo": "VENDA_EXTERNA", "observacoes": "Uso interno"}
    assert client.patch(f"{rota}/status", headers=terceiro, json=payload).status_code == 403
    encerrado = client.patch(f"{rota}/status", headers=vendedor, json=payload)
    assert encerrado.status_code == 200, encerrado.text
    assert encerrado.json()["encerradoEm"]
    auditoria = client.db.execute(
        """SELECT resumo FROM safradireta.evento_auditoria
           WHERE entidade_id = %s AND acao = 'ANUNCIO_ENCERRADO'""",
        (anuncio["id"],),
    ).fetchone()
    assert auditoria["resumo"]["motivo"] == "VENDA_EXTERNA"
    assert client.get(rota).status_code == 404
    assert client.get(visualizacao, headers=comprador).status_code == 403
    assert client.get(visualizacao, headers=vendedor).status_code == 200
    assert client.get(documentos, headers=vendedor).json()["solicitacoes"][0]["status"] == "REVOGADO"
    assert client.patch(
        f'/api/vendedor/anuncios/{anuncio["id"]}', headers=vendedor, json={"titulo": "Outro título"},
    ).status_code == 409

    favoritos = client.get("/api/favoritos?itens_por_pagina=1", headers=comprador).json()
    assert favoritos["total"] == 1
    assert favoritos["itens"][0]["estadoComercial"] == status
    assert favoritos["itens"][0]["disponivel"] is False
    for _ in range(2):
        assert client.delete(f"{rota}/favoritar", headers=comprador).status_code == 204

    clone = client.get(f"{rota}/clonar", headers=vendedor).json()
    assert clone["regiaoAproximada"] == "Polo de Campinas"
    assert clone["raca"] == anuncio["raca"]
    assert clone["documentos"] == clone["midias"] == clone["fotos"] == []
    assert clone["video"] is None
    assert "id" not in clone and "estadoComercial" not in clone
    novo = client.post("/api/vendedor/anuncios", headers=vendedor, json=clone)
    assert novo.status_code == 201, novo.text


def test_localizacao_do_lote_no_catalogo(client, criar_vendedor):
    vendedor = criar_vendedor()
    corpo = corpo_animal(uf="pr", regiaoAproximada="Polo portuário")
    corpo.pop("cidade")
    corpo["municipio"] = "Paranaguá"
    rota = "/api/vendedor/anuncios"
    invalido = client.post(rota, headers=vendedor["headers"], json={**corpo, "uf": "SP"})
    assert invalido.status_code == 422

    criado = client.post(rota, headers=vendedor["headers"], json=corpo)
    assert criado.status_code == 201, criado.text
    anuncio_id = criado.json()["id"]
    publico = client.get(f"/api/anuncios/{anuncio_id}").json()
    assert (publico["municipio"], publico["uf"], publico["regiaoAproximada"]) == (
        "Paranaguá", "PR", "Polo portuário",
    )
    assert {"endereco", "latitude", "longitude", "motivoEncerramento"}.isdisjoint(publico)

    atualizado = client.patch(
        f"{rota}/{anuncio_id}", headers=vendedor["headers"],
        json={"regiao_aproximada": "Litoral do Paraná"},
    )
    assert atualizado.status_code == 200, atualizado.text
    assert atualizado.json()["regiaoAproximada"] == "Litoral do Paraná"


def test_upload_documental_valida_conteudo_tamanho_e_dono(
    client, criar_vendedor, criar_anuncio, monkeypatch, tmp_path,
):
    from app.services import documento_service, midia_service

    monkeypatch.setattr(midia_service, "pasta_uploads", lambda: tmp_path)
    vendedor, terceiro = criar_vendedor(), criar_vendedor()
    anuncio = criar_anuncio(vendedor)
    rota = f'/api/anuncios/{anuncio["id"]}/documentos'
    pdf = BytesIO()
    Image.new("RGB", (4, 4)).save(pdf, "PDF")
    conteudo = pdf.getvalue()

    def enviar(dados, conta=vendedor):
        return client.post(rota, headers=conta["headers"], data={"tipo": "EXAME_ANDROLOGICO"},
                           files={"arquivo": ("laudo.pdf", dados, "application/pdf")})

    assert enviar(conteudo, terceiro).status_code == 403
    assert enviar(b"<html>arquivo disfarce</html>").status_code == 422
    with monkeypatch.context() as limite:
        limite.setattr(documento_service, "MAX_TAMANHO", len(conteudo) - 1)
        assert enviar(conteudo).status_code == 422
    assert not list(tmp_path.iterdir())

    resposta = enviar(conteudo)
    assert resposta.status_code == 201, resposta.text
    assert resposta.json()["mimeType"] == "application/pdf"
    assert resposta.json()["tipo"] == "EXAME_ANDROLOGICO"
    dados = client.db.execute(
        """SELECT a.checksum, a.tamanho_bytes FROM safradireta.documento_anuncio d
           JOIN safradireta.arquivo a ON a.id = d.arquivo_id WHERE d.id = %s""",
        (resposta.json()["id"],),
    ).fetchone()
    assert dados == {"checksum": sha256(conteudo).hexdigest(), "tamanho_bytes": len(conteudo)}
