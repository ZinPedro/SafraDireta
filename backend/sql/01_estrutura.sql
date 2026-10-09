-- SafraDireta / Sprint 1 / estrutura consolidada apos migration 08.
-- PostgreSQL 18. Execute SOMENTE em banco vazio; nao altera banco existente.
BEGIN;
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: safradireta; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA safradireta;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aceite_termos; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.aceite_termos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conta_id uuid NOT NULL,
    termo_id uuid NOT NULL,
    sessao_id uuid,
    aceito_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: alteracao_cadastral; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.alteracao_cadastral (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conta_id uuid NOT NULL,
    tipo text NOT NULL,
    dados_anteriores jsonb NOT NULL,
    dados_propostos jsonb NOT NULL,
    verificacao_id uuid NOT NULL,
    solicitada_em timestamp with time zone DEFAULT now() NOT NULL,
    aplicada_em timestamp with time zone
);


--
-- Name: arquivo; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.arquivo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conta_enviante_id uuid NOT NULL,
    chave_storage text NOT NULL,
    nome_original text NOT NULL,
    mime_type text NOT NULL,
    tamanho_bytes bigint NOT NULL,
    checksum text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    removido_em timestamp with time zone
);


--
-- Name: conta; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.conta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo character varying(2) NOT NULL,
    email_acesso text NOT NULL,
    senha_hash text NOT NULL,
    telefone_recuperacao text NOT NULL,
    estado text DEFAULT 'ATIVA'::text NOT NULL,
    nome_publico text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    encerrada_em timestamp with time zone
);


--
-- Name: COLUMN conta.email_acesso; Type: COMMENT; Schema: safradireta; Owner: -
--

COMMENT ON COLUMN safradireta.conta.email_acesso IS 'Validar e normalizar no backend antes de gravar e buscar. O banco armazena o texto recebido sem converter maiusculas.';


--
-- Name: decisao_verificacao; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.decisao_verificacao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verificacao_id uuid NOT NULL,
    operador_id uuid NOT NULL,
    resultado text NOT NULL,
    justificativa text NOT NULL,
    decidida_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: documento_verificacao; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.documento_verificacao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    verificacao_id uuid NOT NULL,
    arquivo_id uuid NOT NULL,
    tipo_documento text NOT NULL,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    substitui_documento_id uuid
);


--
-- Name: empresa; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.empresa (
    conta_id uuid NOT NULL,
    cnpj character varying(14) NOT NULL,
    razao_social text NOT NULL,
    nome_fantasia text,
    natureza_juridica text
);


--
-- Name: endereco; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.endereco (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conta_id uuid NOT NULL,
    rotulo text,
    logradouro text NOT NULL,
    numero text,
    complemento text,
    bairro text,
    municipio text NOT NULL,
    uf character varying(2) NOT NULL,
    cep character varying(8),
    pais character varying(2) DEFAULT 'BR'::character varying NOT NULL,
    referencia_acesso text,
    latitude numeric(9,6),
    longitude numeric(9,6),
    principal boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL
);


--
-- Name: evento_auditoria; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.evento_auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conta_ator_id uuid,
    sessao_id uuid,
    operador_id uuid,
    origem text NOT NULL,
    acao text NOT NULL,
    entidade text NOT NULL,
    entidade_id uuid NOT NULL,
    ocorrido_em timestamp with time zone DEFAULT now() NOT NULL,
    resumo jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: habilitacao_vendedor; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.habilitacao_vendedor (
    conta_id uuid NOT NULL,
    estado text DEFAULT 'PENDENTE'::text NOT NULL,
    possui_transportadora boolean,
    observacao_transporte text,
    dados_complementares jsonb DEFAULT '{}'::jsonb NOT NULL,
    decisao_aprovacao_id uuid,
    habilitada_em timestamp with time zone,
    suspensa_em timestamp with time zone
);


--
-- Name: operador_administrativo; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.operador_administrativo (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    identidade_autenticacao text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    pode_analisar boolean DEFAULT false NOT NULL
);


--
-- Name: perfil_pf; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.perfil_pf (
    conta_id uuid NOT NULL,
    nome text NOT NULL,
    cpf character varying(11)
);


--
-- Name: representante_empresa; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.representante_empresa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid NOT NULL,
    nome text NOT NULL,
    cpf character varying(11) NOT NULL,
    vinculo text NOT NULL,
    inicio_vigencia timestamp with time zone DEFAULT now() NOT NULL,
    fim_vigencia timestamp with time zone
);


--
-- Name: sessao; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.sessao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conta_id uuid NOT NULL,
    token_hash text NOT NULL,
    criada_em timestamp with time zone DEFAULT now() NOT NULL,
    expira_em timestamp with time zone NOT NULL,
    revogada_em timestamp with time zone
);


