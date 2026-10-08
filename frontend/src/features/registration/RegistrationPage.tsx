import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import registrationImage from "../../assets/images/registration-landscape.jpeg";
import { Icon } from "../../components/Icon";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { formatPhone, registerAccount, toRegistrationRequest, validateRegistration } from "./registration";
import type { RegisterAccount, RegistrationErrors, RegistrationValues } from "./registration";
import { PostRegistrationDialog } from "./PostRegistrationDialog";
import "./RegistrationPage.css";
import "../corporate-registration/CorporateRegistrationPage.css";

const initialValues: RegistrationValues = {
  name: "", email: "", phone: "", password: "", acceptedTerms: false,
};

const fields = [
  { name: "name", label: "Nome completo", placeholder: "Seu nome completo", icon: "user", type: "text", autoComplete: "name", maxLength: 150 },
  { name: "email", label: "E-mail", placeholder: "nome@exemplo.com", icon: "mail", type: "email", autoComplete: "email", maxLength: 254 },
  { name: "phone", label: "Telefone / WhatsApp", placeholder: "(19) 99999-9999", icon: "phone", type: "tel", autoComplete: "tel-national", maxLength: 15 },
  { name: "password", label: "Senha", placeholder: "Mínimo de 8 caracteres", icon: "lock", type: "password", autoComplete: "new-password", maxLength: 128 },
] as const;

