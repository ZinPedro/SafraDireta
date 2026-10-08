# Validação da entrega — 08/10/2026

- PostgreSQL 18.3 local, banco `safradireta`, schema `safradireta`.
- Migration 08 aplicada após backup completo e confirmação da remoção das regras.
- Testes SQL: 16 tabelas; zero funções/triggers de aplicação, CHECKs, EXCLUDE ou colunas geradas; PK/FK/UNIQUE/NOT NULL preservados.
- SQL consolidado instalado em banco temporário vazio. Colunas, defaults, restrições e índices comparados com a instância atual: iguais. Banco temporário removido ao terminar.
- Python 3.12, dependências exatas em `requirements-lock.txt`.
- Três testes de integração FastAPI passaram: saúde/documentação, indisponibilidade com resposta 503 sem detalhes internos, escrita parametrizada e rollback.
- Servidor Uvicorn iniciado para teste HTTP real de `/health/db` e `/openapi.json`, com sucesso, e encerrado depois. Nenhum servidor HTTP de teste ficou executando.
- Dados fictícios dos testes revertidos; não foram criados termos, usuários ou administradores de produção.

Os testes não demonstram implementação de cadastro, autenticação ou regras de negócio. Essas funcionalidades são tarefas da equipe, detalhadas em `REGRAS-DE-NEGOCIO.md`.
