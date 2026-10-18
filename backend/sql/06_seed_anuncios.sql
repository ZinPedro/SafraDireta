-- =============================================================================
-- Seed 06: dados iniciais de categorias, produtos e unidades (Sprint 2)
-- PROVISORIO: valores de desenvolvimento, a confirmar com o grupo e o cliente.
-- Rodar como dono do banco, depois da migration 05. Pode ser repetido.
-- =============================================================================

BEGIN;

INSERT INTO safradireta.categoria (nome, grupo) VALUES
    ('Boi gordo', 'ANIMAIS'),
    ('Soja', 'GRAOS'),
    ('Milho', 'GRAOS'),
    ('Cafe', 'CAFE')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO safradireta.produto (categoria_id, nome)
SELECT c.id, p.nome
FROM (VALUES
    ('Boi gordo', 'Boi gordo'),
    ('Soja', 'Soja em grao'),
    ('Milho', 'Milho em grao'),
    ('Cafe', 'Cafe arabica'),
    ('Cafe', 'Cafe conilon')
) AS p(categoria, nome)
JOIN safradireta.categoria c ON c.nome = p.categoria
ON CONFLICT (categoria_id, nome) DO NOTHING;

INSERT INTO safradireta.unidade_medida (codigo, descricao, dimensao, fator_base)
VALUES ('KG', 'Quilograma', 'MASSA', 1)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO safradireta.unidade_medida (codigo, descricao, dimensao, fator_base, unidade_base_id)
SELECT v.codigo, v.descricao, 'MASSA', v.fator, kg.id
FROM (VALUES
    ('TON', 'Tonelada', 1000),
    ('SACA_60KG', 'Saca de 60 kg', 60)
) AS v(codigo, descricao, fator)
CROSS JOIN safradireta.unidade_medida kg
WHERE kg.codigo = 'KG'
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO safradireta.unidade_medida (codigo, descricao, dimensao)
VALUES ('CABECA', 'Cabeca de gado', 'CONTAGEM')
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
