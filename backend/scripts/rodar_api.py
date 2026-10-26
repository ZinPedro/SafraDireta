"""Prepara tudo e liga a API do SafraDireta. Funciona igual em Windows, Mac e Linux.

Uso, dentro da pasta backend (nao precisa ativar o venv nem instalar nada antes):
    python scripts/rodar_api.py            liga a API em http://127.0.0.1:8000 (Ctrl+C para parar)
    python scripts/rodar_api.py --testar   liga a API, roda o roteiro de testes da API e desliga
    python scripts/rodar_api.py --pytest   roda os testes automaticos (pytest)
    python scripts/rodar_api.py --banco    so prepara e confere o banco

Na primeira vez ele cria o .venv, instala as dependencias, baixa o FFmpeg (usado nos videos), cria o .env e
monta o banco (usuario, banco e SQLs da pasta sql). Nas proximas, so confere e liga.
Precisa apenas do Python e do PostgreSQL instalado e ligado.
"""
import hashlib
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
VENV = BACKEND / ".venv"
REQUISITOS = BACKEND / "requirements.txt"
PORTA_TESTE = 8765  # porta propria, para nao bater com a API que voce deixou ligada


def python_do_venv() -> Path:
    return VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def entrar_no_venv() -> None:
    """Cria o .venv se faltar e roda este mesmo script dentro dele."""
    if Path(sys.prefix).resolve() == VENV.resolve():
        return
    if not python_do_venv().is_file():
        print("Criando o ambiente virtual (.venv)...")
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
    sys.exit(subprocess.run([str(python_do_venv()), *sys.argv]).returncode)


def instalar_dependencias() -> None:
    """Instala o requirements.txt. So repete quando o arquivo mudar."""
    dados = REQUISITOS.read_bytes()
    if dados[:2] in (b"\xff\xfe", b"\xfe\xff"):  # salvo em UTF-16 (PowerShell): converte para UTF-8
        texto = dados.decode("utf-16", errors="ignore").replace("\x00", "")
        REQUISITOS.write_text(texto.replace("\r", ""), encoding="utf-8", newline="\n")
        dados = REQUISITOS.read_bytes()
        print("Aviso: requirements.txt estava em UTF-16 e foi convertido para UTF-8.")
    marca = VENV / ".requirements.sha256"
    assinatura = hashlib.sha256(dados).hexdigest()
    if marca.is_file() and marca.read_text().strip() == assinatura:
        return
    print("Instalando as dependencias (primeira vez ou requirements.txt mudou)...")
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", str(REQUISITOS)], check=True)
    marca.write_text(assinatura)


