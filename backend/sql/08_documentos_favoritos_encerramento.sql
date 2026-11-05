BEGIN;

ALTER TABLE safradireta.anuncio
    DROP CONSTRAINT IF EXISTS anuncio_estado_comercial_check,
    ADD CONSTRAINT anuncio_estado_comercial_check
        CHECK (estado_comercial IN ('RASCUNHO', 'ATIVO', 'PAUSADO', 'VENDIDO', 'CANCELADO')),
    ADD COLUMN IF NOT EXISTS encerrado_em timestamptz,
    ADD COLUMN IF NOT EXISTS motivo_encerramento varchar(80),
    ADD COLUMN IF NOT EXISTS observacoes_encerramento varchar(2000);

UPDATE safradireta.anuncio SET encerrado_em = vendido_em
WHERE estado_comercial = 'VENDIDO' AND encerrado_em IS NULL;

ALTER TABLE safradireta.localizacao_anuncio
    DROP CONSTRAINT IF EXISTS localizacao_anuncio_regiao_check,
    ADD CONSTRAINT localizacao_anuncio_regiao_check
        CHECK (char_length(regiao_publica) <= 120) NOT VALID,
    DROP CONSTRAINT IF EXISTS localizacao_anuncio_anuncio_id_fkey,
    ADD FOREIGN KEY (anuncio_id) REFERENCES safradireta.anuncio(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS safradireta.documento_anuncio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id uuid NOT NULL REFERENCES safradireta.anuncio(id) ON DELETE CASCADE,
    arquivo_id uuid NOT NULL UNIQUE REFERENCES safradireta.arquivo(id),
    tipo text NOT NULL CHECK (tipo IN (
        'GTA', 'LAUDO_SANITARIO', 'REGISTRO_GENEALOGICO', 'LAUDO_CLASSIFICACAO',
        'LAUDO_SCA_CAFE', 'CERTIFICACAO_SUSTENTAVEL', 'NOTA_FISCAL_SEMENTE', 'OUTRO'
    ))
);
CREATE INDEX IF NOT EXISTS ix_documento_anuncio ON safradireta.documento_anuncio (anuncio_id);

CREATE TABLE IF NOT EXISTS safradireta.solicitacao_documento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id uuid NOT NULL REFERENCES safradireta.anuncio(id) ON DELETE CASCADE,
    comprador_id uuid NOT NULL REFERENCES safradireta.conta(id) ON DELETE CASCADE,
    mensagem varchar(2000) NOT NULL CHECK (btrim(mensagem) <> ''),
    status text NOT NULL DEFAULT 'PENDENTE' CHECK (
        status IN ('PENDENTE', 'APROVADO', 'RECUSADO', 'REVOGADO', 'CANCELADO')
    ),
    solicitada_em timestamptz NOT NULL DEFAULT now(),
    respondida_em timestamptz,
    motivo_recusa varchar(500)
);
CREATE INDEX IF NOT EXISTS ix_solicitacao_documento_anuncio
    ON safradireta.solicitacao_documento (anuncio_id, comprador_id, solicitada_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitacao_documento_ativa
    ON safradireta.solicitacao_documento (anuncio_id, comprador_id)
    WHERE status IN ('PENDENTE', 'APROVADO');

CREATE TABLE IF NOT EXISTS safradireta.favorito (
    usuario_id uuid NOT NULL REFERENCES safradireta.conta(id) ON DELETE CASCADE,
    anuncio_id uuid NOT NULL REFERENCES safradireta.anuncio(id) ON DELETE CASCADE,
    adicionado_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, anuncio_id)
);
CREATE INDEX IF NOT EXISTS ix_favorito_anuncio ON safradireta.favorito (anuncio_id);
CREATE INDEX IF NOT EXISTS ix_favorito_usuario_data
    ON safradireta.favorito (usuario_id, adicionado_em DESC, anuncio_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'safra_app') THEN
        GRANT SELECT, INSERT ON safradireta.documento_anuncio TO safra_app;
        GRANT SELECT, INSERT, UPDATE ON safradireta.solicitacao_documento TO safra_app;
        GRANT SELECT, INSERT, DELETE ON safradireta.favorito TO safra_app;
    END IF;
END
$$;

COMMIT;