--
-- Name: termo_uso; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.termo_uso (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    versao text NOT NULL,
    referencia_conteudo text NOT NULL,
    hash_conteudo text NOT NULL,
    publicado_em timestamp with time zone DEFAULT now() NOT NULL,
    vigente_desde timestamp with time zone NOT NULL,
    vigente_ate timestamp with time zone
);


--
-- Name: verificacao; Type: TABLE; Schema: safradireta; Owner: -
--

CREATE TABLE safradireta.verificacao (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conta_id uuid NOT NULL,
    tipo text NOT NULL,
    representante_id uuid,
    estado text DEFAULT 'RASCUNHO'::text NOT NULL,
    dados_submetidos jsonb DEFAULT '{}'::jsonb NOT NULL,
    criada_em timestamp with time zone DEFAULT now() NOT NULL,
    enviada_em timestamp with time zone,
    finalizada_em timestamp with time zone,
    verificacao_anterior_id uuid
);


--
-- Name: aceite_termos aceite_termos_conta_id_termo_id_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.aceite_termos
    ADD CONSTRAINT aceite_termos_conta_id_termo_id_key UNIQUE (conta_id, termo_id);


--
-- Name: aceite_termos aceite_termos_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.aceite_termos
    ADD CONSTRAINT aceite_termos_pkey PRIMARY KEY (id);


--
-- Name: alteracao_cadastral alteracao_cadastral_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.alteracao_cadastral
    ADD CONSTRAINT alteracao_cadastral_pkey PRIMARY KEY (id);


--
-- Name: alteracao_cadastral alteracao_cadastral_verificacao_id_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.alteracao_cadastral
    ADD CONSTRAINT alteracao_cadastral_verificacao_id_key UNIQUE (verificacao_id);


--
-- Name: arquivo arquivo_chave_storage_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.arquivo
    ADD CONSTRAINT arquivo_chave_storage_key UNIQUE (chave_storage);


--
-- Name: arquivo arquivo_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.arquivo
    ADD CONSTRAINT arquivo_pkey PRIMARY KEY (id);


--
-- Name: conta conta_email_acesso_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.conta
    ADD CONSTRAINT conta_email_acesso_key UNIQUE (email_acesso);


--
-- Name: conta conta_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.conta
    ADD CONSTRAINT conta_pkey PRIMARY KEY (id);


--
-- Name: decisao_verificacao decisao_verificacao_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.decisao_verificacao
    ADD CONSTRAINT decisao_verificacao_pkey PRIMARY KEY (id);


--
-- Name: decisao_verificacao decisao_verificacao_verificacao_id_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.decisao_verificacao
    ADD CONSTRAINT decisao_verificacao_verificacao_id_key UNIQUE (verificacao_id);


--
-- Name: documento_verificacao documento_verificacao_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.documento_verificacao
    ADD CONSTRAINT documento_verificacao_pkey PRIMARY KEY (id);


--
-- Name: documento_verificacao documento_verificacao_verificacao_id_arquivo_id_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.documento_verificacao
    ADD CONSTRAINT documento_verificacao_verificacao_id_arquivo_id_key UNIQUE (verificacao_id, arquivo_id);


--
-- Name: empresa empresa_cnpj_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.empresa
    ADD CONSTRAINT empresa_cnpj_key UNIQUE (cnpj);


--
-- Name: empresa empresa_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.empresa
    ADD CONSTRAINT empresa_pkey PRIMARY KEY (conta_id);


--
-- Name: endereco endereco_id_conta_id_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.endereco
    ADD CONSTRAINT endereco_id_conta_id_key UNIQUE (id, conta_id);


--
-- Name: endereco endereco_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.endereco
    ADD CONSTRAINT endereco_pkey PRIMARY KEY (id);


--
-- Name: evento_auditoria evento_auditoria_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.evento_auditoria
    ADD CONSTRAINT evento_auditoria_pkey PRIMARY KEY (id);


--
-- Name: habilitacao_vendedor habilitacao_vendedor_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.habilitacao_vendedor
    ADD CONSTRAINT habilitacao_vendedor_pkey PRIMARY KEY (conta_id);


--
-- Name: operador_administrativo operador_administrativo_identidade_autenticacao_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.operador_administrativo
    ADD CONSTRAINT operador_administrativo_identidade_autenticacao_key UNIQUE (identidade_autenticacao);


--
-- Name: operador_administrativo operador_administrativo_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.operador_administrativo
    ADD CONSTRAINT operador_administrativo_pkey PRIMARY KEY (id);


