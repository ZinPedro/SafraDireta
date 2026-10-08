# SafraDireta — Python + FastAPI + PostgreSQL

Esta pasta é a entrega para a equipe de backend. Contém uma aplicação FastAPI executável, conexão com PostgreSQL por Psycopg 3, testes de integração, SQL da estrutura e a modelagem. Não contém credenciais reais nem implementação de cadastro/login/vendedor.

## Começar neste computador

O PostgreSQL do projeto está em `127.0.0.1:55432`, banco/schema `safradireta`, usuário `safra_app`. Se estiver parado, execute `banco/sprint-01/local.ps1 iniciar` a partir da raiz do projeto.

Com Python 3.12 ou superior, abra um terminal nesta pasta:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
Copy-Item .env.example .env
```

Preencha `.env` com a senha de aplicação disponível em `../.local/backend.env`, ou use diretamente esse arquivo local:

```powershell
$env:SAFRADIRETA_ENV_FILE = (Resolve-Path ../.local/backend.env).Path
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Abra:

- API: http://127.0.0.1:8000/health
- Conexão real ao banco: http://127.0.0.1:8000/health/db
- Documentação interativa: http://127.0.0.1:8000/docs

`/health` retorna o estado do processo. `/health/db` consulta o PostgreSQL e verifica a presença de `safradireta.conta`; retorna 503 se a conexão falhar ou a estrutura não existir. A API exige conexão válida na inicialização e não retorna dados de contas em nenhuma rota desta base.

No Linux/macOS, substitua `.venv\Scripts\python.exe` por `.venv/bin/python` e configure a variável com `export SAFRADIRETA_ENV_FILE=/caminho/backend.env`.

## Usar em outro computador

`127.0.0.1` significa o próprio computador: esta configuração não oferece acesso remoto ao banco do Felipe. Cada integrante pode criar seu banco local; um banco compartilhado deve ter host, porta, credenciais e TLS definidos pela equipe.

1. Instale PostgreSQL 18 e Python 3.12+.
2. Conectado como administrador, crie um banco vazio `safradireta` em UTF-8.
3. Execute `sql/01_estrutura.sql` **uma única vez nesse banco vazio**. É a estrutura final consolidada, sem instalar as migrations históricas que criavam automações.
4. Crie o usuário de aplicação caso ainda não exista: `CREATE ROLE safra_app LOGIN;`. Defina a senha com `\password safra_app` no psql ou pela interface administrativa.
5. Execute `sql/02_permissoes.sql` conectado como proprietário da estrutura. O usuário `safra_app` não recebe privilégios de superusuário nem permissão para criar tabelas, termos ou operadores/decisões.
6. Configure `.env` com o host/porta locais (normalmente 5432 em uma instalação comum), banco, usuário e senha. Execute os comandos Python acima.

Não execute a estrutura consolidada por cima do banco já existente. A evolução da instância original é feita pelas migrations em `banco/sprint-01` no projeto completo.

## Organização

| Arquivo | Uso |
|---|---|
| `app/main.py` | FastAPI, inicialização/encerramento do pool e rotas de saúde |
| `app/database.py` | Configuração e conexão reutilizável por dependência |
| `.env.example` | Modelo de configuração sem segredos |
| `requirements.txt` | Faixas das dependências diretas |
| `requirements-lock.txt` | Versões exatas usadas na validação |
| `requirements-dev.txt` | Dependências para testes |
| `tests/test_integration.py` | Testes reais de conexão, HTTP, consulta parametrizada e rollback |
| `sql/01_estrutura.sql` | Estrutura final para banco vazio |
| `sql/02_permissoes.sql` | Permissões do usuário de aplicação |
| `MODELAGEM.md` | Entidades, relacionamentos e dicionário de colunas |
| `REGRAS-DE-NEGOCIO.md` | Regras a implementar antes de liberar os fluxos |

## Usar a conexão nas novas rotas

O módulo expõe `get_connection`, utilizável com `Depends(get_connection)`. O pool tem até cinco conexões por processo e usa `autocommit=True`; operações de negócio com várias escritas precisam de uma transação explícita:

```python
from fastapi import Depends
from psycopg import Connection
from app.database import get_connection

# Dentro de uma rota autenticada, obtenha conta_id da identidade autenticada.
# A validacao do payload e a autorizacao devem ocorrer antes da escrita.
def atualizar_nome(conn: Connection, conta_id, nome_validado):
    with conn.transaction():
        conn.execute(
            "UPDATE safradireta.perfil_pf SET nome = %s WHERE conta_id = %s",
            (nome_validado, conta_id),
        )
        conn.execute(
            "UPDATE safradireta.conta SET atualizado_em = now() WHERE id = %s",
            (conta_id,),
        )
```

Não concatene valores do usuário no SQL. Não compartilhe uma mesma conexão entre requisições. Use uma transação por operação e bloqueios `SELECT ... FOR UPDATE` nos fluxos concorrentes. Trate violações de unicidade como conflito (HTTP 409) e validações de entrada como HTTP 422. Não retorne exceções SQL completas ao cliente.

A dependência não autentica o usuário. O banco é compartilhado pela API: checar o dono do recurso no código é obrigatório. As rotas administrativas precisam de uma conexão/role própria com permissões limitadas, definida pela equipe; nunca use `safra_owner` nas rotas públicas.

## Testar

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Configure o mesmo `.env` da aplicação antes. Execute somente em desenvolvimento. As escritas dos testes são revertidas por rollback.

## Referências técnicas

- [FastAPI: lifespan](https://fastapi.tiangolo.com/advanced/events/)
- [Psycopg: conexões e parâmetros](https://www.psycopg.org/psycopg3/docs/basic/usage.html)
- [Psycopg: pool de conexões](https://www.psycopg.org/psycopg3/docs/advanced/pool.html)
