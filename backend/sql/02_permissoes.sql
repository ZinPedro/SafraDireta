BEGIN;
REVOKE ALL ON DATABASE safradireta FROM PUBLIC;
GRANT CONNECT ON DATABASE safradireta TO safra_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA safradireta TO safra_app;
GRANT SELECT ON ALL TABLES IN SCHEMA safradireta TO safra_app;
GRANT INSERT, UPDATE ON safradireta.conta, safradireta.perfil_pf,
    safradireta.empresa, safradireta.representante_empresa, safradireta.endereco,
    safradireta.sessao, safradireta.arquivo, safradireta.verificacao,
    safradireta.documento_verificacao, safradireta.habilitacao_vendedor,
    safradireta.alteracao_cadastral TO safra_app;
GRANT INSERT ON safradireta.aceite_termos, safradireta.evento_auditoria TO safra_app;
ALTER ROLE safra_app IN DATABASE safradireta SET search_path = safradireta, pg_catalog;
COMMIT;
