import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import registrationImage from "../../assets/images/registration-landscape.jpeg";
import { Icon } from "../../components/Icon";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import {
  formatCep, formatCnpj, formatCpf, formatFileSize, formatPhone, initialCorporateValues,
  naturezasJuridicas, registerCorporateAccount, steps, toCorporateRegistrationData, ufs,
  validateFile, validateStep, vinculos, ACCEPTED_FILE_TYPES,
} from "./corporateRegistration";
import type {
  CorporateFormValues, CorporateRegisterResult, FieldErrors, RegisterCorporateAccount,
} from "./corporateRegistration";
import "../registration/RegistrationPage.css";
import "./CorporateRegistrationPage.css";

type FileMeta = { name: string; size: number };
type DocKind = "company" | "representative";
type TextField = keyof CorporateFormValues;

const docKinds: { kind: DocKind; errorKey: string; label: string; hint: string }[] = [
  { kind: "company", errorKey: "companyDoc", label: "Documento de constituição da empresa", hint: "Contrato Social consolidado, CCMEI ou Estatuto Social." },
  { kind: "representative", errorKey: "representativeDoc", label: "Documento de identificação do representante", hint: "RG, CNH ou documento profissional com foto." },
];

function Field({ id, label, required, error, hint, children }: {
  id: string; label: string; required?: boolean; error?: string; hint?: string; children: ReactNode;
}) {
  return (
    <div className="registration-field">
      <label htmlFor={id}>{label} {required && <span aria-hidden="true">*</span>}</label>
      {children}
      {hint && !error && <p className="corporate__hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="registration-field__error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

export function CorporateRegistrationPage({ onOpenDialog, onRegister = registerCorporateAccount }: {
  onOpenDialog: OpenDevelopmentDialog;
  onRegister?: RegisterCorporateAccount;
}) {
  const [values, setValues] = useState<CorporateFormValues>(initialCorporateValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [files, setFiles] = useState<Record<DocKind, FileMeta[]>>({ company: [], representative: [] });
  const [fileMessages, setFileMessages] = useState<Record<DocKind, string>>({ company: "", representative: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [result, setResult] = useState<Extract<CorporateRegisterResult, { ok: true }> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const fileCount = { company: files.company.length, representative: files.representative.length };

  function update<K extends TextField>(name: K, value: CorporateFormValues[K]) {
    setValues((c) => ({ ...c, [name]: value }));
    setErrors((c) => {
      if (!c[name]) return c;
      const { [name]: _removed, ...rest } = c;
      return rest;
    });
    setFeedback("");
  }

  function focusFirstError(next: FieldErrors) {
    const key = Object.keys(next)[0];
    requestAnimationFrame(() => {
      const el = document.getElementById(`corporate-${key}`) ?? formRef.current?.elements.namedItem(key);
      if (el instanceof HTMLElement) el.focus();
    });
  }

  function aria(name: string, hasHint = false) {
    const describedBy = errors[name] ? `corporate-${name}-error` : hasHint ? `corporate-${name}-hint` : undefined;
    return { id: `corporate-${name}`, name, "aria-invalid": Boolean(errors[name]), "aria-describedby": describedBy };
  }

  function goTo(index: number) {
    setStepIndex(index);
    setErrors({});
    setFeedback("");
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function handleFiles(kind: DocKind, event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    const rejected: string[] = [];
    const accepted: FileMeta[] = [];
    for (const file of picked) {
      const problem = validateFile(file);
      if (problem) rejected.push(problem);
      else accepted.push({ name: file.name, size: file.size });
    }
    // Apenas metadados são guardados: o MVP não persiste o conteúdo binário.
    setFiles((c) => ({ ...c, [kind]: [...c[kind], ...accepted].slice(0, 3) }));
    setFileMessages((c) => ({ ...c, [kind]: rejected.join(" ") }));
    if (accepted.length) setErrors((c) => ({ ...c, [kind === "company" ? "companyDoc" : "representativeDoc"]: "" }));
  }

  function removeFile(kind: DocKind, index: number) {
    setFiles((c) => ({ ...c, [kind]: c[kind].filter((_, i) => i !== index) }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const raw = validateStep(step.id, values, fileCount);
    const next = Object.fromEntries(Object.entries(raw).filter(([, m]) => m));
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(next);
      return;
    }
    if (!isLast) {
      goTo(stepIndex + 1);
      return;
    }
    pendingRef.current = true;
    setSubmitting(true);
    setFeedback("");
    try {
      const response = await onRegister(
        toCorporateRegistrationData(values, {
          company: files.company.map((f) => f.name),
          representative: files.representative.map((f) => f.name),
        }),
      );
      if (response.ok) {
        setResult(response);
        requestAnimationFrame(() => headingRef.current?.focus());
      } else {
        setFeedback(response.message);
        if (response.fieldErrors) {
          setErrors(response.fieldErrors);
          focusFirstError(response.fieldErrors);
        }
      }
    } catch {
      setFeedback("Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.");
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  }

  const text = (name: TextField, extra: { mask?: (v: string) => string; type?: string; autoComplete?: string; maxLength?: number; placeholder?: string; hint?: boolean } = {}) => (
    <input
      {...aria(name, extra.hint)}
      type={extra.type ?? "text"}
      value={values[name] as string}
      placeholder={extra.placeholder}
      autoComplete={extra.autoComplete ?? "off"}
      maxLength={extra.maxLength}
      onChange={(e) => update(name, (extra.mask ? extra.mask(e.target.value) : e.target.value) as never)}
    />
  );

  const select = (name: TextField, options: readonly string[], placeholder: string) => (
    <select {...aria(name)} value={values[name] as string} onChange={(e) => update(name, e.target.value as never)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  const brand = (
    <aside className="registration__visual" aria-label="SafraDireta">
      <img src={registrationImage} alt="" width="1792" height="2400" fetchPriority="high" />
      <div className="registration__brand">
        <Link to={routes.home}>SafraDireta</Link>
        <p>Conectando quem produz a quem compra.</p>
      </div>
    </aside>
  );

  if (result) {
    return (
      <section className="registration corporate" aria-labelledby="corporate-title">
        {brand}
        <div className="registration__content">
          <div className="registration__body corporate__done">
            <header className="registration__heading">
              <p className="eyebrow">Cadastro corporativo</p>
              <h1 id="corporate-title" ref={headingRef} tabIndex={-1}>Conta Corporativa Criada com Sucesso!</h1>
              <p>Protocolo: <strong className="corporate__protocol">{result.protocol}</strong></p>
            </header>
            <div className="registration__feedback" role="status">
              <strong>Status da conta: Em Análise Documental</strong>
              <p>{result.message} Sua empresa já pode navegar e visualizar os lotes do mercado. Compras e publicação de ofertas serão liberadas após a conferência dos documentos pela equipe do cliente (prazo estimado de 1 a 2 dias úteis).</p>
            </div>
            <div className="corporate__actions">
              <Link className="button registration__submit" to={routes.market}>Explorar o Mercado</Link>
              <Link className="corporate__secondary" to={routes.home}>Ir para a Página Inicial</Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="registration corporate" aria-labelledby="corporate-title">
      {brand}
      <div className="registration__content">
        <nav className="registration__navigation" aria-label="Navegação do cadastro corporativo">
          {stepIndex === 0
            ? <Link to={routes.registration} className="registration__back"><Icon name="back" /> Criar conta pessoal</Link>
            : <button type="button" className="registration__back corporate__back" onClick={() => goTo(stepIndex - 1)}><Icon name="back" /> Voltar</button>}
          <Link to={routes.home} className="icon-button" aria-label="Fechar cadastro e voltar ao início"><Icon name="close" /></Link>
        </nav>
        <div className="registration__body">
          <header className="registration__heading">
            <p className="eyebrow">Cadastro corporativo</p>
            <h1 id="corporate-title" ref={headingRef} tabIndex={-1}>Crie a conta da sua empresa</h1>
            <p>Cooperativas, torrefações, agroindústrias, cerealistas e tradings.</p>
          </header>
          <ol className="corporate__steps" aria-label="Etapas do cadastro">
            {steps.map((s, i) => (
              <li key={s.id} className={i === stepIndex ? "is-current" : i < stepIndex ? "is-done" : undefined} aria-current={i === stepIndex ? "step" : undefined}>
                <span className="corporate__steps-number">{i + 1}</span>
                <span className="corporate__steps-label">{s.label}</span>
              </li>
            ))}
          </ol>
          <form ref={formRef} noValidate onSubmit={handleSubmit} aria-busy={submitting}>
            <fieldset className="registration__fields" disabled={submitting}>
              <legend className="sr-only">Etapa {stepIndex + 1} de {steps.length}: {step.label}. Campos com asterisco são obrigatórios.</legend>

              {step.id === "company" && (<>
                <Field id="corporate-cnpj" label="CNPJ" required error={errors.cnpj} hint="Aceita CNPJ numérico e alfanumérico.">
                  {text("cnpj", { mask: formatCnpj, placeholder: "00.000.000/0001-00", maxLength: 18, hint: true })}
                </Field>
                <Field id="corporate-razaoSocial" label="Razão social" required error={errors.razaoSocial}>
                  {text("razaoSocial", { maxLength: 150, autoComplete: "organization" })}
                </Field>
                <Field id="corporate-nomeFantasia" label="Nome fantasia" error={errors.nomeFantasia}>
                  {text("nomeFantasia", { maxLength: 150 })}
                </Field>
                <Field id="corporate-naturezaJuridica" label="Natureza jurídica" error={errors.naturezaJuridica}>
                  {select("naturezaJuridica", naturezasJuridicas, "Selecione (opcional)")}
                </Field>
              </>)}

              {step.id === "address" && (<>
                <Field id="corporate-cep" label="CEP" required error={errors.cep}>
                  {text("cep", { mask: formatCep, placeholder: "00000-000", maxLength: 9, autoComplete: "postal-code" })}
                </Field>
                <Field id="corporate-logradouro" label="Logradouro" required error={errors.logradouro}>
                  {text("logradouro", { maxLength: 150, autoComplete: "address-line1" })}
                </Field>
                <div className="corporate__row">
                  <Field id="corporate-numero" label="Número" required error={errors.numero}>{text("numero", { maxLength: 10 })}</Field>
                  <Field id="corporate-complemento" label="Complemento" error={errors.complemento}>
                    {text("complemento", { maxLength: 60, placeholder: "Sala, galpão, bloco", autoComplete: "address-line2" })}
                  </Field>
                </div>
                <Field id="corporate-bairro" label="Bairro" required error={errors.bairro}>{text("bairro", { maxLength: 80 })}</Field>
                <div className="corporate__row">
                  <Field id="corporate-cidade" label="Cidade" required error={errors.cidade}>
                    {text("cidade", { maxLength: 80, autoComplete: "address-level2" })}
                  </Field>
                  <Field id="corporate-uf" label="UF" required error={errors.uf}>{select("uf", ufs, "UF")}</Field>
                </div>
              </>)}

              {step.id === "representative" && (<>
                <Field id="corporate-repNome" label="Nome completo do representante" required error={errors.repNome}>
                  {text("repNome", { maxLength: 150, autoComplete: "name" })}
                </Field>
                <Field id="corporate-repCpf" label="CPF do representante" required error={errors.repCpf}>
                  {text("repCpf", { mask: formatCpf, placeholder: "000.000.000-00", maxLength: 14 })}
                </Field>
                <Field id="corporate-repVinculo" label="Vínculo com a empresa" required error={errors.repVinculo}>
                  {select("repVinculo", vinculos, "Selecione o vínculo")}
                </Field>
              </>)}

              {step.id === "documents" && (<>
                <p className="corporate__hint">Os arquivos serão submetidos para validação manual pela equipe do cliente antes da liberação de compras e vendas. Formatos aceitos: PDF, JPG e PNG, até 10 MB.</p>
                {docKinds.map(({ kind, errorKey, label, hint }) => (
                  <div className="registration-field corporate__dropzone" key={kind}>
                    <label htmlFor={`corporate-${errorKey}`}>{label} <span aria-hidden="true">*</span></label>
                    <p className="corporate__hint" id={`corporate-${errorKey}-hint`}>{hint}</p>
                    <input
                      id={`corporate-${errorKey}`} name={errorKey} type="file" accept={ACCEPTED_FILE_TYPES.join(",")} multiple
                      aria-invalid={Boolean(errors[errorKey])}
                      aria-describedby={errors[errorKey] ? `corporate-${errorKey}-error` : `corporate-${errorKey}-hint`}
                      onChange={(e) => handleFiles(kind, e)}
                    />
                    {files[kind].length > 0 && (
                      <ul className="corporate__files">
                        {files[kind].map((f, i) => (
                          <li key={`${f.name}-${i}`}>
                            <span>{f.name} <small>({formatFileSize(f.size)})</small></span>
                            <button type="button" className="registration__text-button" onClick={() => removeFile(kind, i)} aria-label={`Remover ${f.name}`}>Remover</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {fileMessages[kind] && <p className="registration-field__error" role="alert">{fileMessages[kind]}</p>}
                    {errors[errorKey] && <p className="registration-field__error" id={`corporate-${errorKey}-error`}>{errors[errorKey]}</p>}
                  </div>
                ))}
              </>)}

              {step.id === "access" && (<>
                <Field id="corporate-email" label="E-mail corporativo de acesso" required error={errors.email}>
                  {text("email", { type: "email", maxLength: 254, autoComplete: "email", placeholder: "contato@empresa.com.br" })}
                </Field>
                <Field id="corporate-telefone" label="Telefone comercial" required error={errors.telefone}>
                  {text("telefone", { mask: formatPhone, type: "tel", maxLength: 15, autoComplete: "tel-national", placeholder: "(19) 3333-3333" })}
                </Field>
                <Field id="corporate-senha" label="Senha" required error={errors.senha}>
                  <div className="registration-field__control corporate__password">
                    {text("senha", { type: showPassword ? "text" : "password", maxLength: 128, autoComplete: "new-password", placeholder: "Mínimo de 8 caracteres" })}
                    <button className="icon-button registration-field__visibility" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword}>
                      <Icon name={showPassword ? "eyeOff" : "eye"} />
                    </button>
                  </div>
                </Field>
                <Field id="corporate-confirmarSenha" label="Confirmação de senha" required error={errors.confirmarSenha}>
                  {text("confirmarSenha", { type: showPassword ? "text" : "password", maxLength: 128, autoComplete: "new-password" })}
                </Field>
                <div>
                  <div className="registration__consent">
                    <input id="corporate-acceptedTerms" name="acceptedTerms" type="checkbox" checked={values.acceptedTerms}
                      onChange={(e) => update("acceptedTerms", e.target.checked)} aria-invalid={Boolean(errors.acceptedTerms)}
                      aria-describedby={errors.acceptedTerms ? "corporate-acceptedTerms-error" : undefined} />
                    <div>
                      <label htmlFor="corporate-acceptedTerms">Li e aceito os </label>
                      <button type="button" className="registration__text-button" onClick={() => onOpenDialog("terms")}>Termos de Uso</button>
                      <span> e a </span>
                      <button type="button" className="registration__text-button" onClick={() => onOpenDialog("privacy")}>Política de Privacidade</button>
                      <span> do SafraDireta.</span>
                    </div>
                  </div>
                  {errors.acceptedTerms && <p className="registration-field__error" id="corporate-acceptedTerms-error">{errors.acceptedTerms}</p>}
                </div>
              </>)}

              <button className="button registration__submit" type="submit" disabled={submitting}>
                {submitting ? "Enviando cadastro…" : isLast ? "Finalizar Cadastro Corporativo" : "Continuar"}
              </button>
              <p className="registration__login">Prefere uma conta pessoal? <Link to={routes.registration} className="registration__text-button">Criar conta pessoal</Link></p>
            </fieldset>
            <div aria-live="polite" aria-atomic="true">
              {feedback && <p className="registration__feedback registration__feedback--error">{feedback}</p>}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
