import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import registrationImage from "../../assets/images/registration-landscape.jpeg";
import { Icon } from "../../components/Icon";
import { routes } from "../../data/site";
import { useAuth } from "../../context/authContext";
import { getSession } from "../../context/session";
import { loadUserProfile } from "../profile/profile";
import {
  ACCEPTED_FILE_TYPES, defaultUpgradeToSeller, formatCpf, formatFileSize, initialSellerValues,
  sellerCategories, toSellerUpgradeData, ufs, validateFile, validateSellerUpgrade,
} from "./sellerUpgrade";
import type { SellerCategory, SellerUpgradeValues, UpgradeToSeller } from "./sellerUpgrade";
import "../registration/RegistrationPage.css";
import "../corporate-registration/CorporateRegistrationPage.css";
import "./SellerUpgradePage.css";

type FileMeta = { name: string; size: number };
type DocKey = "cpfFrontDoc" | "cpfBackDoc" | "carDoc";

function FileSlot({ id, label, hint, required, file, error, message, onPick, onRemove }: {
  id: DocKey; label: string; hint: string; required?: boolean; file: FileMeta | null;
  error?: string; message?: string; onPick: (e: ChangeEvent<HTMLInputElement>) => void; onRemove: () => void;
}) {
  return (
    <div className="registration-field corporate__dropzone">
      <label htmlFor={`seller-${id}`}>{label} {required && <span aria-hidden="true">*</span>}</label>
      <p className="corporate__hint" id={`seller-${id}-hint`}>{hint}</p>
      <input
        id={`seller-${id}`} name={id} type="file" accept={ACCEPTED_FILE_TYPES.join(",")}
        aria-invalid={Boolean(error)} aria-describedby={error ? `seller-${id}-error` : `seller-${id}-hint`}
        onChange={onPick}
      />
      {file && (
        <ul className="corporate__files">
          <li>
            <span>{file.name} <small>({formatFileSize(file.size)})</small></span>
            <button type="button" className="registration__text-button" onClick={onRemove} aria-label={`Remover ${file.name}`}>Remover</button>
          </li>
        </ul>
      )}
      {message && <p className="registration-field__error" role="alert">{message}</p>}
      {error && <p className="registration-field__error" id={`seller-${id}-error`}>{error}</p>}
    </div>
  );
}