def garantir_ffmpeg() -> None:
    """Garante o ffprobe/ffmpeg (videos). Se nao houver no sistema, baixa pelo pip, sem precisar de admin."""
    if shutil.which("ffprobe") and shutil.which("ffmpeg"):
        return
    print("FFmpeg nao encontrado. Baixando (so na primeira vez, pode levar um minuto)...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "static-ffmpeg"], check=True)
        import static_ffmpeg
        static_ffmpeg.add_paths()  # coloca o ffmpeg no PATH deste processo e dos filhos
    except Exception as erro:  # noqa: BLE001 - qualquer falha aqui vira so um aviso
        print(f"AVISO: nao consegui baixar o FFmpeg ({erro}). A API liga, mas o envio de video vai falhar.")
        print("Instale na mao: Mac: brew install ffmpeg | Windows: winget install ffmpeg | Linux: sudo apt install ffmpeg")
        print("(no Windows, feche e abra o terminal depois de instalar)")
        return
    if not shutil.which("ffprobe"):
        print("AVISO: FFmpeg baixado, mas nao foi encontrado. O envio de video pode falhar.")


SQL_DIR = BACKEND / "sql"
BANCO, USUARIO_APP, SENHA_PADRAO = "safradireta", "safra_app", "safra_dev_123"

# O que a API precisa no banco (inclui o que as historias de midia e de estado usam).
LEITURA = ["conta", "perfil_pf", "empresa", "categoria", "produto", "unidade_medida", "anuncio", "lote_animal",
           "lote_agricola", "localizacao_anuncio", "midia_anuncio", "arquivo"]
ESCRITA = {"INSERT": ["anuncio", "lote_animal", "lote_agricola", "localizacao_anuncio", "midia_anuncio",
                      "arquivo", "evento_auditoria"],
           "UPDATE": ["anuncio", "lote_animal", "lote_agricola", "localizacao_anuncio"]}
COLUNAS = [("anuncio", "modo_preco"), ("lote_agricola", "laudo_tecnico")]
PRODUTOS = ["Boi gordo", "Soja em grao", "Milho em grao", "Cafe arabica", "Cafe conilon", "Trigo em grao", "Outro grao"]


def carregar_env() -> None:
    """Carrega o .env. Se nao existir, cria um com os padroes de desenvolvimento."""
    from dotenv import load_dotenv

    env = Path(os.environ.get("SAFRADIRETA_ENV_FILE", BACKEND / ".env"))
    if not env.is_file():
        print(f"Criando {env.name} com os padroes de desenvolvimento...")
        env.write_text(
            f"PGHOST={os.environ.get('PGHOST', '127.0.0.1')}\nPGPORT={os.environ.get('PGPORT', '5432')}\n"
            f"PGDATABASE={BANCO}\nPGUSER={USUARIO_APP}\nPGPASSWORD={SENHA_PADRAO}\nPGSSLMODE=prefer\n"
            "CORS_ORIGINS=http://localhost:5173\nSESSAO_HORAS=12\n", encoding="utf-8")
    load_dotenv(env, override=False)


def faltas_do_banco(conn) -> list[str]:
    """Lista o que falta no banco para a API funcionar. Lista vazia = tudo certo."""
    faltas = []
    for t in LEITURA:
        if conn.execute("SELECT to_regclass(%s)", (f"safradireta.{t}",)).fetchone()[0] is None:
            faltas.append(f"tabela {t}")
    if faltas:
        return faltas
    for t in LEITURA:
        if not conn.execute("SELECT has_table_privilege(%s, 'SELECT')", (f"safradireta.{t}",)).fetchone()[0]:
            faltas.append(f"permissao de leitura em {t}")
    for acao, tabelas in ESCRITA.items():
        for t in tabelas:
            if not conn.execute("SELECT has_table_privilege(%s, %s)", (f"safradireta.{t}", acao)).fetchone()[0]:
                faltas.append(f"permissao de {acao} em {t}")
    for t, c in COLUNAS:
        achou = conn.execute("SELECT 1 FROM information_schema.columns WHERE table_schema = 'safradireta' "
                             "AND table_name = %s AND column_name = %s", (t, c)).fetchone()
        if not achou:
            faltas.append(f"coluna {t}.{c}")
    nomes = {r[0] for r in conn.execute("SELECT nome FROM safradireta.produto")}
    faltas += [f"produto '{p}'" for p in PRODUTOS if p not in nomes]
    if not conn.execute("SELECT 1 FROM safradireta.unidade_medida WHERE codigo = 'SACA_60KG'").fetchone():
        faltas.append("unidade SACA_60KG")
    return faltas


def conectar_admin():
    """Conecta como administrador do PostgreSQL (so para montar o banco). None se nao conseguir."""
    import getpass
    import psycopg

    base = {"host": os.environ.get("PGHOST", "127.0.0.1"), "port": os.environ.get("PGPORT", "5432"),
            "dbname": "postgres", "connect_timeout": 5, "autocommit": True}
    senha = os.environ.get("ADMIN_PGPASSWORD")
    usuarios = [u for u in (os.environ.get("ADMIN_PGUSER"), "postgres", getpass.getuser()) if u]
    for tentativa in range(2):
        for usuario in dict.fromkeys(usuarios):
            try:
                return psycopg.connect(user=usuario, password=senha, **base)
            except psycopg.Error:
                continue
        if tentativa == 0 and sys.stdin.isatty():
            senha = getpass.getpass("Senha do administrador do PostgreSQL (usuario postgres): ")
        else:
            break
    return None


def montar_banco() -> bool:
    """Cria usuario e banco se faltarem e aplica os SQLs da pasta sql (o 01 so em banco vazio)."""
    import psycopg
    from psycopg import sql

    admin = conectar_admin()
    if admin is None:
        print("Nao consegui entrar como administrador do PostgreSQL para montar o banco.")
        print("Confira se o PostgreSQL esta ligado. Se o usuario postgres tem senha, rode com ADMIN_PGPASSWORD=senha")
        print("(Linux: use ./setup_banco_local.sh ou defina uma senha: sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'x'\").")
        return False
    usuario_admin, senha_admin = admin.info.user, admin.info.password
    with admin:
        if not admin.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (USUARIO_APP,)).fetchone():
            print(f"Criando o usuario {USUARIO_APP}...")
            admin.execute(sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(
                sql.Identifier(USUARIO_APP), sql.Literal(os.environ.get("PGPASSWORD", SENHA_PADRAO))))
        if not admin.execute("SELECT 1 FROM pg_database WHERE datname = %s", (BANCO,)).fetchone():
            print(f"Criando o banco {BANCO}...")
            admin.execute(sql.SQL("CREATE DATABASE {} ENCODING 'UTF8'").format(sql.Identifier(BANCO)))
    with psycopg.connect(host=os.environ.get("PGHOST", "127.0.0.1"), port=os.environ.get("PGPORT", "5432"),
                         dbname=BANCO, user=usuario_admin, password=senha_admin, autocommit=True) as conn:
        existe = conn.execute("SELECT 1 FROM pg_namespace WHERE nspname = 'safradireta'").fetchone()
        for arquivo in sorted(SQL_DIR.glob("0*.sql")):
            if arquivo.name.startswith("01_") and existe:
                continue  # a estrutura ja existe; o 01 nao pode rodar duas vezes
            print(f"Aplicando {arquivo.name}...")
            conn.execute(arquivo.read_text(encoding="utf-8"))
    return True


