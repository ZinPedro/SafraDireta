-- =============================================================================
-- Migration 04: Atualização de Perfil, Documentos e Vitrine de Vendedor
-- Autor: Felipe (Database) / Proposta: Pedro (Frontend)
-- Data: 2026-10-08
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. FOTO DE PERFIL E LOGOTIPO DA EMPRESA
-- -----------------------------------------------------------------------------
ALTER TABLE safradireta.perfil_pf
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) NULL;

COMMENT ON COLUMN safradireta.perfil_pf.avatar_url IS 
    'URL pública da foto de perfil do usuário (ou chave do storage).';

ALTER TABLE safradireta.empresa
    ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500) NULL;

COMMENT ON COLUMN safradireta.empresa.logo_url IS 
    'URL pública do logotipo da empresa compradora/vendedora.';

-- -----------------------------------------------------------------------------
-- 2. VÍNCULO DE VERIFICAÇÃO E DOCUMENTOS NA HABILITAÇÃO DO VENDEDOR
-- -----------------------------------------------------------------------------
ALTER TABLE safradireta.habilitacao_vendedor
    ADD COLUMN IF NOT EXISTS verificacao_id UUID NULL 
    REFERENCES safradireta.verificacao(id);

COMMENT ON COLUMN safradireta.habilitacao_vendedor.verificacao_id IS 
    'Vínculo com o protocolo de verificação documental (RG frente/verso, CAR, etc.).';

-- -----------------------------------------------------------------------------
-- 3. DADOS DO PRODUTOR RURAL, CAR E SELO DE VERIFICAÇÃO
-- -----------------------------------------------------------------------------
ALTER TABLE safradireta.habilitacao_vendedor
    ADD COLUMN IF NOT EXISTS numero_car VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS inscricao_estadual_produtor VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS possui_selo_verificado BOOLEAN DEFAULT FALSE NOT NULL;

COMMENT ON COLUMN safradireta.habilitacao_vendedor.numero_car IS 
    'Número de registro do Cadastro Ambiental Rural (opcional na habilitação).';
COMMENT ON COLUMN safradireta.habilitacao_vendedor.inscricao_estadual_produtor IS 
    'Inscrição Estadual de produtor rural pessoa física.';
COMMENT ON COLUMN safradireta.habilitacao_vendedor.possui_selo_verificado IS 
    'Selo verde de produtor verificado após auditoria documental (US-040).';

-- -----------------------------------------------------------------------------
-- 4. VITRINE COMERCIAL DO VENDEDOR (US-008 / US-004)
-- -----------------------------------------------------------------------------
ALTER TABLE safradireta.habilitacao_vendedor
    ADD COLUMN IF NOT EXISTS nome_propriedade VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS municipio VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS uf VARCHAR(2) NULL,
    ADD COLUMN IF NOT EXISTS bio TEXT NULL,
    ADD COLUMN IF NOT EXISTS telefone_comercial VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS categorias TEXT[] DEFAULT '{}'::TEXT[] NOT NULL;

COMMENT ON COLUMN safradireta.habilitacao_vendedor.nome_propriedade IS 
    'Nome fantasia da fazenda ou propriedade produtora.';
COMMENT ON COLUMN safradireta.habilitacao_vendedor.municipio IS 
    'Cidade de localização da colheita/rebanho (base para logística e busca).';
COMMENT ON COLUMN safradireta.habilitacao_vendedor.uf IS 
    'Sigla do estado da propriedade produtora.';
COMMENT ON COLUMN safradireta.habilitacao_vendedor.bio IS 
    'Apresentação pública da propriedade para compradores (máx. 500 caracteres).';
COMMENT ON COLUMN safradireta.habilitacao_vendedor.telefone_comercial IS 
    'Telefone/WhatsApp público de negociação exibido na vitrine.';
COMMENT ON COLUMN safradireta.habilitacao_vendedor.categorias IS 
    'Culturas produzidas (ex: cafe, boi_gordo, soja, milho).';

-- -----------------------------------------------------------------------------
-- 5. CONSTRAINTS DE INTEGRIDADE E UNICIDADE
-- -----------------------------------------------------------------------------

-- 5.1. Unicidade de CPF em perfil_pf (ignora nulos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_perfil_pf_cpf 
    ON safradireta.perfil_pf (cpf) 
    WHERE cpf IS NOT NULL;

-- 5.2. Validação estrutural de UF no endereço
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_endereco_uf'
    ) THEN
        ALTER TABLE safradireta.endereco
            ADD CONSTRAINT chk_endereco_uf 
            CHECK (uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
                          'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
                          'RS','RO','RR','SC','SP','SE','TO'));
    END IF;
END $$;

-- 5.3. Validação estrutural de CEP numérico no endereço
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_endereco_cep'
    ) THEN
        ALTER TABLE safradireta.endereco
            ADD CONSTRAINT chk_endereco_cep 
            CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$');
    END IF;
END $$;

-- 5.4. Validação de UF na propriedade do vendedor
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_habilitacao_vendedor_uf'
    ) THEN
        ALTER TABLE safradireta.habilitacao_vendedor
            ADD CONSTRAINT chk_habilitacao_vendedor_uf 
            CHECK (uf IS NULL OR uf IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
                                       'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
                                       'RS','RO','RR','SC','SP','SE','TO'));
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. ÍNDICES DE PERFORMANCE PARA O MARKETPLACE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_habilitacao_vendedor_estado 
    ON safradireta.habilitacao_vendedor (estado);

CREATE INDEX IF NOT EXISTS idx_habilitacao_vendedor_localizacao 
    ON safradireta.habilitacao_vendedor (uf, municipio);

CREATE INDEX IF NOT EXISTS idx_habilitacao_vendedor_categorias 
    ON safradireta.habilitacao_vendedor USING GIN (categorias);

COMMIT;
