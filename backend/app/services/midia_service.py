import hashlib
import json
import shutil
import subprocess
import tempfile

"""Regras para fotos e videos dos anuncios."""

from io import BytesIO
from PIL import Image, UnidentifiedImageError
from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile
from psycopg import Connection

from app.config import get_settings
from app.errors import conflito, invalido


MAX_FOTOS = 6
MAX_VIDEOS = 1

MAX_TAMANHO_FOTO = 10 * 1024 * 1024
MAX_TAMANHO_VIDEO = 30 * 1024 * 1024

TIPOS_FOTO = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

TIPOS_VIDEO = {
    "video/mp4",
    "video/quicktime",
    "video/webm",
}


def pasta_uploads() -> Path:
    """Retorna a pasta configurada para armazenar arquivos."""
    return get_settings().upload_dir


def gerar_chave_storage() -> str:
    """Gera um identificador unico para o arquivo."""
    return uuid4().hex


def identificar_tipo(conteudo: bytes) -> tuple[str, str]:
    """Identifica o tipo do arquivo pela sua assinatura."""

    if conteudo.startswith(b"\xff\xd8\xff"):
        return "FOTO", "image/jpeg"

    if conteudo.startswith(b"\x89PNG\r\n\x1a\n"):
        return "FOTO", "image/png"

    if (
        conteudo.startswith(b"RIFF")
        and conteudo[8:12] == b"WEBP"
    ):
        return "FOTO", "image/webp"

    if len(conteudo) >= 12 and conteudo[4:8] == b"ftyp":
        marca = conteudo[8:12]

        if marca == b"qt  ":
            return "VIDEO", "video/quicktime"

        if marca in {
            b"isom", b"iso2", b"mp41", b"mp42",
            b"avc1", b"iso5", b"iso6",
        }:
            return "VIDEO", "video/mp4"

    if conteudo.startswith(b"\x1a\x45\xdf\xa3"):
        return "VIDEO", "video/webm"

    raise invalido(
        "Formato de arquivo não permitido."
    )

def validar_midia(
    conteudo: bytes,
) -> tuple[str, str]:
    """Valida o formato e o tamanho do arquivo."""

    if not conteudo:
        raise invalido("O arquivo está vazio.")

    tipo, mime_type = identificar_tipo(conteudo)

    limite = (
        MAX_TAMANHO_FOTO
        if tipo == "FOTO"
        else MAX_TAMANHO_VIDEO
    )

    if len(conteudo) > limite:
        raise invalido(
            f"Arquivo excede o limite de {limite // (1024 * 1024)} MB."
        )

    if tipo == "FOTO":
        validar_imagem_real(conteudo, mime_type)
    else:
        validar_video_real(conteudo)

    return tipo, mime_type


def salvar_arquivo(conteudo: bytes, mime_type: str) -> tuple[str, Path]:
    """Salva um arquivo localmente com nome unico."""

    extensoes = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/webm": ".webm",
    }

    extensao = extensoes[mime_type]
    chave = gerar_chave_storage()

    pasta = pasta_uploads()
    pasta.mkdir(parents=True, exist_ok=True)

    caminho = pasta / f"{chave}{extensao}"

    # O modo xb impede sobrescrever um arquivo existente.
    with caminho.open("xb") as arquivo:
        arquivo.write(conteudo)

    return caminho.name, caminho


