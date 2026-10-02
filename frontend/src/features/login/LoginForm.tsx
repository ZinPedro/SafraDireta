import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "../../components/Icon";

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

  function revalidateField(input: HTMLInputElement) {
    const field = input.name as keyof FieldErrors;
    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: getFieldError(input) }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = emailRef.current;
    const password = passwordRef.current;
    if (!email || !password) return;
    const nextErrors = { email: getFieldError(email), password: getFieldError(password) };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      (nextErrors.email ? email : password).focus();
      return;
    }
    // O backend validará as credenciais; por enquanto, apenas abre a prévia.
    onPreview();
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
      {authenticationError && <p className="login-form__error" role="alert">{authenticationError}</p>}
      <button type="submit" className="button button--dark">Entrar</button>
      <p className="login-form__registration">Não tem conta? <button type="button" className="login-form__link" onClick={onRegister}>Cadastre-se gratuitamente</button></p>
    </form>
  );
}
