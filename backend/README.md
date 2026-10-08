# SafraDireta, Backend

API do marketplace de commodities que conecta pequenos produtores rurais a compradores.
Python 3.12+, FastAPI, PostgreSQL 18 e Psycopg 3.

## O que já existe

| Área | Rotas |
|---|---|
| Saúde | `GET /health`, `GET /health/db` |
| Termos | `GET /api/termos/vigente` |
| Cadastro | `POST /api/auth/register` (PF), `POST /api/auth/register-corporate` (PJ) |
| Sessão | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Perfil | `GET /api/perfil`, `PATCH /api/perfil`, `PATCH /api/perfil/email` |
| Vendedor | `GET` e `POST /api/vendedor/habilitacao` |

O contrato completo (entradas, respostas, erros e decisões em aberto) está em
[`docs/CONTRATO_API.md`](docs/CONTRATO_API.md). A documentação interativa fica em `/docs` com a API rodando.

## Como rodar

### 1. Banco de dados (uma vez)

1. Instale o PostgreSQL 18 e crie um banco vazio `safradireta` em UTF-8.
2. Conectado como administrador, rode `sql/01_estrutura.sql` **uma única vez** nesse banco vazio.
3. Crie o usuário da aplicação: `CREATE ROLE safra_app LOGIN;` e defina a senha com `\password safra_app`.
4. Rode `sql/02_permissoes.sql` como dono da estrutura.
5. Rode `sql/03_seed_dev.sql` como dono do banco. Ele cria o termo de uso 1.0 e um operador de teste. O `safra_app` não consegue inserir nessas tabelas, por isso este passo é do dono.

Sem o termo de uso vigente, o cadastro responde 503 `TERMO_INDISPONIVEL`.

### 2. Ambiente Python

Dentro da pasta `backend`:

```bash
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r conf/requirements-lock.txt
pip install -r conf/requirements-dev.txt
cp .env.example .env                 # Windows: copy .env.example .env
```

Abra o `.env` e preencha `PGPASSWORD` com a senha do `safra_app`. Confira também `PGHOST` e `PGPORT` (a porta padrão do PostgreSQL é 5432; o modelo vem com 55432).
**Nunca** envie o `.env` para o Git.

Variáveis do `.env`:

| Variável | Para que serve |
|---|---|
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Conexão com o banco |
| `PGSSLMODE` | Modo TLS (use o que o provedor exigir) |
| `DATABASE_URL` | Opcional, substitui os parâmetros `PG*` |
| `CORS_ORIGINS` | Origens do front liberadas (padrão `http://localhost:5173`) |
| `SESSAO_HORAS` | Duração da sessão em horas (padrão 12) |

### 3. Subir a API

```bash
uvicorn app.main:app --reload
```

Abra:

* http://127.0.0.1:8000/health para ver se a API está de pé
* http://127.0.0.1:8000/health/db para ver se o banco responde
* http://127.0.0.1:8000/docs para testar as rotas pelo navegador

Para testar rotas protegidas na `/docs`: cadastre uma conta, copie o `token` da resposta, clique em **Authorize** e cole o token.

## Testes

```bash
pytest
```

Os testes usam o banco real, mas cada teste roda dentro de uma transação que é desfeita no fim, então não sobra dado. Use apenas em banco de desenvolvimento.

| Arquivo | Cobre |
|---|---|
| `test_register.py`, `test_login.py`, `test_ratelimit.py` | Cadastro PF, login, logout, /me e limite de tentativas |
| `test_cadastro_pj.py` | Cadastro PJ, duplicidade de CNPJ e email |
| `test_erros_pj.py` | Erros 422 do PJ com chaves planas |
| `test_vendedor.py` | Habilitação de vendedor |
| `test_perfil.py`, `test_troca_email.py` | Perfil e troca de email |
| `test_termos.py`, `test_http_errors.py`, `test_errors.py` | Termos e erros padronizados |
| `test_validators.py`, `test_vendedor_habilitado.py` | Validadores (CPF, CNPJ, CEP) e guarda de vendedor |
| `test_security.py`, `test_integration.py` | Segurança básica e conexão |

## Como o código está organizado

```
app/
  main.py        cria a API e liga as rotas
  config.py      lê o .env
  database.py    pool de conexões
  deps.py        dependências de autenticação (conta_autenticada, vendedor_habilitado)
  errors.py      formato padrão de erro
  ratelimit.py   limite de tentativas de login
  security.py    hash de senha (Argon2) e token de sessão
  validators.py  CPF, CNPJ alfanumérico, CEP, UF
  routers/       rotas finas: recebem, chamam o service, devolvem
  services/      regras de negócio e SQL
  schemas/       entrada e saída (Pydantic)
sql/             estrutura, permissões e seed de desenvolvimento
docs/            contrato da API, modelagem e regras de negócio
tests/           testes de integração
```

Regras do projeto:

* O `conta_id` vem sempre do token, nunca do corpo da requisição.
* Erros usam sempre o formato `{"erro": {"codigo", "mensagem", "campos"}}`. As chaves de `campos` são os nomes dos campos do formulário do front.
* O banco só tem chaves, unicidade e NOT NULL. Validação, estados e transações são responsabilidade do backend.
* Escrita com várias tabelas usa `with conn.transaction():`.
* Nunca monte SQL concatenando texto do usuário. Use sempre parâmetros (`%s`).

## Outros documentos

* [`docs/CONTRATO_API.md`](docs/CONTRATO_API.md): contrato entre front e back
* [`docs/MODELAGEM.md`](docs/MODELAGEM.md): tabelas, relações e dicionário de colunas
* [`docs/REGRAS-DE-NEGOCIO.md`](docs/REGRAS-DE-NEGOCIO.md): regras que o backend precisa respeitar
* [`docs/README.md`](docs/README.md): README original da base entregue pelo banco de dados
