#!/usr/bin/env bash
set -e

echo "=== Configuração do Banco Local SafraDireta (PostgreSQL) ==="

DB_NAME="safradireta"
DB_USER="safra_app"
DB_PASS="safra_dev_123"
DB_PORT="5432"

# 1. Verificar se o PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL não encontrado. Instalando via apt..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl enable --now postgresql
fi

echo "Garantindo que o serviço PostgreSQL esteja ativo..."
sudo systemctl start postgresql

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$DIR/sql"

echo "1/4: Criando/Atualizando usuário '$DB_USER' e banco '$DB_NAME'..."
sudo -u postgres psql <<EOSQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
        CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';
    ELSE
        ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASS';
    END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB_NAME WITH OWNER postgres ENCODING UTF8'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
EOSQL

echo "2/4: Aplicando estrutura de tabelas (01_estrutura.sql)..."
sudo -u postgres psql -d "$DB_NAME" < "$SQL_DIR/01_estrutura.sql" > /dev/null

echo "3/4: Configurando permissões do usuário de aplicação (02_permissoes.sql)..."
sudo -u postgres psql -d "$DB_NAME" < "$SQL_DIR/02_permissoes.sql" > /dev/null

echo "4/4: Aplicando dados iniciais de desenvolvimento (03_seed_dev.sql)..."
sudo -u postgres psql -d "$DB_NAME" < "$SQL_DIR/03_seed_dev.sql" > /dev/null

# Criar ou atualizar backend/.env
ENV_FILE="$DIR/.env"
cat <<EOF > "$ENV_FILE"
PGHOST=127.0.0.1
PGPORT=$DB_PORT
PGDATABASE=$DB_NAME
PGUSER=$DB_USER
PGPASSWORD=$DB_PASS
PGSSLMODE=prefer
CORS_ORIGINS=http://localhost:5173
SESSAO_HORAS=12
EOF

echo ""
echo "=== Sucesso! ==="
echo "Banco '$DB_NAME' configurado e arquivo '.env' gerado com sucesso!"
echo "Usuário: $DB_USER | Porta: $DB_PORT"
