import pytest
import subprocess

from io import BytesIO
from PIL import Image

def criar_png_teste() -> bytes:
    """Cria uma imagem PNG válida para os testes."""
    imagem = Image.new("RGB", (10, 10), "green")

    buffer = BytesIO()
    imagem.save(buffer, format="PNG")

    return buffer.getvalue()

def criar_mp4_teste(tmp_path) -> bytes:
    """Cria um vídeo MP4 real, de um segundo, usando FFmpeg."""

    caminho = tmp_path / "video_teste.mp4"

    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f", "lavfi",
            "-i", "color=c=blue:s=160x120:r=10",
            "-t", "1",
            "-c:v", "mpeg4",
            "-pix_fmt", "yuv420p",
            str(caminho),
        ],
        check=True,
        capture_output=True,
        timeout=15,
    )

    return caminho.read_bytes()


@pytest.fixture(autouse=True)
def uploads_temporarios(tmp_path, monkeypatch):
    """Usa uma pasta temporária isolada em cada teste."""
    from app.config import get_settings

    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    get_settings.cache_clear()

    yield

    get_settings.cache_clear()

def test_adicionar_primeira_foto(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    # Arquivo PNG mínimo usado para testar o upload.
    conteudo = criar_png_teste()


    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/midias",
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "bois.png",
                conteudo,
                "image/png",
            )
        },
    )

    assert resposta.status_code == 201, resposta.text

    midia = resposta.json()

    assert midia["tipo"] == "FOTO"
    assert midia["ordem"] == 0
    assert midia["capa"] is True

    registro = client.db.execute(
        """
        SELECT m.id, a.nome_original, a.mime_type
        FROM safradireta.midia_anuncio m
        JOIN safradireta.arquivo a
          ON a.id = m.arquivo_id
        WHERE m.id = %s
        """,
        (midia["id"],),
    ).fetchone()

    assert registro is not None
    assert registro["nome_original"] == "bois.png"
    assert registro["mime_type"] == "image/png"


def test_outro_vendedor_nao_pode_adicionar_foto(
    client, criar_vendedor, criar_anuncio
):
    dono = criar_vendedor()
    outro = criar_vendedor()
    anuncio = criar_anuncio(dono)

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/midias",
        headers=outro["headers"],
        files={
            "arquivo": (
                "bois.png",
                criar_png_teste(),
                "image/png",
            )
        },
    )

    assert resposta.status_code == 403


def test_upload_sem_autenticacao(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/midias",
        files={
            "arquivo": (
                "bois.png",
                criar_png_teste(),
                "image/png",
            )
        },
    )

    assert resposta.status_code == 401


def test_upload_em_anuncio_inexistente(
    client, criar_vendedor
):
    vendedor = criar_vendedor()

    resposta = client.post(
        "/api/vendedor/anuncios/"
        "00000000-0000-4000-8000-000000000000/midias",
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "bois.png",
                criar_png_teste(),
                "image/png",
            )
        },
    )

    assert resposta.status_code == 404


def test_limite_de_seis_fotos(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    url = f"/api/vendedor/anuncios/{anuncio['id']}/midias"
    conteudo = criar_png_teste()

    # Envia seis fotos permitidas.
    for numero in range(6):
        resposta = client.post(
            url,
            headers=vendedor["headers"],
            files={
                "arquivo": (
                    f"foto_{numero}.png",
                    conteudo,
                    "image/png",
                )
            },
        )

        assert resposta.status_code == 201, resposta.text
        assert resposta.json()["ordem"] == numero

        # Apenas a primeira foto deve ser capa.
        assert resposta.json()["capa"] is (numero == 0)

    # Tenta enviar uma sétima foto.
    resposta = client.post(
        url,
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "foto_7.png",
                conteudo,
                "image/png",
            )
        },
    )

    assert resposta.status_code == 409

    # Confirma que somente seis mídias foram cadastradas.
    total = client.db.execute(
        """
        SELECT COUNT(*) AS total
        FROM safradireta.midia_anuncio
        WHERE anuncio_id = %s
          AND tipo = 'FOTO'
        """,
        (anuncio["id"],),
    ).fetchone()

    assert total["total"] == 6


def test_limite_de_um_video(
    client, criar_vendedor, criar_anuncio, tmp_path
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    url = f"/api/vendedor/anuncios/{anuncio['id']}/midias"

    # Assinatura inicial de um arquivo MP4 para teste.
    conteudo = criar_mp4_teste(tmp_path)


    primeiro = client.post(
        url,
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "video1.mp4",
                conteudo,
                "video/mp4",
            )
        },
    )

    assert primeiro.status_code == 201, primeiro.text
    assert primeiro.json()["tipo"] == "VIDEO"
    assert primeiro.json()["capa"] is False

    segundo = client.post(
        url,
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "video2.mp4",
                conteudo,
                "video/mp4",
            )
        },
    )

    assert segundo.status_code == 409

    total = client.db.execute(
        """
        SELECT COUNT(*) AS total
        FROM safradireta.midia_anuncio
        WHERE anuncio_id = %s
          AND tipo = 'VIDEO'
        """,
        (anuncio["id"],),
    ).fetchone()

    assert total["total"] == 1


