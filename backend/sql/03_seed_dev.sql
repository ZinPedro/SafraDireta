-- Dados de teste para DESENVOLVIMENTO LOCAL. Nao rodar em producao.
-- Executar como dono do banco (safra_app nao pode inserir nestas tabelas).

INSERT INTO safradireta.termo_uso (versao, referencia_conteudo, hash_conteudo, vigente_desde)
SELECT '1.0', 'termos/v1.0.md',
       encode(sha256('termo de uso v1.0 (desenvolvimento)'::bytea), 'hex'),
       now()
WHERE NOT EXISTS (SELECT 1 FROM safradireta.termo_uso WHERE versao = '1.0');

INSERT INTO safradireta.operador_administrativo (nome, identidade_autenticacao, pode_analisar)
SELECT 'Operador de Teste', 'operador.teste@local', true
WHERE NOT EXISTS (
    SELECT 1 FROM safradireta.operador_administrativo
    WHERE identidade_autenticacao = 'operador.teste@local'
);