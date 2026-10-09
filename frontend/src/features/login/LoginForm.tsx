import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "../../components/Icon";
import { saveSession } from "../../context/session";
import { MOCK_API, mockDelay } from "../../dev/mockApi";

type LoginFormProps = {
  onPreview: () => void;
  onRecovery: () => void;
  onRegister: () => void;
  authenticationError?: string;
};

type FieldErrors = Partial<Record<"email" | "password", string>>;

function getFieldError(input: HTMLInputElement): string | undefined {
  if (input.validity.valueMissing) {
    return input.name === "email" ? "Informe seu e-mail." : "Informe sua senha.";
  }
  if (input.name === "email" && input.validity.typeMismatch) {
    return "Digite um e-mail válido, como nome@exemplo.com.";
  }
  return undefined;
}

export function LoginForm({ onPreview, onRecovery, onRegister, authenticationError }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [authError, setAuthError] = useState<string | undefined>(authenticationError);
  const [submitting, setSubmitting] = useState(false);

  function revalidateField(input: HTMLInputElement) {
    setAuthError(undefined);
    const field = input.name as keyof FieldErrors;
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: getFieldError(input) }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const email = emailRef.current;
    const password = passwordRef.current;
    if (!email || !password) return;
    const nextErrors = { email: getFieldError(email), password: getFieldError(password) };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      (nextErrors.email ? email : password).focus();
      return;
    }

    setSubmitting(true);
    setAuthError(undefined);
    if (MOCK_API) {
      // Simulação de dev: e-mails com "vendedor" entram como vendedor habilitado.
      await mockDelay(400);
      const address = email.value.trim().toLowerCase();
      const local = address.split("@")[0].replace(/[._-]+/g, " ").trim() || "Usuário";
      const nome = local.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
      saveSession("mock-token", { id: `mock-${address}`, tipo: "PF", nome, email: address }, address.includes("vendedor") ? "HABILITADO" : null);
      setSubmitting(false);
      onPreview();
      return;
    }
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value.trim(), password: password.value }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          saveSession(data.token, data.conta, data.vendedor?.estado ?? null);
        }
        onPreview();
        return;
      }

      if (response.status === 401) {
        setAuthError("E-mail ou senha incorretos.");
      } else if (response.status === 429) {
        setAuthError("Muitas tentativas sem sucesso. Aguarde 15 minutos.");
      } else if (response.status === 403) {
        setAuthError("Esta conta está suspensa ou inativa.");
      } else {
        const data = await response.json().catch(() => null);
        setAuthError(data?.erro?.mensagem ?? "Erro ao realizar login. Verifique seus dados.");
      }
    } catch {
      setAuthError("Não foi possível conectar ao servidor. Verifique sua conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" noValidate onSubmit={handleSubmit} aria-describedby="login-preview-note">
      <div className="login-form__field">
        <label htmlFor="login-email">E-mail <span aria-hidden="true">*</span></label>
        <input
          ref={emailRef} id="login-email" name="email" type="email"
          autoComplete="username" placeholder="seu@email.com.br" required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          onChange={(event) => revalidateField(event.currentTarget)}
        />
        <p id="login-email-error" className="login-form__error" aria-live="polite">{errors.email}</p>
      </div>
      <div className="login-form__field">
        <label htmlFor="login-password">Senha <span aria-hidden="true">*</span></label>
        <div className="login-form__password">
          <input
            ref={passwordRef} id="login-password" name="password"
            type={showPassword ? "text" : "password"} autoComplete="current-password" required
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "login-password-error" : undefined}
            onChange={(event) => revalidateField(event.currentTarget)}
          />
          <button type="button" className="icon-button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
            <Icon name={showPassword ? "eyeOff" : "eye"} />
          </button>
        </div>
        <p id="login-password-error" className="login-form__error" aria-live="polite">{errors.password}</p>
      </div>
      <button type="button" className="login-form__link login-form__recovery" onClick={onRecovery}>Esqueci a senha</button>
      <p id="login-preview-note" className="login-form__notice">Acesso em desenvolvimento. Ao entrar, você verá uma prévia do Mercado, sem autenticação da conta.</p>
      {authError && <p className="login-form__error" role="alert">{authError}</p>}
      <button type="submit" className="button button--dark" disabled={submitting}>
        {submitting ? "Entrando..." : "Entrar"}
      </button>
      <p className="login-form__registration">Não tem conta? <button type="button" className="login-form__link" onClick={onRegister}>Cadastre-se gratuitamente</button></p>
    </form>
  );
}
