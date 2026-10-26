"""Roteiro automatico da Sprint 2 (US010, US011, US012, US014, US015, US018 e US019) contra a API rodando.

Uso (com a API ligada em outro terminal: uvicorn app.main:app --reload):
    python scripts/teste_manual_sprint2.py
    python scripts/teste_manual_sprint2.py http://127.0.0.1:8000

Cria contas e anuncios novos a cada rodada (email e CPF unicos). Usa so a biblioteca padrao.
"""
import json
import random
import struct
import sys
import time
import urllib.error
import urllib.request
import uuid
import zlib

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
SEM_ID = "00000000-0000-0000-0000-000000000000"
resultados = []


def chamar(metodo, caminho, corpo=None, token=None):
    dados = None if corpo is None else json.dumps(corpo).encode()
    req = urllib.request.Request(BASE + caminho, data=dados, method=metodo)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        texto = e.read()
        try:
            return e.code, json.loads(texto)
        except ValueError:
            return e.code, {"texto": texto.decode(errors="replace")}


def png_minimo():
    """PNG 8x8 valido, gerado na hora (sem arquivo e sem biblioteca extra)."""
    def bloco(tipo, dados):
        return struct.pack(">I", len(dados)) + tipo + dados + struct.pack(">I", zlib.crc32(tipo + dados))
    linhas = b"".join(b"\x00" + b"\x20\xa0\x40" * 8 for _ in range(8))
    return (b"\x89PNG\r\n\x1a\n" + bloco(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0))
            + bloco(b"IDAT", zlib.compress(linhas)) + bloco(b"IEND", b""))


