import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../../components/Avatar";
import { Icon } from "../../../components/Icon";
import { routes } from "../../../data/site";
import { useAuth } from "../../../context/authContext";
import { validateFile } from "../../seller-upgrade/sellerUpgrade";
import {
  formatCep, formatCpf, formatDocument, formatPhone, phoneDigits, toPhoneApi, ufs, validateAccount,
} from "../profile";
import type { ProfileUpdateResult, UpdateUserProfile, UserProfileData } from "../profile";
import { AvatarCropperModal } from "./AvatarCropperModal";
import {
  obterEmpresaPorIdOuCnpj,
  obterStatusDocumentosEmpresa,
  obterStatusGovernancaProdutor,
  obterStatusDocumentosProdutor,
  sincronizarDadosEmpresaAdmin,
} from "../../admin/adminStorage";
import type {
  CorporateDocMetadata,
  CorporateVerificationRecord,
  ProducerDocMetadata,
  ProducerGovernanceRecord,
} from "../../admin/adminStorage";
import { ViewUserDocumentModal } from "./ViewUserDocumentModal";
import { ReplaceDocumentModal } from "./ReplaceDocumentModal";
import { ChangeRepresentativeModal } from "./ChangeRepresentativeModal";

export function AccountTab({ profile, onSave, onSaved }: {
  profile: UserProfileData;
  onSave: UpdateUserProfile;
  onSaved: (profile: UserProfileData) => void;
}) {
  const { session, setAvatar } = useAuth();
  const isPj = profile.account.tipo === "PJ";
  const vendedorEstado = session?.vendedorEstado ?? null;
  const isSeller = Boolean(profile.seller?.isHabilitado || vendedorEstado === "HABILITADO" || vendedorEstado === "SUSPENSO");

  // Sincronização do registro corporativo da empresa no Backoffice
  const resolveEmpresa = (): CorporateVerificationRecord | null => {
    const existing =
      obterEmpresaPorIdOuCnpj(profile.account.id) ||
      obterEmpresaPorIdOuCnpj(profile.account.cpfCnpj) ||
      obterEmpresaPorIdOuCnpj(session?.conta.id) ||
      obterEmpresaPorIdOuCnpj(session?.conta.email) ||
      obterEmpresaPorIdOuCnpj(profile.account.razaoSocial || profile.account.nome);
    if (existing) return existing;
    if (isPj) {
      const rep = profile.representantes?.[0];
      sincronizarDadosEmpresaAdmin({
        id: profile.account.id || session?.conta.id || "",
        razaoSocial: profile.account.razaoSocial || profile.account.nome || session?.conta.nome,
        nomeFantasia: profile.account.nomeFantasia,
        cnpj: profile.account.cpfCnpj,
        email: profile.account.email || session?.conta.email,
        telefone: profile.account.telefone,
        endereco: profile.address,
        representante: rep
          ? {
              nome: rep.nome,
              cpf: rep.cpf,
              vinculo: rep.vinculo,
            }
          : undefined,
      });
      return (
        obterEmpresaPorIdOuCnpj(profile.account.id) ||
        obterEmpresaPorIdOuCnpj(profile.account.cpfCnpj) ||
        obterEmpresaPorIdOuCnpj(session?.conta.id) ||
        null
      );
    }
    return null;
  };

  const [empresa, setEmpresa] = useState<CorporateVerificationRecord | null>(resolveEmpresa);

  const refreshEmpresa = () => {
    setEmpresa(resolveEmpresa());
  };

  // Sincronização do registro de governança do produtor individual (PF)
  const [produtorGov, setProdutorGov] = useState<ProducerGovernanceRecord | null>(() => {
    if (isPj) return null;
    const id = session?.conta.id || profile.account.id;
    return (
      obterStatusGovernancaProdutor(id) ||
      (profile.account.cpfCnpj ? obterStatusGovernancaProdutor(profile.account.cpfCnpj) : null)
    );
  });

  const refreshProdutorGov = () => {
    if (!isPj) {
      const id = session?.conta.id || profile.account.id;
      const p =
        obterStatusGovernancaProdutor(id) ||
        (profile.account.cpfCnpj ? obterStatusGovernancaProdutor(profile.account.cpfCnpj) : null);
      setProdutorGov(p);
    }
  };

  const [values, setValues] = useState(() => ({
    nome: profile.account.nome,
    telefone: formatPhone(phoneDigits(profile.account.telefone)),
    cpf: !isPj && profile.account.cpfCnpj ? formatCpf(profile.account.cpfCnpj) : "",
    cep: formatCep(profile.address.cep), logradouro: profile.address.logradouro, numero: profile.address.numero,
    complemento: profile.address.complemento ?? "", bairro: profile.address.bairro,
    cidade: profile.address.cidade, uf: profile.address.uf,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [photoMessage, setPhotoMessage] = useState("");
  const [cropRawUrl, setCropRawUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef(false);

  // Estados dos modais de gestão documental e representação
  const [showChangeRepModal, setShowChangeRepModal] = useState(false);
  const [viewDocModal, setViewDocModal] = useState<{
    documentTitle: string;
    fileName: string;
    docKind: "CONTRATO" | "CNPJ" | "REP_FRENTE" | "REP_VERSO" | "RG_FRENTE" | "RG_VERSO" | "CAR";
    pfDocKey?: "rgFrente" | "rgVerso" | "car";
  } | null>(null);
  const [replaceDocModal, setReplaceDocModal] = useState<{
    documentTitle: string;
    currentFileName: string;
    currentDocKind: "CONTRATO" | "CNPJ" | "REP_FRENTE" | "REP_VERSO" | "RG_FRENTE" | "RG_VERSO" | "CAR";
    tipoDocKey?: "contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso";
    pfDocKey?: "rgFrente" | "rgVerso" | "car";
  } | null>(null);

  function update(name: keyof typeof values, value: string) {
    setValues((c) => ({ ...c, [name]: value }));
    setErrors((c) => {
      if (!c[name]) return c;
      const { [name]: _removed, ...rest } = c;
      return rest;
    });
    setFeedback(null);
  }

  function focusFirst(next: Record<string, string>) {
    const key = Object.keys(next)[0];
    requestAnimationFrame(() => document.getElementById(`profile-${key}`)?.focus());
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validateFile(file);
    if (problem || !file.type.startsWith("image/")) {
      setPhotoMessage(problem ?? "Escolha uma imagem JPG ou PNG.");
      return;
    }
    setPhotoMessage("");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCropRawUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const next = validateAccount(values);
    setErrors(next);
    if (Object.keys(next).length) {
      setFeedback(null);
      focusFirst(next);
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    setFeedback(null);
    let result: ProfileUpdateResult;
    try {
      result = await onSave({
        account: {
          ...profile.account,
          nome: values.nome.trim().replace(/\s+/g, " "),
          telefone: toPhoneApi(values.telefone),
          cpfCnpj: isPj || profile.account.cpfCnpj ? profile.account.cpfCnpj : values.cpf.replace(/\D/g, ""),
          avatarUrl: session?.avatarUrl ?? profile.account.avatarUrl,
        },
        address: {
          cep: values.cep.replace(/\D/g, ""), logradouro: values.logradouro.trim(), numero: values.numero.trim(),
          complemento: values.complemento.trim(), bairro: values.bairro.trim(), cidade: values.cidade.trim(), uf: values.uf,
        },
      });
    } catch {
      result = { ok: false, reason: "unavailable", message: "Não foi possível concluir a solicitação. Tente novamente." };
    }
    pendingRef.current = false;
    setSaving(false);
    if (result.ok) {
      setFeedback({ kind: "ok", text: result.message });
      if (isPj) refreshEmpresa();
      onSaved(result.updatedProfile);
    } else {
      setFeedback({ kind: "error", text: result.message });
      if (result.errors && Object.keys(result.errors).length) {
        setErrors(result.errors);
        focusFirst(result.errors);
      }
    }
  }

  const ctl = (name: string) => ({
    id: `profile-${name}`, name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `profile-${name}-error` : undefined,
  });
  const err = (name: string) => errors[name] && <p className="registration-field__error" id={`profile-${name}-error`}>{errors[name]}</p>;

  // Dossiê documental da empresa ou do produtor
  const docsStatus = isPj && empresa ? obterStatusDocumentosEmpresa(empresa) : null;
  const pfDocsStatus = !isPj && isSeller && produtorGov ? obterStatusDocumentosProdutor(produtorGov) : null;
  const cnpjClean = empresa?.cnpj.replace(/\D/g, "") || profile.account.cpfCnpj.replace(/\D/g, "") || "";

  interface DocEntry {
    key: string;
    tipoDocKey?: "contratoSocial" | "cartaoCnpj" | "docRepresentanteFrente" | "docRepresentanteVerso";
    pfDocKey?: "rgFrente" | "rgVerso" | "car";
    docKind: "CONTRATO" | "CNPJ" | "REP_FRENTE" | "REP_VERSO" | "RG_FRENTE" | "RG_VERSO" | "CAR";
    title: string;
    description: string;
    meta: CorporateDocMetadata | ProducerDocMetadata | undefined;
  }

  const docsList: DocEntry[] = isPj && docsStatus
    ? [
        {
          key: "contratoSocial",
          tipoDocKey: "contratoSocial",
          docKind: "CONTRATO",
          title: "Contrato Social / Estatuto Social",
          description: "Contrato social consolidado ou estatuto registrado em junta comercial.",
          meta: docsStatus.contratoSocial,
        },
        {
          key: "cartaoCnpj",
          tipoDocKey: "cartaoCnpj",
          docKind: "CNPJ",
          title: "Cartão CNPJ (Receita Federal)",
          description: "Comprovante de inscrição e situação cadastral ativa na Receita Federal.",
          meta: docsStatus.cartaoCnpj,
        },
        {
          key: "docRepresentanteFrente",
          tipoDocKey: "docRepresentanteFrente",
          docKind: "REP_FRENTE",
          title: "Identidade do Representante — Frente",
          description: "CNH ou RG do representante legal (lado com foto e assinatura).",
          meta: docsStatus.docRepresentanteFrente,
        },
        {
          key: "docRepresentanteVerso",
          tipoDocKey: "docRepresentanteVerso",
          docKind: "REP_VERSO",
          title: "Identidade do Representante — Verso",
          description: "CNH ou RG do representante legal (lado com dados de filiação e registro).",
          meta: docsStatus.docRepresentanteVerso,
        },
      ]
    : !isPj && isSeller && pfDocsStatus
    ? [
        {
          key: "rgFrente",
          pfDocKey: "rgFrente",
          docKind: "RG_FRENTE",
          title: "Documento de Identidade — Frente (RG / CNH)",
          description: "Documento oficial de identificação com foto e assinatura claras.",
          meta: pfDocsStatus.rgFrente,
        },
        {
          key: "rgVerso",
          pfDocKey: "rgVerso",
          docKind: "RG_VERSO",
          title: "Documento de Identidade — Verso (RG / CNH)",
          description: "Verso com número do documento, dados de registro e filiação.",
          meta: pfDocsStatus.rgVerso,
        },
        {
          key: "car",
          pfDocKey: "car",
          docKind: "CAR",
          title: "Comprovante de Propriedade Rural / CAR",
          description: "Cadastro Ambiental Rural ou certidão de matrícula do imóvel produtivo.",
          meta: pfDocsStatus.car,
        },
      ]
    : [];

  return (
    <>
      <form ref={formRef} noValidate onSubmit={handleSubmit} aria-busy={saving} className="profile__form">
        <fieldset className="registration__fields" disabled={saving}>
          <legend className="sr-only">Dados da conta. Campos com asterisco são obrigatórios.</legend>

          <div className="profile__photo">
            <Avatar url={session?.avatarUrl} name={profile.account.nome} size={72} />
            <div>
              <label className="profile__photo-button" htmlFor="profile-photo">Alterar foto</label>
              <input id="profile-photo" className="sr-only" type="file" accept=".jpg,.jpeg,.png" onChange={handlePhoto} aria-describedby="profile-photo-hint" />
              <p className="corporate__hint" id="profile-photo-hint">JPG ou PNG, até 10 MB. Foto visível no seu perfil e cabeçalho.</p>
              {photoMessage && <p className="registration-field__error" role="alert">{photoMessage}</p>}
            </div>
          </div>

          <h2 className="seller-upgrade__section">Dados pessoais</h2>
          <div className="registration-field">
            <label htmlFor="profile-nome">{isPj ? "Razão social / nome" : "Nome completo"} <span aria-hidden="true">*</span></label>
            <input {...ctl("nome")} type="text" maxLength={150} autoComplete="name" value={values.nome} onChange={(e) => update("nome", e.target.value)} />
            {err("nome")}
          </div>
          <div className="registration-field">
            <label htmlFor="profile-telefone">Telefone de contato <span aria-hidden="true">*</span></label>
            <input {...ctl("telefone")} type="tel" maxLength={15} autoComplete="tel-national" placeholder="(19) 99999-9999"
              value={values.telefone} onChange={(e) => update("telefone", formatPhone(e.target.value))} />
            {err("telefone")}
          </div>
          <div className="registration-field profile__locked">
            <label htmlFor="profile-email"><Icon name="lock" /> E-mail de acesso</label>
            <input id="profile-email" type="email" value={profile.account.email} readOnly aria-readonly="true" aria-describedby="profile-email-hint" />
            <p className="corporate__hint" id="profile-email-hint">O e-mail de acesso é a chave única da sua conta e não pode ser alterado diretamente.</p>
          </div>
          {isPj ? (
            <div className="registration-field profile__locked">
              <label htmlFor="profile-document"><Icon name="lock" /> CNPJ</label>
              <input id="profile-document" type="text" value={profile.account.cpfCnpj ? formatDocument(profile.account.cpfCnpj) : "Não informado"} readOnly aria-readonly="true" aria-describedby="profile-document-hint" />
              <p className="corporate__hint" id="profile-document-hint">
                {profile.account.cpfCnpj
                  ? "Documento fiscal verificado. Alterações de CNPJ exigem solicitação formal ao suporte institucional."
                  : "CNPJ em análise documental."}
              </p>
            </div>
          ) : profile.account.cpfCnpj ? (
            <div className="registration-field profile__locked">
              <label htmlFor="profile-document"><Icon name="lock" /> CPF</label>
              <input
                id="profile-document"
                type="text"
                value={formatCpf(profile.account.cpfCnpj)}
                readOnly
                aria-readonly="true"
                aria-describedby="profile-document-hint"
              />
              <p className="corporate__hint" id="profile-document-hint">
                {vendedorEstado === "HABILITADO"
                  ? "CPF de produtor habilitado. Alterações exigem solicitação ao suporte."
                  : "CPF vinculado à sua conta como dado protegido. Alterações exigem solicitação ao suporte."}
              </p>
            </div>
          ) : (
            <div className="registration-field">
              <label htmlFor="profile-cpf">CPF <small>(opcional)</small></label>
              <input
                {...ctl("cpf")}
                type="text"
                inputMode="numeric"
                maxLength={14}
                placeholder="000.000.000-00"
                value={values.cpf}
                onChange={(e) => update("cpf", formatCpf(e.target.value))}
              />
              {err("cpf")}
              <p className="corporate__hint" id="profile-cpf-hint">
                Opcional para compras. Uma vez informado e salvo, o CPF fica vinculado permanentemente como dado protegido.
              </p>
            </div>
          )}

          {/* ============================================================= */}
          {/* SEÇÃO REPRESENTANTE LEGAL (EXCLUSIVA PARA CONTAS PJ)          */}
          {/* ============================================================= */}
          {isPj && (
            <section className="profile-rep-section" aria-labelledby="profile-rep-title">
              <div className="profile-rep-section__header">
                <div>
                  <h2 id="profile-rep-title" className="seller-upgrade__section">
                    Representante Legal (PJ)
                  </h2>
                  <p className="corporate__hint">
                    Pessoa física credenciada a responder juridicamente pela empresa no marketplace.
                  </p>
                </div>

                {!empresa?.solicitacaoTrocaRepresentante && (
                  <button
                    type="button"
                    className="button button--secondary button--small profile-rep-change-btn"
                    onClick={() => setShowChangeRepModal(true)}
                  >
                    🔄 Solicitar Troca de Representante
                  </button>
                )}
              </div>

              {/* Aviso em destaque caso haja troca pendente */}
              {empresa?.solicitacaoTrocaRepresentante &&
                empresa.solicitacaoTrocaRepresentante.status === "PENDENTE" && (
                  <div className="profile-rep-alert" role="status">
                    <div className="profile-rep-alert__header">
                      <span className="profile-rep-alert__icon">⏳</span>
                      <div>
                        <strong>Solicitação de Troca de Representante em Análise</strong>
                        <p>
                          Um pedido formal de alteração de responsabilidade societária foi
                          protocolado e aguarda homologação do auditor. Seus poderes atuais permanecem
                          ativos até a conclusão.
                        </p>
                      </div>
                    </div>

                    <div className="profile-rep-alert__body">
                      <div>
                        <strong>Novo Responsável Indicado:</strong>{" "}
                        {empresa.solicitacaoTrocaRepresentante.novoRepresentante.nome}
                      </div>
                      <div>
                        <strong>CPF:</strong>{" "}
                        {empresa.solicitacaoTrocaRepresentante.novoRepresentante.cpf}
                      </div>
                      <div>
                        <strong>Vínculo Societário:</strong>{" "}
                        {empresa.solicitacaoTrocaRepresentante.novoRepresentante.vinculo}
                      </div>
                      <div>
                        <strong>Instrumento Anexado:</strong>{" "}
                        {empresa.solicitacaoTrocaRepresentante.documentos.comprovacaoPoderesNome}
                      </div>
                    </div>
                  </div>
                )}

              <div className="profile-rep-card">
                <div className="registration-field profile__locked">
                  <label htmlFor="profile-rep-nome-ro">
                    <Icon name="lock" /> Nome do Representante Atual
                  </label>
                  <input
                    id="profile-rep-nome-ro"
                    type="text"
                    value={empresa?.representante.nome || profile.representantes?.[0]?.nome || "Não informado"}
                    readOnly
                    aria-readonly="true"
                  />
                </div>

                <div className="corporate__row">
                  <div className="registration-field profile__locked">
                    <label htmlFor="profile-rep-cpf-ro">
                      <Icon name="lock" /> CPF do Representante
                    </label>
                    <input
                      id="profile-rep-cpf-ro"
                      type="text"
                      value={
                        empresa?.representante.cpf
                          ? formatCpf(empresa.representante.cpf)
                          : profile.representantes?.[0]?.cpf
                          ? formatCpf(profile.representantes[0].cpf)
                          : "—"
                      }
                      readOnly
                      aria-readonly="true"
                    />
                  </div>

                  <div className="registration-field profile__locked">
                    <label htmlFor="profile-rep-vinculo-ro">
                      <Icon name="lock" /> Vínculo Societário
                    </label>
                    <input
                      id="profile-rep-vinculo-ro"
                      type="text"
                      value={
                        empresa?.representante.vinculo ||
                        profile.representantes?.[0]?.vinculo ||
                        "Sócio-administrador"
                      }
                      readOnly
                      aria-readonly="true"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          <h2 className="seller-upgrade__section">Endereço principal</h2>
          <div className="registration-field">
            <label htmlFor="profile-cep">CEP</label>
            <input {...ctl("cep")} type="text" inputMode="numeric" maxLength={9} autoComplete="postal-code" placeholder="00000-000"
              value={values.cep} onChange={(e) => update("cep", formatCep(e.target.value))} />
            {err("cep")}
          </div>
          <div className="registration-field">
            <label htmlFor="profile-logradouro">Logradouro</label>
            <input {...ctl("logradouro")} type="text" maxLength={150} autoComplete="address-line1" value={values.logradouro} onChange={(e) => update("logradouro", e.target.value)} />
            {err("logradouro")}
          </div>
          <div className="corporate__row">
            <div className="registration-field">
              <label htmlFor="profile-numero">Número</label>
              <input {...ctl("numero")} type="text" maxLength={10} value={values.numero} onChange={(e) => update("numero", e.target.value)} />
              {err("numero")}
            </div>
            <div className="registration-field">
              <label htmlFor="profile-complemento">Complemento</label>
              <input {...ctl("complemento")} type="text" maxLength={60} autoComplete="address-line2" value={values.complemento} onChange={(e) => update("complemento", e.target.value)} />
            </div>
          </div>
          <div className="registration-field">
            <label htmlFor="profile-bairro">Bairro</label>
            <input {...ctl("bairro")} type="text" maxLength={80} value={values.bairro} onChange={(e) => update("bairro", e.target.value)} />
            {err("bairro")}
          </div>
          <div className="corporate__row">
            <div className="registration-field">
              <label htmlFor="profile-cidade">Cidade</label>
              <input {...ctl("cidade")} type="text" maxLength={80} autoComplete="address-level2" value={values.cidade} onChange={(e) => update("cidade", e.target.value)} />
              {err("cidade")}
            </div>
            <div className="registration-field">
              <label htmlFor="profile-uf">UF</label>
              <select {...ctl("uf")} value={values.uf} onChange={(e) => update("uf", e.target.value)}>
                <option value="">UF</option>
                {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {err("uf")}
            </div>
          </div>

          <button className="button registration__submit" type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </fieldset>
        <div aria-live="polite" aria-atomic="true">
          {feedback && <p className={`registration__feedback ${feedback.kind === "error" ? "registration__feedback--error" : ""}`}>{feedback.text}</p>}
        </div>
      </form>

      {/* =============================================================== */}
      {/* SEÇÃO DOSSIÊ E DOCUMENTOS CADASTRADOS (PJ E PRODUTOR COM DOCS)  */}
      {/* =============================================================== */}
      {(isPj || isSeller) && docsList.length > 0 && (
        <section className="profile-dossier-section" aria-labelledby="profile-dossier-title">
          <div className="profile-dossier-section__header">
            <div>
              <h2 id="profile-dossier-title">Dossiê e Documentos Cadastrados</h2>
              <p className="corporate__hint">
                {isPj
                  ? "Arquivos oficiais vinculados ao CNPJ da empresa. Mantenha os documentos atualizados para preservar a conformidade e a legitimidade dos seus lotes no mercado."
                  : "Documentos oficiais de identificação pessoal e regularidade rural da fazenda. Mantenha os arquivos em conformidade para garantir a segurança das suas negociações."}
              </p>
            </div>
          </div>

          <div className="profile-dossier-grid">
            {docsList.map((doc) => {
              const status = doc.meta?.status || "VALIDADO";
              const isRecusado = status === "RECUSADO";
              const isReanalise = status === "EM_REANALISE";

              return (
                <article key={doc.key} className={`profile-dossier-card ${isRecusado ? "is-rejected" : ""}`}>
                  <div className="profile-dossier-card__top">
                    <span className="profile-dossier-card__icon">
                      {doc.docKind === "CONTRATO" ? "📜" : doc.docKind === "CNPJ" ? "🏛️" : doc.docKind === "CAR" ? "🌾" : "🪪"}
                    </span>
                    <span
                      className={`profile-dossier-badge ${
                        status === "VALIDADO"
                          ? "profile-dossier-badge--success"
                          : isReanalise
                          ? "profile-dossier-badge--warning"
                          : "profile-dossier-badge--danger"
                      }`}
                    >
                      {status === "VALIDADO"
                        ? "✅ Validado"
                        : isReanalise
                        ? "⏳ Em Reanálise"
                        : "❌ Recusado"}
                    </span>
                  </div>

                  <h3 className="profile-dossier-card__title">{doc.title}</h3>
                  <p className="profile-dossier-card__desc">{doc.description}</p>

                  <div className="profile-dossier-card__meta">
                    <Icon name="file" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong
                        className="truncate-filename"
                        title={doc.meta?.nome || "Documento anexado"}
                        style={{ display: "block" }}
                      >
                        {doc.meta?.nome || "Documento anexado"}
                      </strong>
                      <small>
                        {doc.meta?.tamanhoFormatado || "Arquivo digital"} · Atualizado em{" "}
                        {doc.meta?.atualizadoEm
                          ? new Date(doc.meta.atualizadoEm).toLocaleDateString("pt-BR")
                          : "—"}
                      </small>
                    </div>
                  </div>

                  {isRecusado && doc.meta?.motivoRecusa && (
                    <div className="profile-dossier-card__rejection">
                      <strong>Motivo da Recusa:</strong>
                      <p>{doc.meta.motivoRecusa}</p>
                    </div>
                  )}

                  <div className="profile-dossier-card__actions">
                    <button
                      type="button"
                      className="button button--outline button--small"
                      style={{ flexShrink: 0 }}
                      onClick={() =>
                        setViewDocModal({
                          documentTitle: doc.title,
                          fileName: doc.meta?.nome || "documento.pdf",
                          docKind: doc.docKind,
                          pfDocKey: doc.pfDocKey,
                        })
                      }
                    >
                      <Icon name="eye" /> Visualizar
                    </button>
                    <button
                      type="button"
                      className="button button--secondary button--small"
                      style={{ flexShrink: 0 }}
                      onClick={() =>
                        setReplaceDocModal({
                          documentTitle: doc.title,
                          currentFileName: doc.meta?.nome || "documento.pdf",
                          currentDocKind: doc.docKind,
                          tipoDocKey: doc.tipoDocKey,
                          pfDocKey: doc.pfDocKey,
                        })
                      }
                    >
                      🔄 Substituir
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {!isPj && vendedorEstado !== "HABILITADO" && (
        <aside className="profile__seller-cta" aria-labelledby="profile-seller-cta-title">
          <h2 id="profile-seller-cta-title">Vender no SafraDireta</h2>
          {vendedorEstado === "PENDENTE" ? (
            <p>Sua solicitação de habilitação para vender está em análise. Você continua com acesso completo às compras.</p>
          ) : (
            <>
              <p>Deseja comercializar lotes no SafraDireta? Habilite as funcionalidades de venda na sua conta.</p>
              <Link className="button profile__secondary-button" to={routes.sellerUpgrade}>Habilitar Vendas</Link>
            </>
          )}
        </aside>
      )}

      {cropRawUrl && (
        <AvatarCropperModal
          rawUrl={cropRawUrl}
          onClose={() => setCropRawUrl(null)}
          onConfirm={(croppedDataUrl) => {
            setAvatar(croppedDataUrl);
            onSaved({
              ...profile,
              account: {
                ...profile.account,
                avatarUrl: croppedDataUrl,
              },
            });
            setCropRawUrl(null);
          }}
        />
      )}

      {/* Modal: Visualizar Documento */}
      {viewDocModal && (
        <ViewUserDocumentModal
          isOpen={true}
          onClose={() => setViewDocModal(null)}
          documentTitle={viewDocModal.documentTitle}
          fileName={viewDocModal.fileName}
          cnpjClean={cnpjClean}
          docKind={viewDocModal.docKind}
          isPf={!isPj}
          userId={session?.conta.id || profile.account.id}
          pfDocKey={viewDocModal.pfDocKey}
          onOpenReplaceModal={() => {
            const target = docsList.find((d) => d.docKind === viewDocModal.docKind);
            if (target) {
              setReplaceDocModal({
                documentTitle: target.title,
                currentFileName: target.meta?.nome || "documento",
                currentDocKind: target.docKind,
                tipoDocKey: target.tipoDocKey,
                pfDocKey: target.pfDocKey,
              });
            }
          }}
          empresaInfo={
            empresa
              ? {
                  razaoSocial: empresa.razaoSocial,
                  cnpj: empresa.cnpj,
                  representante: empresa.representante,
                  endereco: empresa.endereco,
                }
              : {
                  razaoSocial: profile.account.razaoSocial || profile.account.nome,
                  cnpj: profile.account.cpfCnpj,
                  representante: profile.representantes?.[0]
                    ? {
                        nome: profile.representantes[0].nome,
                        cpf: profile.representantes[0].cpf,
                        vinculo: profile.representantes[0].vinculo,
                      }
                    : undefined,
                  endereco: profile.address,
                }
          }
        />
      )}

      {/* Modal: Substituir Documento */}
      {replaceDocModal && (
        <ReplaceDocumentModal
          isOpen={true}
          onClose={() => setReplaceDocModal(null)}
          documentTitle={replaceDocModal.documentTitle}
          currentFileName={replaceDocModal.currentFileName}
          currentDocKind={replaceDocModal.currentDocKind}
          tipoDocKey={replaceDocModal.tipoDocKey}
          cnpjClean={cnpjClean}
          empresaId={empresa?.id || cnpjClean}
          isPf={!isPj}
          userId={session?.conta.id || profile.account.id}
          pfDocKey={replaceDocModal.pfDocKey}
          onSuccess={(novoNome) => {
            if (isPj) {
              refreshEmpresa();
            } else {
              refreshProdutorGov();
            }
            setFeedback({
              kind: "ok",
              text: `O documento "${novoNome}" foi reenviado com sucesso e submetido para reanálise da governança.`,
            });
          }}
        />
      )}

      {/* Modal: Troca de Representante Legal */}
      {showChangeRepModal && (
        <ChangeRepresentativeModal
          isOpen={true}
          onClose={() => setShowChangeRepModal(false)}
          empresaId={empresa?.id || profile.account.id}
          cnpjClean={cnpjClean}
          currentRepresentativeName={
            empresa?.representante.nome || profile.representantes?.[0]?.nome || "Representante Atual"
          }
          onSuccess={() => {
            refreshEmpresa();
            setFeedback({
              kind: "ok",
              text: "Solicitação de troca de representante protocolada com sucesso. O pedido foi encaminhado para homologação da equipe de governança.",
            });
          }}
        />
      )}
    </>
  );
}