def garantir_banco() -> bool:
    """Confere o banco e, se faltar algo, monta sozinho. Mostra o que fez e o que ainda falta."""
    import psycopg

    carregar_env()

    def conferir():
        try:
            with psycopg.connect(os.environ.get("DATABASE_URL", ""), connect_timeout=5) as conn:
                return faltas_do_banco(conn)
        except psycopg.Error as erro:
            return [f"conexao com o banco ({str(erro).strip().splitlines()[0]})"]

    faltas = conferir()
    if not faltas:
        print("Banco ok.")
        return True
    print("Banco incompleto: falta " + "; ".join(faltas[:6]) + ("..." if len(faltas) > 6 else ""))
    print("Tentando montar o banco sozinho...")
    if not montar_banco():
        return False
    faltas = conferir()
    if faltas:
        print("Ainda falta: " + "; ".join(faltas))
        return False
    print("Banco pronto.")
    return True


def comando_uvicorn(porta: int, recarregar: bool) -> list[str]:
    cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(porta)]
    return cmd + ["--reload"] if recarregar else cmd


def api_no_ar(porta: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{porta}/health", timeout=2):
            return True
    except OSError:
        return False


def ligar() -> int:
    print("Ligando a API em http://127.0.0.1:8000 (documentacao em /docs). Ctrl+C para parar.")
    try:
        return subprocess.run(comando_uvicorn(8000, True), cwd=BACKEND).returncode
    except KeyboardInterrupt:
        return 0


def testar() -> int:
    api = subprocess.Popen(comando_uvicorn(PORTA_TESTE, False), cwd=BACKEND)
    try:
        for _ in range(30):
            if api.poll() is not None:
                print("A API nao subiu. Veja a mensagem acima.")
                return 1
            if api_no_ar(PORTA_TESTE):
                break
            time.sleep(0.5)
        else:
            print("A API demorou demais para subir.")
            return 1
        roteiro = BACKEND / "scripts" / "teste_manual_sprint2.py"
        return subprocess.run([sys.executable, str(roteiro), f"http://127.0.0.1:{PORTA_TESTE}"], cwd=BACKEND).returncode
    finally:
        api.terminate()
        try:
            api.wait(timeout=10)
        except subprocess.TimeoutExpired:
            api.kill()


def pytest() -> int:
    return subprocess.run([sys.executable, "-m", "pytest", "-q"], cwd=BACKEND).returncode


if __name__ == "__main__":
    entrar_no_venv()
    instalar_dependencias()
    garantir_ffmpeg()
    if not garantir_banco():
        sys.exit(1)
    argumentos = sys.argv[1:]
    if "--banco" in argumentos:
        sys.exit(0)
    sys.exit(testar() if "--testar" in argumentos else pytest() if "--pytest" in argumentos else ligar())
