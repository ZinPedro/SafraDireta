-- Sprint 3, alinhamento de 03/11/2026. Base: branch Exec, migrations 01 a 08.
-- Executar UMA vez como proprietario, com parada em erro. Nao executar o seed 09.
-- Sem triggers: autorizacao, revogacao e demais regras de negocio ficam na API.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = safradireta, public, pg_catalog;

ALTER TABLE safradireta.anuncio
    ADD COLUMN encerrado_em timestamptz,
    ADD COLUMN motivo_encerramento text,
    ADD COLUMN observacoes_encerramento text;
ALTER TABLE safradireta.anuncio DROP CONSTRAINT anuncio_estado_comercial_check;
ALTER TABLE safradireta.anuncio ADD CONSTRAINT anuncio_estado_comercial_check
    CHECK (estado_comercial IN ('RASCUNHO','ATIVO','PAUSADO','VENDIDO','CANCELADO'));
-- Permite cancelar um rascunho que nunca teve preco/publicacao.
ALTER TABLE safradireta.anuncio DROP CONSTRAINT anuncio_check1;
ALTER TABLE safradireta.anuncio ADD CONSTRAINT anuncio_publicacao_check
    CHECK (estado_comercial IN ('RASCUNHO','CANCELADO')
           OR (preco_lote IS NOT NULL AND publicado_em IS NOT NULL));
-- Preserva vendido_em e origem_encerramento (MANUAL/PEDIDO) para compatibilidade.
-- O novo motivo operacional e independente da origem tecnica.
UPDATE safradireta.anuncio SET encerrado_em = vendido_em
    WHERE estado_comercial = 'VENDIDO';

-- Reutiliza a localizacao do LOTE; nao copia o endereco da conta do vendedor.
ALTER TABLE safradireta.localizacao_anuncio
    ADD CONSTRAINT localizacao_regiao_sprint3_check
        CHECK (char_length(regiao_publica) <= 120),
    ADD CONSTRAINT localizacao_uf_sprint3_check
        CHECK (uf_publica IN ('AC','AL','AP','AM','BA','CE','DF','ES','GO',
            'MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS',
            'RO','RR','SC','SP','SE','TO'));

CREATE TABLE safradireta.favorito_anuncio (
    conta_id uuid NOT NULL REFERENCES safradireta.conta(id) ON DELETE CASCADE,
    anuncio_id uuid NOT NULL REFERENCES safradireta.anuncio(id) ON DELETE CASCADE,
    criado_em timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (conta_id, anuncio_id)
);
CREATE INDEX ix_favorito_anuncio ON safradireta.favorito_anuncio(anuncio_id);
CREATE INDEX ix_favorito_conta_data
    ON safradireta.favorito_anuncio(conta_id, criado_em DESC, anuncio_id);

-- Nome, tamanho, MIME, chave privada e SHA-256 reutilizam a tabela arquivo.
-- A API deve exigir checksum SHA-256 e validar conteudo/10 MB antes do INSERT.
CREATE TABLE safradireta.documento_anuncio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id uuid NOT NULL REFERENCES safradireta.anuncio(id) ON DELETE CASCADE,
    arquivo_id uuid NOT NULL REFERENCES safradireta.arquivo(id),
    tipo text NOT NULL CHECK (tipo IN ('GTA','LAUDO_SANITARIO',
        'REGISTRO_GENEALOGICO','LAUDO_CLASSIFICACAO','LAUDO_SCA_CAFE',
        'CERTIFICACAO_SUSTENTAVEL','NOTA_FISCAL_SEMENTE','OUTRO')),
    criado_em timestamptz NOT NULL DEFAULT now(),
    UNIQUE (anuncio_id, arquivo_id)
);
CREATE INDEX ix_s3_documento_arquivo ON safradireta.documento_anuncio(arquivo_id);

CREATE TABLE safradireta.solicitacao_documento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id uuid NOT NULL REFERENCES safradireta.anuncio(id) ON DELETE CASCADE,
    comprador_id uuid NOT NULL REFERENCES safradireta.conta(id) ON DELETE CASCADE,
    mensagem text NOT NULL CHECK (btrim(mensagem) <> ''),
    status text NOT NULL DEFAULT 'PENDENTE'
        CHECK (status IN ('PENDENTE','APROVADO','RECUSADO','REVOGADO','CANCELADO')),
    solicitado_em timestamptz NOT NULL DEFAULT now(),
    respondido_em timestamptz,
    respondido_por uuid REFERENCES safradireta.conta(id) ON DELETE SET NULL,
    motivo_recusa text,
    atualizado_em timestamptz NOT NULL DEFAULT now()
);
-- Historico preservado; no maximo uma solicitacao pendente/aprovada por comprador/lote.
CREATE UNIQUE INDEX uq_solicitacao_documento_ativa
    ON safradireta.solicitacao_documento(comprador_id, anuncio_id)
    WHERE status IN ('PENDENTE','APROVADO');
CREATE INDEX ix_solicitacao_anuncio_status
    ON safradireta.solicitacao_documento(anuncio_id, status, solicitado_em DESC);
CREATE INDEX ix_solicitacao_respondente
    ON safradireta.solicitacao_documento(respondido_por);

-- Os campos canonicos existentes evitam valores duplicados e divergentes.
CREATE INDEX ix_s3_catalogo_preco ON safradireta.anuncio(preco_lote, id)
    WHERE estado_comercial = 'ATIVO' AND estado_moderacao = 'LIBERADO';
CREATE INDEX ix_s3_catalogo_peso ON safradireta.anuncio(peso_total_kg DESC, id)
    WHERE estado_comercial = 'ATIVO' AND estado_moderacao = 'LIBERADO';
CREATE INDEX ix_s3_catalogo_data ON safradireta.anuncio(publicado_em DESC, id)
    WHERE estado_comercial = 'ATIVO' AND estado_moderacao = 'LIBERADO';
CREATE INDEX ix_s3_animal_peso ON safradireta.lote_animal(peso_medio_kg, anuncio_id);
CREATE INDEX ix_s3_animal_cabecas ON safradireta.lote_animal(quantidade_animais, anuncio_id);
CREATE INDEX ix_s3_agricola_volume ON safradireta.lote_agricola(quantidade, anuncio_id);
CREATE INDEX ix_s3_agricola_cultura ON safradireta.lote_agricola(cultura, anuncio_id);

-- Busca sem acentos: a API deve usar a MESMA expressao e normalizar o termo.
-- Trigramas ajudam substring/similaridade; nao implementam fonetica portuguesa.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE INDEX ix_s3_anuncio_texto ON safradireta.anuncio USING gin
    (translate(lower(coalesce(titulo,'') || ' ' || coalesce(descricao,'')),
        'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') public.gin_trgm_ops);
CREATE INDEX ix_s3_localizacao_texto ON safradireta.localizacao_anuncio USING gin
    (translate(lower(coalesce(municipio_publico,'') || ' ' || coalesce(uf_publica,'')
        || ' ' || coalesce(regiao_publica,'')),
        'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') public.gin_trgm_ops);

GRANT SELECT, INSERT, DELETE ON safradireta.favorito_anuncio TO safra_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON safradireta.documento_anuncio TO safra_app;
GRANT SELECT, INSERT, UPDATE ON safradireta.solicitacao_documento TO safra_app;
GRANT SELECT, INSERT, UPDATE ON safradireta.arquivo TO safra_app;
GRANT SELECT, UPDATE ON safradireta.anuncio TO safra_app;
COMMIT;

