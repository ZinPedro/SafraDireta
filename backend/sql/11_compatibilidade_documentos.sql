BEGIN;

-- Bancos locais que receberam a antiga 08 de documentos mantêm os dados.
DO $$
BEGIN
    IF to_regclass('safradireta.favorito_anuncio') IS NULL
       AND to_regclass('safradireta.favorito') IS NOT NULL THEN
        ALTER TABLE safradireta.favorito RENAME TO favorito_anuncio;
        ALTER TABLE safradireta.favorito_anuncio RENAME COLUMN usuario_id TO conta_id;
        ALTER TABLE safradireta.favorito_anuncio RENAME COLUMN adicionado_em TO criado_em;
        ALTER TABLE safradireta.solicitacao_documento RENAME COLUMN solicitada_em TO solicitado_em;
        ALTER TABLE safradireta.solicitacao_documento RENAME COLUMN respondida_em TO respondido_em;
        ALTER TABLE safradireta.solicitacao_documento
            ADD COLUMN respondido_por uuid REFERENCES safradireta.conta(id) ON DELETE SET NULL,
            ADD COLUMN atualizado_em timestamptz;
        UPDATE safradireta.solicitacao_documento
            SET atualizado_em = COALESCE(respondido_em, solicitado_em);
        ALTER TABLE safradireta.solicitacao_documento
            ALTER COLUMN atualizado_em SET NOT NULL,
            ALTER COLUMN atualizado_em SET DEFAULT now();
    END IF;
END
$$;

ALTER TABLE safradireta.documento_anuncio
    DROP CONSTRAINT documento_anuncio_tipo_check,
    ADD CONSTRAINT documento_anuncio_tipo_check CHECK (tipo IN (
        'GTA', 'LAUDO_SANITARIO', 'REGISTRO_GENEALOGICO', 'LAUDO_CLASSIFICACAO',
        'LAUDO_SCA_CAFE', 'CERTIFICACAO_SUSTENTAVEL', 'NOTA_FISCAL_SEMENTE',
        'EXAME_ANDROLOGICO', 'OUTRO'
    ));

COMMIT;
