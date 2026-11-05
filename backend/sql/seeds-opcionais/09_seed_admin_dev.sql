BEGIN;

-- Conta Administrador de testes
-- UUID fixo para facilitar consultas no ambiente de desenvolvimento
INSERT INTO safradireta.conta (
    id, 
    tipo, 
    email_acesso, 
    senha_hash, 
    telefone_recuperacao, 
    estado, 
    nome_publico, 
    pin_hash
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'ADMIN',
    'admin@safradireta.com',
    -- Hash reais do Argon2 para a senha 'admin123'
    '$argon2id$v=19$m=65536,t=3,p=4$BhjAjST8bpICDmpKSCG/Sw$KWob10DqohZPhIfLje/xgSgTYs4HZS2kzeK5lAYfBsA',
    '11999999999',
    'ATIVA',
    'Admin Safra Direta',
    -- Hash reais do Argon2 para o PIN '123456'
    '$argon2id$v=19$m=65536,t=3,p=4$2PTp/YnXR2ZU1uCTDpnd6g$BX+Xja73SPLVL7Qh4ZYTwMFLxuBRtNvmhUDzvVXNnlk'
) ON CONFLICT (email_acesso) DO NOTHING;

-- Sistema também tem uma tabela operador_administrativo (presente no 01_estrutura.sql),
-- Então insere o registo correspondente para manter a integridade, caso o backend valide por lá também:
INSERT INTO safradireta.operador_administrativo (
    id,
    nome,
    identidade_autenticacao,
    ativo,
    pode_analisar
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Admin Safra Direta',
    'admin@safradireta.com',
    true,
    true
) ON CONFLICT (identidade_autenticacao) DO NOTHING;

COMMIT;