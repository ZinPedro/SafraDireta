-- =============================================================================
-- Migration 05: Anuncios (Sprint 2)
-- Base: SafraDireta-Modelagem-Banco-de-Dados.pdf, tabelas 18 a 23 e 26.
-- Cria: categoria, produto, unidade_medida, anuncio, lote_animal,
--       lote_agricola e midia_anuncio. A tabela arquivo ja existe.
-- Sem triggers: as regras de publicacao ficam no backend.
-- Pode ser rodada mais de uma vez sem erro.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS safradireta.categoria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    grupo text NOT NULL CHECK (grupo IN ('ANIMAIS', 'GRAOS', 'CAFE')),
    ativa boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS safradireta.produto (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id uuid NOT NULL REFERENCES safradireta.categoria(id),
    nome text NOT NULL,
    UNIQUE (categoria_id, nome)
);

CREATE TABLE IF NOT EXISTS safradireta.unidade_medida (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo text NOT NULL UNIQUE,
    descricao text NOT NULL,
    dimensao text NOT NULL CHECK (dimensao IN ('MASSA', 'CONTAGEM')),
    fator_base numeric(18,6) CHECK (fator_base > 0),
    unidade_base_id uuid REFERENCES safradireta.unidade_medida(id),
    CHECK (unidade_base_id IS DISTINCT FROM id)
);

CREATE TABLE IF NOT EXISTS safradireta.anuncio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id uuid NOT NULL REFERENCES safradireta.habilitacao_vendedor(conta_id),
    produto_id uuid NOT NULL REFERENCES safradireta.produto(id),
    titulo text NOT NULL CHECK (btrim(titulo) <> ''),
    descricao text,
    preco_lote numeric(18,2) CHECK (preco_lote > 0),
    moeda varchar(3) NOT NULL DEFAULT 'BRL' CHECK (moeda = 'BRL'),
    peso_total_kg numeric(18,3) CHECK (peso_total_kg > 0),
    estado_comercial text NOT NULL DEFAULT 'RASCUNHO'
        CHECK (estado_comercial IN ('RASCUNHO', 'ATIVO', 'PAUSADO', 'VENDIDO')),
    estado_moderacao text NOT NULL DEFAULT 'LIBERADO'
        CHECK (estado_moderacao IN ('LIBERADO', 'BLOQUEADO')),
    telefone_publico text,
    anuncio_origem_id uuid REFERENCES safradireta.anuncio(id),
    versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    publicado_em timestamptz,
    vendido_em timestamptz,
    origem_encerramento text CHECK (origem_encerramento IN ('MANUAL', 'PEDIDO')),
    UNIQUE (id, vendedor_id),
    CHECK (anuncio_origem_id IS DISTINCT FROM id),
    CHECK (estado_comercial = 'RASCUNHO'
           OR (preco_lote IS NOT NULL AND publicado_em IS NOT NULL)),
    CHECK ((estado_comercial = 'VENDIDO') = (vendido_em IS NOT NULL)),
    CHECK ((estado_comercial = 'VENDIDO') = (origem_encerramento IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS safradireta.lote_animal (
    anuncio_id uuid PRIMARY KEY REFERENCES safradireta.anuncio(id),
    quantidade_animais integer NOT NULL CHECK (quantidade_animais > 0),
    raca text,
    sexo_lote text,
    idade_media_meses numeric(8,2) CHECK (idade_media_meses >= 0),
    observacoes text
);

CREATE TABLE IF NOT EXISTS safradireta.lote_agricola (
    anuncio_id uuid PRIMARY KEY REFERENCES safradireta.anuncio(id),
    quantidade numeric(18,3) NOT NULL CHECK (quantidade > 0),
    unidade_id uuid NOT NULL REFERENCES safradireta.unidade_medida(id),
    safra text,
    variedade text,
    classificacao text,
    umidade_percentual numeric(5,2) CHECK (umidade_percentual BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS safradireta.midia_anuncio (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    anuncio_id uuid NOT NULL REFERENCES safradireta.anuncio(id),
    arquivo_id uuid NOT NULL REFERENCES safradireta.arquivo(id),
    tipo text NOT NULL CHECK (tipo IN ('FOTO', 'VIDEO')),
    ordem integer NOT NULL CHECK (ordem >= 0),
    capa boolean NOT NULL DEFAULT false,
    UNIQUE (anuncio_id, ordem),
    UNIQUE (anuncio_id, arquivo_id)
);

-- Indices (secao 8 da modelagem)
CREATE UNIQUE INDEX IF NOT EXISTS uq_midia_capa
    ON safradireta.midia_anuncio (anuncio_id) WHERE capa;
CREATE INDEX IF NOT EXISTS ix_anuncio_catalogo
    ON safradireta.anuncio (estado_comercial, estado_moderacao, publicado_em, id);
CREATE INDEX IF NOT EXISTS ix_anuncio_produto
    ON safradireta.anuncio (produto_id, estado_comercial, preco_lote);
CREATE INDEX IF NOT EXISTS ix_anuncio_vendedor
    ON safradireta.anuncio (vendedor_id);

-- Permissoes da aplicacao (so se o papel safra_app existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'safra_app') THEN
        GRANT SELECT ON safradireta.categoria, safradireta.produto,
            safradireta.unidade_medida, safradireta.anuncio,
            safradireta.lote_animal, safradireta.lote_agricola,
            safradireta.midia_anuncio TO safra_app;
        GRANT INSERT, UPDATE ON safradireta.anuncio, safradireta.lote_animal,
            safradireta.lote_agricola, safradireta.midia_anuncio TO safra_app;
    END IF;
END
$$;

COMMIT;
