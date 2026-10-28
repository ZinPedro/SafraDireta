BEGIN;

-- CONTA E AUTENTICAÇÃO ADMINISTRATIVA
-- Expande o tipo da conta para suportar 'ADMIN' (era varchar(2))
ALTER TABLE safradireta.conta 
    ALTER COLUMN tipo TYPE character varying(10);

-- Adiciona PIN criptografado para a conta Admin
ALTER TABLE safradireta.conta 
    ADD COLUMN IF NOT EXISTS pin_hash text;

COMMENT ON COLUMN safradireta.conta.pin_hash IS 'Hash do PIN de 6 dígitos. Exclusivo para contas ADMIN.';


-- DADOS DE GOVERNANÇA E AUDITORIA NA HABILITAÇÃO DO VENDEDOR
-- Adiciona estados BANIDO e SUSPENSO, dados de prazo, auditoria e contestação
ALTER TABLE safradireta.habilitacao_vendedor 
    ADD COLUMN IF NOT EXISTS motivo_punicao text,
    ADD COLUMN IF NOT EXISTS prazo_suspensao_dias integer,
    ADD COLUMN IF NOT EXISTS suspenso_ate timestamp with time zone,
    ADD COLUMN IF NOT EXISTS banido_em timestamp with time zone,
    
    -- Controle de Auditoria Interna (Exclusivo do Admin)
    ADD COLUMN IF NOT EXISTS revisado_pelo_admin boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS auditado_em timestamp with time zone,
    ADD COLUMN IF NOT EXISTS auditado_por uuid REFERENCES safradireta.conta(id),
    ADD COLUMN IF NOT EXISTS observacoes_auditoria text;


-- HISTÓRICO DE PUNIÇÕES (GOVERNANÇA)
CREATE TABLE IF NOT EXISTS safradireta.historico_punicao (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    conta_id uuid NOT NULL REFERENCES safradireta.conta(id),
    tipo text NOT NULL, -- SUSPENSAO, BANIMENTO, REATIVACAO, CONTESTACAO_ACEITA, CONTESTACAO_NEGADA
    motivo text NOT NULL,
    prazo_dias integer,
    suspenso_ate timestamp with time zone,
    autor_id uuid NOT NULL REFERENCES safradireta.conta(id),
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_historico_punicao_conta ON safradireta.historico_punicao(conta_id, criado_em);


-- CONTESTAÇÃO DE SUSPENSÃO/BANIMENTO
CREATE TABLE IF NOT EXISTS safradireta.contestacao_vendedor (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    conta_id uuid NOT NULL REFERENCES safradireta.conta(id),
    texto_defesa text NOT NULL,
    arquivo_anexo_id uuid REFERENCES safradireta.arquivo(id),
    estado text DEFAULT 'PENDENTE'::text NOT NULL, -- PENDENTE, ACEITA, NEGADA
    resposta_admin text,
    analisado_por uuid REFERENCES safradireta.conta(id),
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    analisado_em timestamp with time zone
);

CREATE INDEX IF NOT EXISTS ix_contestacao_vendedor_conta ON safradireta.contestacao_vendedor(conta_id);


-- TROCA DE REPRESENTANTE LEGAL (EMPRESAS PJ)
CREATE TABLE IF NOT EXISTS safradireta.solicitacao_troca_representante (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES safradireta.empresa(conta_id),
    novo_nome text NOT NULL,
    novo_cpf character varying(11) NOT NULL,
    novo_vinculo text NOT NULL,
    tipo_comprovacao text NOT NULL, -- ATA_ELEICAO, ALTERACAO_CONTRATUAL, PROCURACAO_PUBLICA
    termo_aceito boolean DEFAULT true NOT NULL,
    estado text DEFAULT 'PENDENTE'::text NOT NULL, -- PENDENTE, HOMOLOGADA, INDEFERIDA
    motivo_indeferimento text,
    parecer_admin text,
    analisado_por uuid REFERENCES safradireta.conta(id),
    solicitado_em timestamp with time zone DEFAULT now() NOT NULL,
    analisado_em timestamp with time zone
);

-- Impede que exista mais de uma solicitação de troca pendente para a mesma empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_troca_representante_pendente 
    ON safradireta.solicitacao_troca_representante (empresa_id) 
    WHERE (estado = 'PENDENTE');


-- ATUALIZAÇÕES EM DOCUMENTOS E STATUS DE ANÚNCIOS
-- Adiciona campos de versionamento e estado refinado na tabela de documentos
ALTER TABLE safradireta.documento_verificacao
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'EM_ANALISE'::text NOT NULL, -- VALIDADO, RECUSADO, EM_REANALISE
    ADD COLUMN IF NOT EXISTS motivo_recusa text,
    ADD COLUMN IF NOT EXISTS is_nova_versao boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS atualizado_em timestamp with time zone DEFAULT now() NOT NULL;

COMMIT;