def cadastrar_midia(
    conn: Connection,
    anuncio: dict,
    atual: dict,
    conteudo: bytes,
    nome_original: str,
) -> dict:
    """Salva a mídia e associa o arquivo ao anúncio."""

    tipo, mime_type = validar_midia(conteudo)

    if anuncio["estado_comercial"] == "VENDIDO":
        raise conflito("Não é possível adicionar mídia a um anúncio vendido.")

    chave = None
    caminho = None

    try:
        with conn.transaction():
            # Bloqueia o anúncio durante o cadastro para evitar
            # que dois uploads escolham a mesma ordem.
            estado = conn.execute(
                """
                SELECT estado_comercial
                FROM safradireta.anuncio
                WHERE id = %s
                FOR UPDATE
                """,
                (anuncio["id"],),
            ).fetchone()

            if estado["estado_comercial"] == "VENDIDO":
                raise conflito(
                    "Não é possível adicionar mídia a um anúncio vendido."
                )

            midias = conn.execute(
                """
                SELECT tipo, ordem, capa
                FROM safradireta.midia_anuncio
                WHERE anuncio_id = %s
                """,
                (anuncio["id"],),
            ).fetchall()

            total_fotos = sum(m["tipo"] == "FOTO" for m in midias)
            total_videos = sum(m["tipo"] == "VIDEO" for m in midias)

            if tipo == "FOTO" and total_fotos >= MAX_FOTOS:
                raise conflito("O anúncio já possui o máximo de fotos.")

            if tipo == "VIDEO" and total_videos >= MAX_VIDEOS:
                raise conflito("O anúncio já possui um vídeo.")

            ordem = max((m["ordem"] for m in midias), default=-1) + 1

            capa = (
                tipo == "FOTO"
                and not any(m["capa"] for m in midias)
            )

            # Salva o arquivo físico.
            chave, caminho = salvar_arquivo(conteudo, mime_type)

            # Registra os metadados do arquivo.
            arquivo = conn.execute(
                """
                INSERT INTO safradireta.arquivo
                    (
                        conta_enviante_id,
                        chave_storage,
                        nome_original,
                        mime_type,
                        tamanho_bytes,
                        checksum
                    )
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    atual["conta_id"],
                    chave,
                    Path(nome_original).name,
                    mime_type,
                    len(conteudo),
                    hashlib.sha256(conteudo).hexdigest(),
                ),
            ).fetchone()

            # Associa o arquivo ao anúncio.
            midia = conn.execute(
                """
                INSERT INTO safradireta.midia_anuncio
                    (anuncio_id, arquivo_id, tipo, ordem, capa)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    anuncio["id"],
                    arquivo["id"],
                    tipo,
                    ordem,
                    capa,
                ),
            ).fetchone()

            conn.execute(
                """
                UPDATE safradireta.anuncio
                SET versao = versao + 1,
                    atualizado_em = now()
                WHERE id = %s
                """,
                (anuncio["id"],),
            )

        return {
            "id": str(midia["id"]),
            "tipo": tipo,
            "ordem": ordem,
            "capa": capa,
        }

    except Exception:
        # Se o cadastro falhar, remove o arquivo físico.
        if caminho is not None:
            caminho.unlink(missing_ok=True)
        raise


def validar_imagem_real(conteudo: bytes, mime_type: str) -> None:
    """Verifica se a imagem pode ser lida e se o formato corresponde."""

    formatos = {
        "image/jpeg": "JPEG",
        "image/png": "PNG",
        "image/webp": "WEBP",
    }

    try:
        with Image.open(BytesIO(conteudo)) as imagem:
            if imagem.format != formatos[mime_type]:
                raise invalido(
                    "O formato real da imagem não corresponde ao esperado."
                )

            imagem.verify()

    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
    ):
        raise invalido("A imagem enviada é inválida ou está corrompida.")

def validar_video_real(conteudo: bytes) -> None:
    """Verifica se o arquivo contém uma faixa de vídeo reconhecível."""

    if shutil.which("ffprobe") is None:
        raise RuntimeError(
            "FFprobe não encontrado. Instale o FFmpeg "
            "para habilitar o upload de vídeos."
        )

    caminho = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=".video",
            delete=False,
        ) as temporario:
            temporario.write(conteudo)
            caminho = Path(temporario.name)

        resultado = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_type",
                "-of", "json",
                str(caminho),
            ],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )

        if resultado.returncode != 0:
            raise invalido("O vídeo enviado é inválido ou está corrompido.")

        dados = json.loads(resultado.stdout)

        if not any(
            stream.get("codec_type") == "video"
            for stream in dados.get("streams", [])
        ):
            raise invalido("O arquivo não contém uma faixa de vídeo válida.")

    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        raise invalido("Não foi possível validar o vídeo enviado.")

    finally:
        if caminho is not None:
            caminho.unlink(missing_ok=True)