--
-- Name: perfil_pf perfil_pf_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.perfil_pf
    ADD CONSTRAINT perfil_pf_pkey PRIMARY KEY (conta_id);


--
-- Name: representante_empresa representante_empresa_id_empresa_id_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.representante_empresa
    ADD CONSTRAINT representante_empresa_id_empresa_id_key UNIQUE (id, empresa_id);


--
-- Name: representante_empresa representante_empresa_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.representante_empresa
    ADD CONSTRAINT representante_empresa_pkey PRIMARY KEY (id);


--
-- Name: sessao sessao_id_conta_id_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.sessao
    ADD CONSTRAINT sessao_id_conta_id_key UNIQUE (id, conta_id);


--
-- Name: sessao sessao_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.sessao
    ADD CONSTRAINT sessao_pkey PRIMARY KEY (id);


--
-- Name: sessao sessao_token_hash_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.sessao
    ADD CONSTRAINT sessao_token_hash_key UNIQUE (token_hash);


--
-- Name: termo_uso termo_uso_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.termo_uso
    ADD CONSTRAINT termo_uso_pkey PRIMARY KEY (id);


--
-- Name: termo_uso termo_uso_versao_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.termo_uso
    ADD CONSTRAINT termo_uso_versao_key UNIQUE (versao);


--
-- Name: verificacao verificacao_id_conta_id_key; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.verificacao
    ADD CONSTRAINT verificacao_id_conta_id_key UNIQUE (id, conta_id);


--
-- Name: verificacao verificacao_pkey; Type: CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.verificacao
    ADD CONSTRAINT verificacao_pkey PRIMARY KEY (id);


--
-- Name: ix_arquivo_conta; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE INDEX ix_arquivo_conta ON safradireta.arquivo USING btree (conta_enviante_id);


--
-- Name: ix_auditoria_entidade; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE INDEX ix_auditoria_entidade ON safradireta.evento_auditoria USING btree (entidade, entidade_id, ocorrido_em);


--
-- Name: ix_documento_arquivo; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE INDEX ix_documento_arquivo ON safradireta.documento_verificacao USING btree (arquivo_id);


--
-- Name: ix_endereco_conta; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE INDEX ix_endereco_conta ON safradireta.endereco USING btree (conta_id);


--
-- Name: ix_representante_empresa; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE INDEX ix_representante_empresa ON safradireta.representante_empresa USING btree (empresa_id, inicio_vigencia);


--
-- Name: ix_sessao_ativa; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE INDEX ix_sessao_ativa ON safradireta.sessao USING btree (conta_id, expira_em) WHERE (revogada_em IS NULL);


--
-- Name: ix_sessao_conta; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE INDEX ix_sessao_conta ON safradireta.sessao USING btree (conta_id);


--
-- Name: ix_verificacao_conta; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE INDEX ix_verificacao_conta ON safradireta.verificacao USING btree (conta_id, criada_em);


--
-- Name: ix_verificacao_fila; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE INDEX ix_verificacao_fila ON safradireta.verificacao USING btree (estado, enviada_em);


--
-- Name: uq_endereco_principal; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE UNIQUE INDEX uq_endereco_principal ON safradireta.endereco USING btree (conta_id) WHERE (principal AND ativo);


--
-- Name: uq_representante_atual; Type: INDEX; Schema: safradireta; Owner: -
--

CREATE UNIQUE INDEX uq_representante_atual ON safradireta.representante_empresa USING btree (empresa_id) WHERE (fim_vigencia IS NULL);


--
-- Name: aceite_termos aceite_termos_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.aceite_termos
    ADD CONSTRAINT aceite_termos_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES safradireta.conta(id);


--
-- Name: aceite_termos aceite_termos_sessao_id_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.aceite_termos
    ADD CONSTRAINT aceite_termos_sessao_id_conta_id_fkey FOREIGN KEY (sessao_id, conta_id) REFERENCES safradireta.sessao(id, conta_id);


--
-- Name: aceite_termos aceite_termos_termo_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.aceite_termos
    ADD CONSTRAINT aceite_termos_termo_id_fkey FOREIGN KEY (termo_id) REFERENCES safradireta.termo_uso(id);


--
-- Name: alteracao_cadastral alteracao_cadastral_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.alteracao_cadastral
    ADD CONSTRAINT alteracao_cadastral_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES safradireta.conta(id);


--
-- Name: alteracao_cadastral alteracao_cadastral_verificacao_id_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.alteracao_cadastral
    ADD CONSTRAINT alteracao_cadastral_verificacao_id_conta_id_fkey FOREIGN KEY (verificacao_id, conta_id) REFERENCES safradireta.verificacao(id, conta_id);