export function SellerUpgradePage({ onUpgrade = defaultUpgradeToSeller }: { onUpgrade?: UpgradeToSeller }) {
  const { session, setVendedorEstado } = useAuth();
  const isAlreadyHabilitado = session?.vendedorEstado === "HABILITADO";

  const [lockedCpf, setLockedCpf] = useState<string>(() => {
    const s = getSession();
    if (s) {
      try {
        const raw = localStorage.getItem(`safradireta_mock_profile:${s.conta.id}`);
        if (raw) {
          const stored = JSON.parse(raw);
          const rawCpf = stored.account?.cpfCnpj || "";
          return rawCpf ? formatCpf(rawCpf) : "";
        }
      } catch {
        /* ignore */
      }
    }
    return "";
  });

  const [values, setValues] = useState<SellerUpgradeValues>(() => {
    const s = getSession();
    if (s) {
      try {
        const raw = localStorage.getItem(`safradireta_mock_profile:${s.conta.id}`);
        if (raw) {
          const stored = JSON.parse(raw);
          const rawCpf = stored.account?.cpfCnpj || "";
          const cpf = rawCpf ? formatCpf(rawCpf) : "";
          const city = stored.address?.cidade ?? "";
          const state = stored.address?.uf ?? "";
          return {
            ...initialSellerValues,
            cpf,
            city,
            state,
          };
        }
      } catch {
        /* ignore */
      }
    }
    return initialSellerValues;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<DocKey, FileMeta | null>>({ cpfFrontDoc: null, cpfBackDoc: null, carDoc: null });
  const [fileMessages, setFileMessages] = useState<Record<DocKey, string>>({ cpfFrontDoc: "", cpfBackDoc: "", carDoc: "" });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    loadUserProfile().then((res) => {
      if (!active || !res.ok) return;
      const { account, address } = res.profile;
      const accountCpf = account.cpfCnpj ? formatCpf(account.cpfCnpj) : "";
      if (accountCpf) {
        setLockedCpf(accountCpf);
      }
      setValues((current) => ({
        ...current,
        cpf: accountCpf || current.cpf,
        city: current.city || address.cidade || "",
        state: current.state || address.uf || "",
      }));
    });
    return () => {
      active = false;
    };
  }, [session]);

  function clearError(key: string) {
    setErrors((c) => {
      if (!c[key]) return c;
      const { [key]: _removed, ...rest } = c;
      return rest;
    });
    setFeedback("");
  }

  function update<K extends keyof SellerUpgradeValues>(name: K, value: SellerUpgradeValues[K]) {
    setValues((c) => ({ ...c, [name]: value }));
    clearError(name);
  }

  function toggleCategory(category: SellerCategory) {
    update("categories", values.categories.includes(category)
      ? values.categories.filter((c) => c !== category)
      : [...values.categories, category]);
  }

  function pickFile(key: DocKey, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validateFile(file);
    setFileMessages((c) => ({ ...c, [key]: problem ?? "" }));
    if (problem) return;
    // Apenas metadados: o conteúdo binário não é persistido no MVP.
    setFiles((c) => ({ ...c, [key]: { name: file.name, size: file.size } }));
    clearError(key);
  }

  function focusFirstError(next: Record<string, string>) {
    const key = Object.keys(next)[0];
    requestAnimationFrame(() => {
      const el = key === "categories"
        ? formRef.current?.querySelector<HTMLElement>("input[name='categories']")
        : key === "transport"
          ? formRef.current?.querySelector<HTMLElement>("input[name='transport']")
          : document.getElementById(`seller-${key}`);
      el?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const valuesToValidate = lockedCpf ? { ...values, cpf: lockedCpf } : values;
    const next = validateSellerUpgrade(valuesToValidate, { front: Boolean(files.cpfFrontDoc), back: Boolean(files.cpfBackDoc) });
    setErrors(next);
    if (Object.keys(next).length) {
      focusFirstError(next);
      return;
    }
    pendingRef.current = true;
    setSubmitting(true);
    setFeedback("");
    try {
      const result = await onUpgrade(toSellerUpgradeData(valuesToValidate, files.cpfFrontDoc?.name, files.cpfBackDoc?.name, files.carDoc?.name));
      if (result.ok) {
        setVendedorEstado("HABILITADO");
        setDoneMessage(result.message);
        requestAnimationFrame(() => headingRef.current?.focus());
      } else {
        setFeedback(result.message);
        if (result.fieldErrors) {
          setErrors(result.fieldErrors);
          focusFirstError(result.fieldErrors);
        }
      }
    } catch {
      setFeedback("Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.");
    } finally {
      pendingRef.current = false;
      setSubmitting(false);
    }
  }

  const err = (name: string) => ({
    id: `seller-${name}`, name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `seller-${name}-error` : undefined,
  });
  const fieldError = (name: string) => errors[name] && <p className="registration-field__error" id={`seller-${name}-error`}>{errors[name]}</p>;

  return (
    <section className="registration corporate seller-upgrade" aria-labelledby="seller-title">
      <aside className="registration__visual" aria-label="SafraDireta">
        <img src={registrationImage} alt="" width="1792" height="2400" fetchPriority="high" />
        <div className="registration__brand">
          <Link to={routes.home}>SafraDireta</Link>
          <p>Conectando quem produz a quem compra.</p>
        </div>
      </aside>
      <div className="registration__content">
        <nav className="registration__navigation" aria-label="Navegação da habilitação">
          <Link to={routes.home} className="registration__back"><Icon name="back" /> Voltar ao início</Link>
          <Link to={routes.home} className="icon-button" aria-label="Fechar e voltar ao início"><Icon name="close" /></Link>
        </nav>
        <div className="registration__body">
          {doneMessage || isAlreadyHabilitado ? (
            <div className="corporate__done">
              <header className="registration__heading">
                <p className="eyebrow">Vendedor</p>
                <h1 id="seller-title" ref={headingRef} tabIndex={-1}>{doneMessage ?? "Sua conta já está habilitada como vendedor!"}</h1>
              </header>
              <div className="registration__feedback" role="status">
                <strong className="seller-upgrade__badge"><Icon name="leaf" /> Vendedor Habilitado</strong>
                <p>Você já pode publicar anúncios com a mesma conta. Sua capacidade de compra continua inalterada.</p>
              </div>
              <div className="corporate__actions">
                <Link className="button registration__submit" to={routes.market}>Explorar o Mercado</Link>
                <Link className="corporate__secondary" to={routes.home}>Ir para a Página Inicial</Link>
              </div>
            </div>
          ) : (<>
            <header className="registration__heading">
              <p className="eyebrow">Venda sua produção</p>
              <h1 id="seller-title" ref={headingRef} tabIndex={-1}>Habilite sua conta como vendedor</h1>
              <p>Conecte sua colheita a compradores de todo o país, sem intermediários. Você continua com a mesma conta e pode seguir comprando.</p>
            </header>
            <form ref={formRef} noValidate onSubmit={handleSubmit} aria-busy={submitting}>
              <fieldset className="registration__fields" disabled={submitting}>
                <legend className="sr-only">Dados do produtor. Campos com asterisco são obrigatórios.</legend>

                <h2 className="seller-upgrade__section">1. Identificação do produtor</h2>
                {lockedCpf ? (
                  <div className="registration-field seller-upgrade__locked">
                    <label htmlFor="seller-cpf"><Icon name="lock" /> CPF</label>
                    <input
                      id="seller-cpf"
                      name="cpf"
                      type="text"
                      value={lockedCpf}
                      readOnly
                      aria-readonly="true"
                      aria-describedby="seller-cpf-locked-hint"
                    />
                    <p className="corporate__hint" id="seller-cpf-locked-hint">
                      CPF vinculado à sua conta como dado protegido. Não pode ser alterado.
                    </p>
                  </div>
                ) : (
                  <div className="registration-field">
                    <label htmlFor="seller-cpf">CPF <span aria-hidden="true">*</span></label>
                    <input
                      {...err("cpf")}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={14}
                      placeholder="000.000.000-00"
                      value={values.cpf}
                      onChange={(e) => update("cpf", formatCpf(e.target.value))}
                      aria-describedby={errors.cpf ? "seller-cpf-error" : "seller-cpf-hint"}
                    />
                    <p className="corporate__hint" id="seller-cpf-hint">
                      O CPF informado será vinculado permanentemente à sua conta como dado protegido.
                    </p>
                    {fieldError("cpf")}
                  </div>
                )}

                <h2 className="seller-upgrade__section">2. Propriedade e localização</h2>
                <div className="registration-field">
                  <label htmlFor="seller-farmName">Nome da propriedade / fazenda <span aria-hidden="true">*</span></label>
                  <input {...err("farmName")} type="text" maxLength={150} autoComplete="off" placeholder="Ex.: Fazenda Santa Maria"
                    value={values.farmName} onChange={(e) => update("farmName", e.target.value)} />
                  {fieldError("farmName")}
                </div>
                <div className="corporate__row">
                  <div className="registration-field">
                    <label htmlFor="seller-city">Cidade <span aria-hidden="true">*</span></label>
                    <input {...err("city")} type="text" maxLength={80} autoComplete="address-level2"
                      value={values.city} onChange={(e) => update("city", e.target.value)} />
                    {fieldError("city")}
                  </div>
                  <div className="registration-field">
                    <label htmlFor="seller-state">UF <span aria-hidden="true">*</span></label>
                    <select {...err("state")} value={values.state} onChange={(e) => update("state", e.target.value)}>
                      <option value="">UF</option>
                      {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    {fieldError("state")}
                  </div>
                </div>

                <h2 className="seller-upgrade__section">3. Categorias que produz</h2>
                <fieldset className="seller-upgrade__group" aria-describedby={errors.categories ? "seller-categories-error" : undefined}>
                  <legend className="sr-only">Categorias que você produz. Selecione ao menos uma.</legend>
                  <div className="seller-upgrade__chips">
                    {sellerCategories.map((c) => (
                      <label key={c.value} className="seller-upgrade__chip">
                        <input type="checkbox" name="categories" value={c.value} checked={values.categories.includes(c.value)}
                          aria-invalid={Boolean(errors.categories)} onChange={() => toggleCategory(c.value)} />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                  {fieldError("categories")}
                </fieldset>

                <h2 className="seller-upgrade__section">4. Logística e frete</h2>
                <fieldset className="seller-upgrade__group" aria-describedby={errors.transport ? "seller-transport-error" : undefined}>
                  <legend className="sr-only">Contexto de transporte</legend>
                  {([["own", "Possuo transporte próprio para entrega da carga"], ["buyer", "Frete por conta do comprador / transportadora terceirizada"]] as const).map(([value, label]) => (
                    <label key={value} className="seller-upgrade__radio">
                      <input type="radio" name="transport" value={value} checked={values.transport === value}
                        aria-invalid={Boolean(errors.transport)} onChange={() => update("transport", value)} />
                      <span>{label}</span>
                    </label>
                  ))}
                  {fieldError("transport")}
                </fieldset>

                <h2 className="seller-upgrade__section">5. Documentos</h2>
                <FileSlot id="cpfFrontDoc" required label="Documento com CPF — frente" hint="Foto da frente do RG ou CNH, com o CPF visível. PDF, JPG ou PNG, até 10 MB."
                  file={files.cpfFrontDoc} error={errors.cpfFrontDoc} message={fileMessages.cpfFrontDoc}
                  onPick={(e) => pickFile("cpfFrontDoc", e)} onRemove={() => setFiles((c) => ({ ...c, cpfFrontDoc: null }))} />
                <FileSlot id="cpfBackDoc" required label="Documento com CPF — verso" hint="Foto do verso do mesmo documento. PDF, JPG ou PNG, até 10 MB."
                  file={files.cpfBackDoc} error={errors.cpfBackDoc} message={fileMessages.cpfBackDoc}
                  onPick={(e) => pickFile("cpfBackDoc", e)} onRemove={() => setFiles((c) => ({ ...c, cpfBackDoc: null }))} />
                <FileSlot id="carDoc" label="Inscrição Estadual de Produtor Rural ou CAR (opcional)" hint="Documento opcional que poderá conceder selo de produtor verificado no futuro."
                  file={files.carDoc} message={fileMessages.carDoc}
                  onPick={(e) => pickFile("carDoc", e)} onRemove={() => setFiles((c) => ({ ...c, carDoc: null }))} />

                <button className="button registration__submit" type="submit" disabled={submitting}>
                  {submitting ? "Enviando…" : "Concluir Habilitação de Vendedor"}
                </button>
                <p className="registration__login"><Link to={routes.home} className="registration__text-button">Fazer isso mais tarde</Link></p>
              </fieldset>
              <div aria-live="polite" aria-atomic="true">
                {feedback && <p className="registration__feedback registration__feedback--error">{feedback}</p>}
              </div>
            </form>
          </>)}
        </div>
      </div>
    </section>
  );
}
