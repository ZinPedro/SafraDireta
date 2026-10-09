# SafraDireta

> Marketplace de comercialização de commodities agrícolas e negociação direta entre pequenos produtores rurais e compradores.

Projeto acadêmico desenvolvido para a disciplina de **Gerenciamento de Projetos** da **PUC Campinas**.

---

## 📌 Status do Projeto — Sprint 1 (Concluída)

A **Sprint 1** estabeleceu a fundação completa do SafraDireta, entregando a integração ponta a ponta entre Frontend, Backend e Banco de Dados com **100% dos cards e 90 pontos concluídos**:

| Card | História de Usuário | Pontos | Status |
| :---: | :--- | :---: | :---: |
| **US-001** | Executar o SafraDireta de ponta a ponta | 18 | Concluído |
| **US-002** | Navegar pelas áreas públicas do SafraDireta | 12 | Concluído |
| **US-003** | Cadastrar conta (Comprador PF e Conta Corporativa PJ) | 18 | Concluído |
| **US-004** | Cadastrar-se / Evoluir para Vendedor (Produtor Rural) | 18 | Concluído |
| **US-005** | Autenticar conta e proteger recursos (Sessão & Rate Limit) | 12 | Concluído |
| **US-008** | Consultar e editar perfil (Conta, Endereço, Vitrine e Avatar) | 12 | Concluído |
| **Total** | **Backlog Planejado da Sprint 1** | **90** | **100% Entregue** |

### Destaques Técnicos da Entrega:
* **Backend:** API RESTful robusta desenvolvida em **FastAPI (Python 3.12+)**, com banco **PostgreSQL**, pool de conexões com **Psycopg 3**, hashing com **Argon2id**, proteção contra brute force (rate limiting) e **98 testes automatizados** passando com 100% de cobertura de regras.
* **Frontend:** SPA moderna e responsiva em **React 19, TypeScript e Vite**, com navegação por abas acessíveis (WAI-ARIA), validação de formulários em tempo real, mascaramento dinâmico de dados e proxy reverso nativo.
* **Segurança e Negócio:** Imutabilidade estrita de CPF/CNPJ após o cadastro (proteção `DOCUMENTO_PROTEGIDO`), isolamento de endereços por UPSERT, vitrine pública de produtor com telefone comercial e preview imediato.

---

## 👥 Equipe e Responsabilidades

| Integrante | Papel Principal | Contribuições na Sprint 1 |
| :--- | :--- | :--- |
| **Pedro Zin** | Frontend & UX/UI | Interface de usuário, formulários (PF/PJ), perfil, vitrine pública e integração HTTP |
| **Lucas** | Backend & Arquitetura | Estrutura FastAPI, autenticação Argon2id, rotas de sessão e módulo de perfil |
| **Eloise** | Backend & Regras de Negócio | Autorização, validações de negócio, módulo de vendedor e auditoria |
| **Felipe** | Banco de Dados & Modelagem | Modelagem relacional, constraints, migrations PostgreSQL e scripts Windows |
| **Tiago** | Infraestrutura, DevOps & Testes | Containerização Docker, Docker Compose (branch `Exec`), testes e integração |

---

## 🛠️ Tecnologias Utilizadas

* **Linguagens:** TypeScript (Frontend) e Python 3.12+ (Backend)
* **Framework Web Frontend:** React 19 + Vite
* **Framework Web Backend:** FastAPI + Uvicorn + Pydantic v2
* **Banco de Dados:** PostgreSQL 16/18
* **Driver do Banco:** Psycopg 3 (`psycopg[binary,pool]`)
* **Criptografia & Sessão:** Argon2-cffi e tokens de sessão com revogação e auditoria
* **Containerização:** Docker e Docker Compose

---

## 🚀 Como Rodar a Aplicação

Escolha uma das alternativas abaixo de acordo com seu sistema operacional e preferência de ambiente:

---

### Opção 1: Via Docker e Docker Compose (Branch `Exec`) — Universal

A forma mais simples e rápida, recomendada tanto para **Windows**, **Linux** quanto **macOS**. Você não precisa instalar Python, Node.js nem PostgreSQL localmente.