export function RegistrationPage({ onOpenDialog, onRegister = registerAccount }: {
  onOpenDialog: OpenDevelopmentDialog;
  onRegister?: RegisterAccount;
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "unavailable" | "error" | "registered">("idle");
  const [message, setMessage] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef(false);
  const isSeller = searchParams.get("intencao") === "produtor";
  const isSubmitting = status === "submitting";
  const from = (location.state as { from?: string } | null)?.from;
  const returnTo = from && Object.values(routes).some((route) => route === from) && from !== routes.registration && from !== routes.corporateRegistration && from !== routes.sellerUpgrade ? from : routes.home;

  function updateField<K extends keyof RegistrationValues>(name: K, value: RegistrationValues[K]) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setStatus("idle");
    setMessage("");
  }

  function focusFirstError(nextErrors: RegistrationErrors) {
    const field = Object.keys(nextErrors)[0];
    const control = formRef.current?.elements.namedItem(field);
    if (control instanceof HTMLElement) control.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const nextErrors = validateRegistration(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus("idle");
      setMessage("");
      focusFirstError(nextErrors);
      return;
    }
    pendingRef.current = true;
    setStatus("submitting");
    setMessage("");
    try {
      const result = await onRegister(toRegistrationRequest(values, isSeller ? "seller" : "buyer"));
      setStatus(result.status);
      if (result.status === "unavailable") {
        setMessage("Integração em desenvolvimento — nenhuma conta foi criada. Seus dados não foram enviados nem salvos.");
      } else if (result.status === "error") {
        setMessage(result.message);
        setErrors(result.fieldErrors ?? {});
        if (result.fieldErrors) requestAnimationFrame(() => focusFirstError(result.fieldErrors ?? {}));
      } else {
        setValues(initialValues);
        // Intenção prévia de vender conduz direto à habilitação; senão, modal com duas opções.
        if (isSeller) navigate(routes.sellerUpgrade); else setWelcomeOpen(true);
        setMessage(isSeller ? "Conta criada. A habilitação como produtor será uma etapa adicional da sua conta." : "Sua conta foi criada com sucesso.");
      }
    } catch {
      setStatus("error");
      setMessage("Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.");
    } finally {
      pendingRef.current = false;
    }
  }

  if (status === "registered") {
    return (
      <section className="registration" aria-labelledby="registration-title">
        <aside className="registration__visual" aria-label="SafraDireta">
          <img src={registrationImage} alt="" width="1792" height="2400" fetchPriority="high" />
          <div className="registration__brand">
            <Link to={routes.home}>SafraDireta</Link>
            <p>Conectando quem produz a quem compra.</p>
          </div>
        </aside>
        <div className="registration__content">
          <div className="registration__body corporate__done">
            <header className="registration__heading">
              <p className="eyebrow">Cadastro concluído</p>
              <h1 id="registration-title" tabIndex={-1}>Conta criada com sucesso!</h1>
              <p>
                {isSeller
                  ? "Sua conta de produtor foi iniciada. Você já pode comprar e navegar pelos lotes do mercado. A etapa de habilitação de vendedor será solicitada no seu perfil."
                  : "Sua conta no SafraDireta está ativa e pronta para uso. Conecte-se ao campo e encontre as melhores ofertas."}
              </p>
            </header>
            <div className="corporate__actions">
              <Link className="button registration__submit" to={returnTo !== routes.home ? returnTo : routes.market}>
                {returnTo !== routes.home ? "Continuar navegando" : "Explorar o Mercado"}
              </Link>
              <Link className="corporate__secondary" to={routes.home}>
                Ir para a Página Inicial
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="registration" aria-labelledby="registration-title">
      <aside className="registration__visual" aria-label="SafraDireta">
        <img src={registrationImage} alt="" width="1792" height="2400" fetchPriority="high" />
        <div className="registration__brand">
          <Link to={routes.home}>SafraDireta</Link>
          <p>Conectando quem produz a quem compra.</p>
        </div>
      </aside>
      <div className="registration__content">
        <nav className="registration__navigation" aria-label="Navegação do cadastro">
          <Link to={returnTo} className="registration__back"><Icon name="back" /> Voltar</Link>
          <Link to={routes.home} className="icon-button" aria-label="Fechar cadastro e voltar ao início"><Icon name="close" /></Link>
        </nav>
        <div className="registration__body">
          <header className="registration__heading">
            <p className="eyebrow">Cadastro</p>
            <h1 id="registration-title">Crie sua conta</h1>
            <p>Conecte-se ao campo e encontre novas oportunidades no SafraDireta.</p>
          </header>
          <form ref={formRef} noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
            <fieldset className="registration__fields" disabled={isSubmitting}>
              <legend className="sr-only">Dados da sua conta. Todos os campos são obrigatórios.</legend>
              {fields.map((field) => (
                <div className="registration-field" key={field.name}>
                  <label htmlFor={`registration-${field.name}`}>{field.label} <span aria-hidden="true">*</span></label>
                  <div className="registration-field__control">
                    <Icon name={field.icon} />
                    <input
                      id={`registration-${field.name}`} name={field.name}
                      type={field.name === "password" && showPassword ? "text" : field.type}
                      value={values[field.name]} placeholder={field.placeholder}
                      autoComplete={field.autoComplete} maxLength={field.maxLength}
                      required aria-invalid={Boolean(errors[field.name])}
                      aria-describedby={errors[field.name] ? `registration-${field.name}-error` : undefined}
                      onChange={(event) => updateField(field.name, field.name === "phone" ? formatPhone(event.target.value) : event.target.value)}
                      onBlur={() => setErrors((current) => ({ ...current, [field.name]: validateRegistration(values)[field.name] }))}
                    />
                    {field.name === "password" && (
                      <button className="icon-button registration-field__visibility" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword}>
                        <Icon name={showPassword ? "eyeOff" : "eye"} />
                      </button>
                    )}
                  </div>
                  {errors[field.name] && <p className="registration-field__error" id={`registration-${field.name}-error`}>{errors[field.name]}</p>}
                </div>
              ))}
              <div>
                <div className="registration__consent">
                  <input id="registration-terms" aria-labelledby="registration-consent-text" name="acceptedTerms" type="checkbox" required checked={values.acceptedTerms} onChange={(event) => updateField("acceptedTerms", event.target.checked)} aria-invalid={Boolean(errors.acceptedTerms)} aria-describedby={errors.acceptedTerms ? "registration-terms-error" : undefined} />
                  <div id="registration-consent-text">
                    <label htmlFor="registration-terms">Li e aceito os </label>
                    <button type="button" className="registration__text-button" onClick={() => onOpenDialog("terms")}>Termos de Uso</button>
                    <span> e a </span>
                    <button type="button" className="registration__text-button" onClick={() => onOpenDialog("privacy")}>Política de Privacidade</button>
                    <span> do SafraDireta.</span>
                  </div>
                </div>
                {errors.acceptedTerms && <p className="registration-field__error" id="registration-terms-error">{errors.acceptedTerms}</p>}
              </div>
              <button className="button registration__submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Enviando cadastro…" : "Criar conta gratuita"}
              </button>
              <div className="registration__seller">
                <button type="button" className="registration__seller-toggle" aria-expanded={isSeller} aria-controls="registration-seller-info" onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  if (isSeller) next.delete("intencao"); else next.set("intencao", "produtor");
                  setSearchParams(next, { replace: true, state: location.state });
                  setStatus("idle"); setMessage("");
                }}>
                  <span><Icon name="leaf" /> Sou produtor — também quero vender</span>
                  <Icon name="chevron" />
                </button>
                <div id="registration-seller-info" hidden={!isSeller}>
                  <p>Comece criando sua conta. Você poderá comprar e habilitar a venda no mesmo perfil.</p>
                  <p>O cadastro de produtor está em desenvolvimento. Os dados e documentos serão solicitados em uma próxima etapa.</p>
                </div>
              </div>
              <p className="registration__login">É uma empresa? <Link to={routes.corporateRegistration} className="registration__text-button">Crie uma conta corporativa</Link></p>
              <p className="registration__login">Já tem conta? <button type="button" className="registration__text-button" onClick={() => onOpenDialog("login")}>Entrar</button></p>
            </fieldset>
            <div aria-live="polite" aria-atomic="true">
              {message && <p className={`registration__feedback registration__feedback--${status}`}>{message}</p>}
            </div>
          </form>
        </div>
      </div>
      <PostRegistrationDialog open={welcomeOpen} onClose={() => setWelcomeOpen(false)} />
    </section>
  );
}
