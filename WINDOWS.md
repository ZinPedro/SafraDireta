# Execução de testes no Windows

Branch: `testes/windows`, criada a partir de `dev`.

## Pré-requisitos

- Python 3.12 ou superior, com o launcher `py`.
- Node.js 22.12+ ou 24 LTS, com npm. O Node 20.17 não atende ao Vite deste projeto.
- PostgreSQL 18 instalado e iniciado. Inclua sua pasta `bin` no PATH para usar `psql`.

Abra o PowerShell na pasta que contém este documento. Os scripts usam caminhos absolutos internamente e aceitam pastas com espaços. Não é necessário ativar o ambiente Python.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows.ps1 preparar
```

O comando instala as dependências e copia os exemplos de `.env` apenas se esses arquivos ainda não existirem. Para indicar executáveis específicos, use `-Python 'C:\caminho\python.exe' -Node 'C:\caminho\node.exe'`.

## Preparar o banco uma vez

Use um banco local de desenvolvimento vazio. No SQL Shell do PostgreSQL, conectado como `postgres`:

```sql
CREATE DATABASE safradireta ENCODING 'UTF8';
CREATE ROLE safra_app LOGIN;
\password safra_app
```

No PowerShell, execute cada comando abaixo e confira que terminou sem erro antes de seguir. A estrutura deve ser aplicada somente uma vez, em banco vazio. Ajuste a porta se sua instalação não usar 5432.

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d safradireta -v ON_ERROR_STOP=1 -f .\backend\sql\01_estrutura.sql
psql -h 127.0.0.1 -p 5432 -U postgres -d safradireta -v ON_ERROR_STOP=1 -f .\backend\sql\02_permissoes.sql
psql -h 127.0.0.1 -p 5432 -U postgres -d safradireta -v ON_ERROR_STOP=1 -f .\backend\sql\03_seed_dev.sql
```

Edite `backend/.env`: defina `PGPORT=5432` e preencha `PGPASSWORD` com a senha escolhida. O exemplo usa 55432; essa porta só funciona se seu servidor estiver configurado nela. Mantenha `PGUSER=safra_app` e `CORS_ORIGINS=http://localhost:5173`. Não envie `.env` ao Git.

## Iniciar

Em um terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows.ps1 backend
```

Em outro terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows.ps1 frontend
```

Acesse <http://localhost:5173>. A documentação da API está em <http://127.0.0.1:8000/docs>. Use Ctrl+C nos terminais para encerrar.

Em um terceiro terminal, confira frontend, API e banco:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows.ps1 verificar
```

Para testar o backend, com o banco de desenvolvimento configurado:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest
```

Os testes que usam o banco desfazem suas transações ao terminar. Para validar a interface sem backend, você pode definir `VITE_MOCK_API=true` em `frontend/.env` e reiniciar o frontend; esse modo simula respostas e não valida a integração real.