#### Pré-requisitos:
* [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução.

#### Passo a passo:
1. Clone o repositório e acerte para a branch `Exec`:
   ```bash
   git clone https://github.com/zinpedro/SafraDireta.git
   cd SafraDireta
   git checkout Exec
   ```
2. Suba todos os serviços (Banco, Backend e Frontend) com um único comando:
   ```bash
   docker compose up --build
   ```
3. Acesse no navegador:
   * **Frontend:** [http://localhost:5173](http://localhost:5173)
   * **Backend API (Swagger Docs):** [http://localhost:8000/docs](http://localhost:8000/docs)
   * **Healthcheck do Banco:** [http://localhost:8000/health/db](http://localhost:8000/health/db)

---

### Opção 2: No Windows (Ambiente Local)

Para desenvolvedores utilizando Windows nativo, a equipe disponibiliza duas abordagens:

#### Alternativa A: Via WSL 2 / Ubuntu (Altamente Recomendada)
Roda com desempenho nativo Linux dentro do Windows, usando os scripts prontos do repositório:
1. No PowerShell (como Admin), instale o WSL caso ainda não tenha: `wsl --install -d Ubuntu`
2. Abra o terminal do **Ubuntu** e instale as ferramentas:
   ```bash
   sudo apt update && sudo apt install -y postgresql postgresql-contrib python3 python3-venv python3-pip nodejs npm git
   ```
3. Inicie o PostgreSQL e rode a configuração automatizada:
   ```bash
   sudo service postgresql start
   chmod +x backend/setup_banco_local.sh
   ./backend/setup_banco_local.sh
   sudo -u postgres psql -d safradireta < backend/sql/04_atualizacao_perfil_vendedor.sql
   ```
4. Suba o **Backend**:
   ```bash
   cd backend && python3 -m venv .venv && source .venv/bin/activate
   pip install -r conf/requirements.txt -r conf/requirements-dev.txt
   uvicorn app.main:app --reload
   ```
5. Suba o **Frontend** (em outro terminal):
   ```bash
   cd frontend && npm install && npm run dev
   ```
6. Acesse no Chrome/Edge do Windows: [http://localhost:5173](http://localhost:5173).

---

#### Alternativa B: Windows Nativo via PowerShell (Branch `testes/windows`)
A equipe preparou o script automatizado `windows.ps1` para gerenciar o ambiente diretamente no PowerShell do Windows:

1. **Pré-requisitos:** Python 3.12+ (marcar *"Add python.exe to PATH"*), Node.js 22 LTS e PostgreSQL instalado localmente.
2. No PowerShell (como Administrador ou com permissão de execução):
   ```powershell
   # 1. Preparar dependências e ambientes virtuais:
   powershell -NoProfile -ExecutionPolicy Bypass -File .\windows.ps1 preparar

   # 2. Iniciar o Backend (Terminal 1):
   powershell -NoProfile -ExecutionPolicy Bypass -File .\windows.ps1 backend

   # 3. Iniciar o Frontend (Terminal 2):
   powershell -NoProfile -ExecutionPolicy Bypass -File .\windows.ps1 frontend

   # 4. Verificar status das conexões (Terminal 3):
   powershell -NoProfile -ExecutionPolicy Bypass -File .\windows.ps1 verificar
   ```

---

### Opção 3: No Linux / macOS (Manual)

#### 1. Banco de Dados PostgreSQL
Execute o script utilitário para criar o banco `safradireta` e aplicar as migrations:
```bash
chmod +x backend/setup_banco_local.sh
./backend/setup_banco_local.sh
sudo -u postgres psql -d safradireta < backend/sql/04_atualizacao_perfil_vendedor.sql
```

#### 2. Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r conf/requirements.txt
pip install -r conf/requirements-dev.txt
uvicorn app.main:app --reload
```
O backend responderá em `http://127.0.0.1:8000`.

#### 3. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
O frontend responderá em `http://localhost:5173`. O Vite já possui proxy configurado para redirecionar chamadas `/api/*` diretamente para o FastAPI.

---

## 🧪 Testes e Qualidade de Código

### Testes Automatizados do Backend
A suíte de testes unitários e de integração valida o ciclo completo de cadastro, segurança, autenticação e regras de negócio:
```bash
cd backend
pytest tests
```
> **Resultado:** 98 testes automatizados passando em menos de 10 segundos com rollback automático de transações.

### Linter e Build do Frontend
```bash
cd frontend
npm run build
npx oxlint
```
> **Resultado:** Tipagem estrita com TypeScript (`tsc -b`) e 0 erros e 0 warnings no linter (`oxlint`) em todos os componentes.

---

## 🔗 Endereços e Documentação da API

Com a aplicação em execução:
* **Aplicação Web:** [http://localhost:5173](http://localhost:5173)
* **Documentação Interativa Swagger:** [http://localhost:8000/docs](http://localhost:8000/docs)
* **Documentação Redoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **Health Check do Servidor:** [http://localhost:8000/health](http://localhost:8000/health)
* **Health Check do Banco de Dados:** [http://localhost:8000/health/db](http://localhost:8000/health/db)

---

## 📄 Estrutura de Diretórios

```text
SafraDireta/
├── backend/                  # API FastAPI (Python)
│   ├── app/                  # Código-fonte (routers, services, schemas, deps)
│   ├── conf/                 # requirements.txt e dependências
│   ├── sql/                  # Migrations SQL (01 a 04)
│   ├── tests/                # Suíte de 98 testes automatizados
│   └── setup_banco_local.sh  # Script de automação de banco no Linux/WSL
├── frontend/                 # Interface Web React + Vite (TypeScript)
│   ├── src/
│   │   ├── components/       # Componentes compartilhados e acessíveis
│   │   ├── context/          # Gerenciamento de sessão e autenticação
│   │   ├── features/         # Módulos de negócio (login, cadastro, perfil, vendedor)
│   │   └── pages/            # Páginas da aplicação
│   └── vite.config.ts        # Configuração do Vite e proxy reverso para a API
├── docker-compose.yml        # Orquestração de containers (branch Exec)
└── README.md                 # Documentação principal da Sprint 1
```