def enviar_arquivo(caminho, token, nome, conteudo, mime):
    """POST multipart com o campo 'arquivo' (como o front faz no upload)."""
    limite = uuid.uuid4().hex
    corpo = (f"--{limite}\r\nContent-Disposition: form-data; name=\"arquivo\"; filename=\"{nome}\"\r\n"
             f"Content-Type: {mime}\r\n\r\n").encode() + conteudo + f"\r\n--{limite}--\r\n".encode()
    req = urllib.request.Request(BASE + caminho, data=corpo, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={limite}")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "null")


def baixar(caminho):
    """GET que devolve (status, tipo do conteudo, bytes), para arquivos."""
    try:
        with urllib.request.urlopen(BASE + caminho) as r:
            return r.status, r.headers.get("Content-Type"), r.read()
    except urllib.error.HTTPError as e:
        return e.code, None, b""


def conferir(nome, condicao, detalhe=""):
    resultados.append(bool(condicao))
    print(("  OK       " if condicao else "  FALHOU   ") + nome + ("" if condicao else f"   -> {detalhe}"))


def secao(titulo):
    print(f"\n{titulo}")


def gerar_cpf():
    n = [random.randint(0, 9) for _ in range(9)]
    for tamanho in (9, 10):
        soma = sum(d * p for d, p in zip(n, range(tamanho + 1, 1, -1)))
        n.append((soma * 10 % 11) % 10)
    return "".join(map(str, n))


def nova_conta(prefixo, vendedor):
    email = f"{prefixo}{int(time.time())}{random.randint(100, 999)}@teste.com"
    s, r = chamar("POST", "/api/auth/register", {
        "name": f"Teste {prefixo}", "email": email, "phone": "+5519999998888",
        "password": "senhaForte123", "acceptedTerms": True, "intent": "seller" if vendedor else "buyer"})
    assert s == 201, f"registro falhou: {s} {r}"
    token, conta_id = r["token"], r["conta"]["id"]
    if vendedor:
        s, r = chamar("POST", "/api/vendedor/habilitacao", {"cpf": gerar_cpf()}, token)
        assert s == 201, f"habilitacao falhou: {s} {r}"
    return token, conta_id


def campos(resp):
    return (resp or {}).get("erro", {}).get("campos", {})


# ---------------------------------------------------------------- preparacao
print(f"Testando {BASE}")
try:
    s, cat = chamar("GET", "/api/categorias")
except urllib.error.URLError:
    sys.exit("API fora do ar. Rode antes: uvicorn app.main:app --reload")

secao("Preparacao")
conferir("GET /api/categorias e publica (sem token)", s == 200, s)
conferir("traz as opcoes do formulario", "Nelore" in cat.get("opcoes", {}).get("racas", []), cat.get("opcoes"))
tok_a, id_a = nova_conta("vendedorA", True)
tok_b, id_b = nova_conta("vendedorB", True)
tok_c, _ = nova_conta("comprador", False)
print("  contas criadas: vendedor A, vendedor B e um comprador sem habilitacao")

URL = "/api/vendedor/anuncios"
boi = {"categoria": "ANIMAL", "especie": "BOVINO", "titulo": "30 bois nelore", "raca": "Nelore",
       "finalidade": "ENGORDA_ABATE", "quantidadeCabecas": 30, "pesoMedioKg": 480, "idadeMeses": 24,
       "cidade": "Campinas", "uf": "SP", "pricingMode": "TOTAL", "precoTotal": 150000}
soja = {"categoria": "GRAOS", "cultura": "SOJA", "subtipo": "CONVENCIONAL_NAO_TRANSGENICA",
        "titulo": "Soja safra nova", "safra": "2025/2026", "embalagem": "GRANEL", "umidadePercentual": 13,
        "quantidadeSacas": 1000, "cidade": "Sorriso", "uf": "MT", "pricingMode": "TOTAL", "precoTotal": 130000}
cafe = {**soja, "cultura": "CAFE", "subtipo": "ARABICA_TIPO6_DURA", "titulo": "Cafe arabica especial",
        "laudoTecnico": {"cafePeneira": "17_18_ACIMA", "cafeCatacaoDefeitos": "5 defeitos", "cafePontuacaoSca": 84}}


def invalido(nome, corpo, campo, token=tok_a):
    s, r = chamar("POST", URL, corpo, token)
    conferir(nome, s == 422 and campo in campos(r), f"{s} {r}")


# ---------------------------------------------------------------- US010
secao("US010: cadastrar lote de animais")
s, a = chamar("POST", URL, boi, tok_a)
conferir("vendedor habilitado cria o lote (201)", s == 201, f"{s} {a}")
conferir("anuncio nasce ATIVO e publicado", a.get("estadoComercial") == "ATIVO" and a.get("publicadoEm"), a)
conferir("anuncio fica ligado ao vendedor que criou", a.get("vendedorId") == id_a, a.get("vendedorId"))
conferir("produto escolhido pelo backend: Boi gordo", a.get("produto", {}).get("nome") == "Boi gordo", a.get("produto"))
conferir("preco por cabeca calculado (5000)", a.get("precoPorCabeca") == 5000, a.get("precoPorCabeca"))
id_boi = a.get("id")
s, _ = chamar("POST", URL, boi)
conferir("sem token: 401", s == 401, s)
s, _ = chamar("POST", URL, boi, tok_c)
conferir("conta sem habilitacao de vendedor: 403", s == 403, s)
s, r = chamar("POST", URL, {"categoria": "ANIMAL"}, tok_a)
conferir("so a categoria: 422 listando os campos", s == 422 and {"raca", "quantidadeCabecas", "precoTotal"} <= set(campos(r)), r)
invalido("quantidade 0: 422", {**boi, "quantidadeCabecas": 0}, "quantidadeCabecas")
invalido("peso medio 0: 422", {**boi, "pesoMedioKg": 0}, "pesoMedioKg")
invalido("preco 100.123: 422", {**boi, "precoTotal": 100.123}, "precoTotal")
invalido("titulo curto: 422", {**boi, "titulo": "abc"}, "titulo")
invalido("UF invalida: 422", {**boi, "uf": "XX"}, "uf")
invalido("raca fora da lista: 422", {**boi, "raca": "Dragao"}, "raca")
invalido("raca OUTRA sem nome: 422", {**boi, "raca": "OUTRA"}, "racaPersonalizada")
invalido("preco por cabeca que nao bate: 422", {**boi, "pricingMode": "PER_HEAD", "precoPorCabeca": 1}, "precoPorCabeca")
invalido("fotos no cadastro: 422", {**boi, "fotos": ["a.jpg"]}, "fotos")
s, a = chamar("POST", URL, {**boi, "pricingMode": "PER_HEAD", "precoPorCabeca": 5000}, tok_a)
conferir("preco por cabeca que bate: 201", s == 201 and a["pricingMode"] == "PER_HEAD", f"{s} {a}")

# ---------------------------------------------------------------- US011
secao("US011: cadastrar lote de graos ou cafe")
s, a = chamar("POST", URL, soja, tok_a)
conferir("cria lote de soja (201)", s == 201, f"{s} {a}")
conferir("soja: produto, preco por saca e toneladas",
         a.get("produto", {}).get("nome") == "Soja em grao" and a.get("precoPorSaca") == 130 and a.get("pesoTotalToneladas") == 60, a)
id_soja = a.get("id")
s, a = chamar("POST", URL, cafe, tok_a)
conferir("cria lote de cafe com laudo (201)", s == 201 and a["laudoTecnico"]["cafePeneira"] == "17_18_ACIMA", f"{s} {a}")
conferir("cafe arabica escolhido pelo backend", a.get("produto", {}).get("nome") == "Cafe arabica", a.get("produto"))
id_cafe = a.get("id")
s, a = chamar("POST", URL, {**cafe, "subtipo": "CONILON_ROBUSTA"}, tok_a)
conferir("cafe conilon escolhe o produto conilon", s == 201 and a["produto"]["nome"] == "Cafe conilon", f"{s} {a}")
for cultura, subtipo, nome in (("MILHO", "COMERCIAL_RACAO", "Milho em grao"), ("TRIGO", "PAO_TIPO1", "Trigo em grao")):
    extra = {"laudoTecnico": {"trigoPhKgHl": 78}} if cultura == "TRIGO" else {}
    s, a = chamar("POST", URL, {**soja, "cultura": cultura, "subtipo": subtipo, **extra}, tok_a)
    conferir(f"{cultura.lower()}: 201 com o produto certo", s == 201 and a["produto"]["nome"] == nome, f"{s} {a}")
s, r = chamar("POST", URL, {"categoria": "GRAOS"}, tok_a)
conferir("so a categoria: 422 listando os campos", s == 422 and {"cultura", "subtipo", "safra", "quantidadeSacas"} <= set(campos(r)), r)
invalido("subtipo de outra cultura: 422", {**soja, "subtipo": "PAO_TIPO1"}, "subtipo")
invalido("safra invalida: 422", {**soja, "safra": "2025/2027"}, "safra")
invalido("umidade 51: 422", {**soja, "umidadePercentual": 51}, "umidadePercentual")
invalido("sacas 0: 422", {**soja, "quantidadeSacas": 0}, "quantidadeSacas")
invalido("embalagem invalida: 422", {**soja, "embalagem": "CAIXA"}, "embalagem")
invalido("toneladas que nao batem: 422", {**soja, "pesoTotalToneladas": 10}, "pesoTotalToneladas")
invalido("preco por saca que nao bate: 422", {**soja, "pricingMode": "PER_SACK", "precoPorSaca": 1}, "precoPorSaca")
invalido("cafe sem peneira: 422", {**cafe, "laudoTecnico": {}}, "laudoTecnico.cafePeneira")
invalido("trigo sem pH: 422", {**soja, "cultura": "TRIGO", "subtipo": "PAO_TIPO1"}, "laudoTecnico.trigoPhKgHl")
invalido("laudo com campo desconhecido: 422", {**soja, "laudoTecnico": {"xyz": 1}}, "laudoTecnico.xyz")
invalido("OUTRO sem cultura personalizada: 422", {**soja, "cultura": "OUTRO", "subtipo": "OUTRO"}, "culturaPersonalizada")

# ---------------------------------------------------------------- US014
secao("US014: abrir e editar anuncio")
url = f"{URL}/{id_boi}"
s, a = chamar("GET", url, token=tok_a)
conferir("dono abre o anuncio com os campos preenchidos", s == 200 and a["titulo"] == "30 bois nelore" and a["raca"] == "Nelore", f"{s} {a}")
s, a = chamar("PATCH", url, {"titulo": "35 bois nelore", "precoTotal": 160000}, tok_a)
conferir("edicao parcial salva titulo e preco", s == 200 and a["titulo"] == "35 bois nelore" and a["precoTotal"] == 160000, f"{s} {a}")
conferir("versao sobe de 1 para 2", a.get("versao") == 2, a.get("versao"))
conferir("o que nao foi enviado continua igual", a.get("raca") == "Nelore" and a.get("quantidadeCabecas") == 30, a)
s, a = chamar("GET", url, token=tok_a)
conferir("alteracao ficou gravada (GET depois do PATCH)", a.get("titulo") == "35 bois nelore", a)
s, a = chamar("PATCH", url, a, tok_a)
conferir("reenviar o formulario inteiro do GET funciona", s == 200, f"{s} {a}")
s, a = chamar("PATCH", url, {"descricao": "Gado manso"}, tok_a)
s, a = chamar("PATCH", url, {"descricao": None}, tok_a)
conferir("descricao pode ser limpa com null", s == 200 and a["descricao"] is None, f"{s} {a}")
s, a = chamar("PATCH", url, {"estadoComercial": "VENDIDO", "vendedorId": id_b}, tok_a)
conferir("estado e dono nao mudam pela edicao", s == 200 and a["estadoComercial"] == "ATIVO" and a["vendedorId"] == id_a, a)
s, r = chamar("PATCH", url, {}, tok_a)
conferir("corpo vazio: 422", s == 422, f"{s} {r}")
for corpo, campo in (({"titulo": "abc"}, "titulo"), ({"precoTotal": 0}, "precoTotal"), ({"quantidadeCabecas": 0}, "quantidadeCabecas"),
                     ({"raca": "OUTRA"}, "racaPersonalizada"), ({"categoria": "GRAOS"}, "categoria"), ({"fotos": ["a.jpg"]}, "fotos")):
    s, r = chamar("PATCH", url, corpo, tok_a)
    conferir(f"edicao invalida {json.dumps(corpo)}: 422", s == 422 and campo in campos(r), f"{s} {r}")
s, a = chamar("PATCH", f"{URL}/{id_soja}", {"quantidadeSacas": 500, "embalagem": "BIG_BAG"}, tok_a)
conferir("edita graos (1000 para 500 sacas): 30 t e R$ 260 por saca", s == 200 and a["pesoTotalToneladas"] == 30 and a["precoPorSaca"] == 260, f"{s} {a}")
s, r = chamar("PATCH", f"{URL}/{id_soja}", {"cultura": "MILHO", "subtipo": "COMERCIAL_RACAO"}, tok_a)
conferir("trocar a cultura: 422", s == 422 and "cultura" in campos(r), f"{s} {r}")
s, a = chamar("PATCH", f"{URL}/{id_cafe}", {"subtipo": "CONILON_ROBUSTA"}, tok_a)
conferir("cafe arabica para conilon troca o produto", s == 200 and a["produto"]["nome"] == "Cafe conilon", f"{s} {a}")

secao("US014: outro usuario nao consegue acessar nem editar")
s, _ = chamar("GET", url, token=tok_b)
conferir("outro vendedor abrindo: 403", s == 403, s)
s, _ = chamar("PATCH", url, {"titulo": "Invadido por outro"}, tok_b)
conferir("outro vendedor editando: 403", s == 403, s)
s, a = chamar("GET", url, token=tok_a)
conferir("anuncio continua intacto depois da tentativa", a.get("titulo") == "35 bois nelore", a.get("titulo"))
s, _ = chamar("GET", url, token=tok_c)
conferir("comprador sem habilitacao: 403", s == 403, s)
s, _ = chamar("GET", url)
conferir("sem token: 401", s == 401, s)
s, _ = chamar("GET", f"{URL}/{SEM_ID}", token=tok_a)
conferir("anuncio inexistente: 404", s == 404, s)

# ---------------------------------------------------------------- US012
secao("US012: fotos do anuncio")
s, a = chamar("POST", URL, {**boi, "titulo": "Lote com fotos"}, tok_a)
id_m, png = a["id"], png_minimo()
s, m1 = enviar_arquivo(f"{URL}/{id_m}/midias", tok_a, "foto1.png", png, "image/png")
conferir("envia a primeira foto (201)", s == 201 and m1.get("tipo") == "FOTO", f"{s} {m1}")
conferir("primeira foto vira a capa, ordem 0", m1.get("capa") is True and m1.get("ordem") == 0, m1)
s, m2 = enviar_arquivo(f"{URL}/{id_m}/midias", tok_a, "foto2.png", png, "image/png")
conferir("segunda foto: ordem 1 e sem capa", s == 201 and m2.get("ordem") == 1 and m2.get("capa") is False, f"{s} {m2}")
s, a = chamar("GET", f"{URL}/{id_m}", token=tok_a)
conferir("o anuncio lista as 2 fotos", len(a.get("midias", [])) == 2, a.get("midias"))
s, _ = enviar_arquivo(f"{URL}/{id_m}/midias", tok_b, "x.png", png, "image/png")
conferir("outro vendedor enviando: 403", s == 403, s)
s, _ = enviar_arquivo(f"{URL}/{id_m}/midias", tok_a, "x.txt", b"isto nao e uma imagem", "text/plain")
conferir("arquivo que nao e foto nem video: 422", s == 422, s)
s, _ = enviar_arquivo(f"{URL}/{id_m}/midias", tok_a, "x.png", b"", "image/png")
conferir("arquivo vazio: 422", s == 422, s)
for n in range(3, 7):
    enviar_arquivo(f"{URL}/{id_m}/midias", tok_a, f"foto{n}.png", png, "image/png")
s, _ = enviar_arquivo(f"{URL}/{id_m}/midias", tok_a, "foto7.png", png, "image/png")
conferir("7a foto (limite e 6): 409", s == 409, s)

# ---------------------------------------------------------------- US015
secao("US015: pausar e reativar")
s, a = chamar("POST", f"{URL}/{id_m}/pausar", token=tok_a)
conferir("dono pausa o anuncio", s == 200 and a.get("estadoComercial") == "PAUSADO", f"{s} {a}")
versao_pausado = a.get("versao")
s, _ = chamar("POST", f"{URL}/{id_m}/pausar", token=tok_a)
conferir("pausar de novo: 409", s == 409, s)
s, _ = chamar("POST", f"{URL}/{id_m}/reativar", token=tok_b)
conferir("outro vendedor reativando: 403", s == 403, s)
s, _ = chamar("POST", f"{URL}/{id_m}/reativar")
conferir("sem token: 401", s == 401, s)
s, a = chamar("POST", f"{URL}/{id_m}/reativar", token=tok_a)
conferir("dono reativa o anuncio", s == 200 and a.get("estadoComercial") == "ATIVO", f"{s} {a}")
conferir("a versao sobe a cada mudanca de estado", a.get("versao") == versao_pausado + 1, a.get("versao"))
s, _ = chamar("POST", f"{URL}/{id_m}/reativar", token=tok_a)
conferir("reativar anuncio ativo: 409", s == 409, s)
s, _ = chamar("POST", f"{URL}/{SEM_ID}/pausar", token=tok_a)
conferir("anuncio inexistente: 404", s == 404, s)

# ---------------------------------------------------------------- US018
secao("US018: catalogo publico (sem login)")
s, c = chamar("GET", "/api/anuncios?tamanho=50")
conferir("catalogo abre sem token (200)", s == 200 and {"itens", "pagina", "tamanho", "total"} <= set(c), f"{s} {c}")
item = next((i for i in c.get("itens", []) if i["id"] == id_m), None)
conferir("o anuncio novo aparece com preco e local", item and item["precoTotal"] == 150000 and item["uf"] == "SP", item)
conferir("traz a capa com o endereco da foto", item and item["capa"] and item["capa"]["url"].startswith("/api/midias/"), item)
s, c = chamar("GET", "/api/anuncios?categoria=GRAOS&tamanho=50")
conferir("filtro categoria=GRAOS so traz graos", s == 200 and c["itens"] and all(i["categoria"] == "GRAOS" for i in c["itens"]), c)
s, c = chamar("GET", "/api/anuncios?cultura=CAFE&tamanho=50")
conferir("filtro cultura=CAFE so traz cafe", s == 200 and c["itens"] and all(i["cultura"] == "CAFE" for i in c["itens"]), c)
s, c = chamar("GET", "/api/anuncios?uf=SP&precoMin=1&precoMax=999999999&ordem=menor_preco&tamanho=50")
precos = [i["precoTotal"] for i in c.get("itens", [])]
conferir("filtros de UF e preco, ordenado do mais barato", s == 200 and precos == sorted(precos) and precos, precos[:5])
s, c = chamar("GET", "/api/anuncios?tamanho=2&pagina=1")
conferir("paginacao: 2 itens por pagina", s == 200 and len(c["itens"]) == 2 and c["total"] >= 2, c)
s, _ = chamar("GET", "/api/anuncios?categoria=PEIXE")
conferir("filtro invalido: 422", s == 422, s)
s, _ = chamar("POST", f"{URL}/{id_m}/pausar", token=tok_a)
s, c = chamar("GET", "/api/anuncios?tamanho=50")
conferir("anuncio pausado some do catalogo", all(i["id"] != id_m for i in c["itens"]), "ainda aparece")

# ---------------------------------------------------------------- US019
secao("US019: detalhe publico do anuncio")
s, _ = chamar("POST", f"{URL}/{id_m}/reativar", token=tok_a)
s, d = chamar("GET", f"/api/anuncios/{id_m}")
conferir("detalhe abre sem token (200)", s == 200 and d.get("id") == id_m, f"{s} {d}")
conferir("mostra o nome do vendedor", bool((d.get("vendedor") or {}).get("nome")), d.get("vendedor"))
conferir("nao mostra o id do vendedor", "vendedorId" not in d and id_a not in json.dumps(d), "vazou")
conferir("traz as 6 fotos com endereco", len(d.get("midias", [])) == 6 and all(m.get("url") for m in d["midias"]), d.get("midias"))
s, tipo, conteudo = baixar(d["midias"][0]["url"])
conferir("a foto pode ser baixada (image/png)", s == 200 and tipo == "image/png" and conteudo == png, f"{s} {tipo}")
s, d = chamar("GET", f"/api/anuncios/{id_soja}")
conferir("detalhe de graos traz preco por saca", s == 200 and d.get("precoPorSaca") is not None, d)
s, _ = chamar("GET", f"/api/anuncios/{SEM_ID}")
conferir("anuncio inexistente: 404", s == 404, s)
s, _ = chamar("POST", f"{URL}/{id_m}/pausar", token=tok_a)
s, _ = chamar("GET", f"/api/anuncios/{id_m}")
conferir("anuncio pausado: 404", s == 404, s)
s, _, _ = baixar(f"/api/midias/{SEM_ID}")
conferir("midia inexistente: 404", s == 404, s)

total, ok = len(resultados), sum(resultados)
print(f"\nResultado: {ok} de {total} conferencias OK")
print("TUDO CERTO" if ok == total else "ATENCAO: ha conferencias que falharam (veja as linhas FALHOU acima)")
sys.exit(0 if ok == total else 1)