--
-- Name: arquivo arquivo_conta_enviante_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.arquivo
    ADD CONSTRAINT arquivo_conta_enviante_id_fkey FOREIGN KEY (conta_enviante_id) REFERENCES safradireta.conta(id);


--
-- Name: decisao_verificacao decisao_verificacao_operador_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.decisao_verificacao
    ADD CONSTRAINT decisao_verificacao_operador_id_fkey FOREIGN KEY (operador_id) REFERENCES safradireta.operador_administrativo(id);


--
-- Name: decisao_verificacao decisao_verificacao_verificacao_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.decisao_verificacao
    ADD CONSTRAINT decisao_verificacao_verificacao_id_fkey FOREIGN KEY (verificacao_id) REFERENCES safradireta.verificacao(id);


--
-- Name: documento_verificacao documento_verificacao_arquivo_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.documento_verificacao
    ADD CONSTRAINT documento_verificacao_arquivo_id_fkey FOREIGN KEY (arquivo_id) REFERENCES safradireta.arquivo(id);


--
-- Name: documento_verificacao documento_verificacao_substitui_documento_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.documento_verificacao
    ADD CONSTRAINT documento_verificacao_substitui_documento_id_fkey FOREIGN KEY (substitui_documento_id) REFERENCES safradireta.documento_verificacao(id);


--
-- Name: documento_verificacao documento_verificacao_verificacao_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.documento_verificacao
    ADD CONSTRAINT documento_verificacao_verificacao_id_fkey FOREIGN KEY (verificacao_id) REFERENCES safradireta.verificacao(id);


--
-- Name: empresa empresa_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.empresa
    ADD CONSTRAINT empresa_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES safradireta.conta(id);


--
-- Name: endereco endereco_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.endereco
    ADD CONSTRAINT endereco_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES safradireta.conta(id);


--
-- Name: evento_auditoria evento_auditoria_conta_ator_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.evento_auditoria
    ADD CONSTRAINT evento_auditoria_conta_ator_id_fkey FOREIGN KEY (conta_ator_id) REFERENCES safradireta.conta(id);


--
-- Name: evento_auditoria evento_auditoria_operador_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.evento_auditoria
    ADD CONSTRAINT evento_auditoria_operador_id_fkey FOREIGN KEY (operador_id) REFERENCES safradireta.operador_administrativo(id);


--
-- Name: evento_auditoria evento_auditoria_sessao_id_conta_ator_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.evento_auditoria
    ADD CONSTRAINT evento_auditoria_sessao_id_conta_ator_id_fkey FOREIGN KEY (sessao_id, conta_ator_id) REFERENCES safradireta.sessao(id, conta_id);


--
-- Name: habilitacao_vendedor habilitacao_vendedor_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.habilitacao_vendedor
    ADD CONSTRAINT habilitacao_vendedor_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES safradireta.conta(id);


--
-- Name: habilitacao_vendedor habilitacao_vendedor_decisao_aprovacao_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.habilitacao_vendedor
    ADD CONSTRAINT habilitacao_vendedor_decisao_aprovacao_id_fkey FOREIGN KEY (decisao_aprovacao_id) REFERENCES safradireta.decisao_verificacao(id);


--
-- Name: perfil_pf perfil_pf_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.perfil_pf
    ADD CONSTRAINT perfil_pf_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES safradireta.conta(id);


--
-- Name: representante_empresa representante_empresa_empresa_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.representante_empresa
    ADD CONSTRAINT representante_empresa_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES safradireta.empresa(conta_id);


--
-- Name: sessao sessao_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.sessao
    ADD CONSTRAINT sessao_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES safradireta.conta(id);


--
-- Name: verificacao verificacao_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.verificacao
    ADD CONSTRAINT verificacao_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES safradireta.conta(id);


--
-- Name: verificacao verificacao_representante_id_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.verificacao
    ADD CONSTRAINT verificacao_representante_id_conta_id_fkey FOREIGN KEY (representante_id, conta_id) REFERENCES safradireta.representante_empresa(id, empresa_id);


--
-- Name: verificacao verificacao_verificacao_anterior_id_conta_id_fkey; Type: FK CONSTRAINT; Schema: safradireta; Owner: -
--

ALTER TABLE ONLY safradireta.verificacao
    ADD CONSTRAINT verificacao_verificacao_anterior_id_conta_id_fkey FOREIGN KEY (verificacao_anterior_id, conta_id) REFERENCES safradireta.verificacao(id, conta_id);


--
-- PostgreSQL database dump complete
--



REVOKE ALL ON SCHEMA safradireta FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA safradireta FROM PUBLIC;
COMMIT;