def test_rejeitar_arquivo_invalido(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/midias",
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "documento.txt",
                b"Este arquivo nao e uma imagem nem um video.",
                "text/plain",
            )
        },
    )

    assert resposta.status_code == 422, resposta.text


def test_rejeitar_arquivo_vazio(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/midias",
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "foto.png",
                b"",
                "image/png",
            )
        },
    )

    assert resposta.status_code == 422, resposta.text


def test_rejeitar_foto_maior_que_10mb(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    conteudo = (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00" * (10 * 1024 * 1024)
    )

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/midias",
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "foto_grande.png",
                conteudo,
                "image/png",
            )
        },
    )

    assert resposta.status_code == 422, resposta.text


def test_rejeitar_video_maior_que_30mb(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    conteudo = (
        b"\x00\x00\x00\x18ftypisom"
        + b"\x00" * (30 * 1024 * 1024)
    )

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/midias",
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "video_grande.mp4",
                conteudo,
                "video/mp4",
            )
        },
    )

    assert resposta.status_code == 422, resposta.text


def test_rejeitar_imagem_corrompida(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    # Tem a assinatura PNG, mas não é uma imagem válida.
    conteudo = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/midias",
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "foto_corrompida.png",
                conteudo,
                "image/png",
            )
        },
    )

    assert resposta.status_code == 422, resposta.text

    # Confirma que nenhum registro foi criado.
    total = client.db.execute(
        """
        SELECT COUNT(*) AS total
        FROM safradireta.midia_anuncio
        WHERE anuncio_id = %s
        """,
        (anuncio["id"],),
    ).fetchone()

    assert total["total"] == 0


def test_rejeitar_video_corrompido(
    client, criar_vendedor, criar_anuncio
):
    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    # Possui assinatura MP4, mas não contém um vídeo verdadeiro.
    conteudo = (
        b"\x00\x00\x00\x18ftypisom"
        + b"\x00" * 12
    )

    resposta = client.post(
        f"/api/vendedor/anuncios/{anuncio['id']}/midias",
        headers=vendedor["headers"],
        files={
            "arquivo": (
                "video_corrompido.mp4",
                conteudo,
                "video/mp4",
            )
        },
    )

    assert resposta.status_code == 422, resposta.text

    # Nenhum vídeo inválido deve ser cadastrado no banco.
    total = client.db.execute(
        """
        SELECT COUNT(*) AS total
        FROM safradireta.midia_anuncio
        WHERE anuncio_id = %s
          AND tipo = 'VIDEO'
        """,
        (anuncio["id"],),
    ).fetchone()

    assert total["total"] == 0


def test_remove_arquivo_quando_banco_falha(
    client, criar_vendedor, criar_anuncio, tmp_path, monkeypatch
):
    from app.services import midia_service

    vendedor = criar_vendedor()
    anuncio = criar_anuncio(vendedor)

    def simular_falha(*args, **kwargs):
        raise RuntimeError("Falha simulada no cadastro")

    # Simula uma falha depois de salvar o arquivo físico.
    def salvar_e_falhar(conteudo, mime_type):
        chave, caminho = salvar_original(conteudo, mime_type)
        arquivos_criados.append(caminho)
        return chave, caminho

    salvar_original = midia_service.salvar_arquivo
    arquivos_criados = []

    # A conexão falhará ao tentar registrar o arquivo.
    execute_original = client.db.execute

    def executar_com_falha(query, params=None, **kwargs):
        if "INSERT INTO safradireta.arquivo" in query:
            raise RuntimeError("Falha simulada no banco")
        return execute_original(query, params, **kwargs)

    monkeypatch.setattr(
        midia_service,
        "salvar_arquivo",
        salvar_e_falhar,
    )
    monkeypatch.setattr(
        client.db,
        "execute",
        executar_com_falha,
    )

    import pytest

    with pytest.raises(RuntimeError, match="Falha simulada"):
        midia_service.cadastrar_midia(
            conn=client.db,
            anuncio=client.db.execute(
                """
                SELECT id, estado_comercial
                FROM safradireta.anuncio
                WHERE id = %s
                """,
                (anuncio["id"],),
            ).fetchone(),
            atual={"conta_id": vendedor["id"]},
            conteudo=criar_png_teste(),
            nome_original="bois.png",
        )

    assert arquivos_criados
    assert not arquivos_criados[0].exists()
