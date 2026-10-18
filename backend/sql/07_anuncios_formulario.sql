-- =============================================================================
-- Migration 07: campos do formulario de anuncio definidos pelo front (Sprint 2)
-- Acrescenta colunas em anuncio, lote_animal e lote_agricola e cria a tabela
-- localizacao_anuncio (tabela 24 da modelagem). Rodar depois da 05 e da 06.
-- Pode ser rodada mais de uma vez sem erro. Nao apaga nem altera dados existentes.
-- =============================================================================

BEGIN;

-- Como o vendedor digitou o preco: total, por cabeca ou por saca (o valor oficial e preco_lote)
ALTER TABLE safradireta.anuncio
    ADD COLUMN IF NOT EXISTS modo_preco text NOT NULL DEFAULT 'TOTAL';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'anuncio_modo_preco_check') THEN
        ALTER TABLE safradireta.anuncio ADD CONSTRAINT anuncio_modo_preco_check
            CHECK (modo_preco IN ('TOTAL', 'PER_HEAD', 'PER_SACK'));
    END IF;
END
$$;

-- Animais
ALTER TABLE safradireta.lote_animal
    ADD COLUMN IF NOT EXISTS especie text,
    ADD COLUMN IF NOT EXISTS finalidade text,
    ADD COLUMN IF NOT EXISTS peso_medio_kg numeric(18,3) CHECK (peso_medio_kg > 0),
    ADD COLUMN IF NOT EXISTS raca_personalizada text;

-- Graos e cafe (quantidade guarda as sacas; laudo_tecnico guarda as especificacoes por cultura)
ALTER TABLE safradireta.lote_agricola
    ADD COLUMN IF NOT EXISTS cultura text,
    ADD COLUMN IF NOT EXISTS cultura_personalizada text,
    ADD COLUMN IF NOT EXISTS subtipo text,
    ADD COLUMN IF NOT EXISTS subtipo_personalizado text,
    ADD COLUMN IF NOT EXISTS embalagem text,
    ADD COLUMN IF NOT EXISTS laudo_tecnico jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Localizacao publica do anuncio (cidade e UF; o restante fica para as historias de distancia)
CREATE TABLE IF NOT EXISTS safradireta.localizacao_anuncio (
    anuncio_id uuid PRIMARY KEY REFERENCES safradireta.anuncio(id),
    regiao_publica text,
    municipio_publico text,
    uf_publica varchar(2),
    latitude_publica numeric(9,6) CHECK (latitude_publica BETWEEN -90 AND 90),
    longitude_publica numeric(9,6) CHECK (longitude_publica BETWEEN -180 AND 180),
    precisao_publica_metros integer CHECK (precisao_publica_metros > 0),
    endereco_retirada_id uuid REFERENCES safradireta.endereco(id),
    CHECK ((latitude_publica IS NULL) = (longitude_publica IS NULL)),
    CHECK (latitude_publica IS NULL OR precisao_publica_metros IS NOT NULL)
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'safra_app') THEN
        GRANT SELECT, INSERT, UPDATE ON safradireta.localizacao_anuncio TO safra_app;
    END IF;
END
$$;

COMMIT;
