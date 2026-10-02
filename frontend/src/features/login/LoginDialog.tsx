import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon } from "../../components/Icon";
import registrationImage from "../../assets/images/registration-landscape.jpeg";
import { LoginForm } from "./LoginForm";
import "./LoginDialog.css";

type LoginDialogProps = {
  onClose: () => void;
  onPreview: () => void;
  onRegister: () => void;
};

export function LoginDialog({ onClose, onPreview, onRegister }: LoginDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [view, setView] = useState<"login" | "recovery">("login");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [view]);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href]");
    const first = controls[0];
    const last = controls[controls.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === headingRef.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <dialog ref={dialogRef} className="login-dialog" aria-labelledby="login-title" onKeyDown={handleKeyDown}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <div className="login-dialog__layout">
        <div className="login-dialog__visual" aria-hidden="true">
          <img src={registrationImage} alt="" />
          <div className="login-dialog__brand"><p>SafraDireta</p><span>Conectando o campo a bons negócios.</span></div>
        </div>
        <div className="login-dialog__content">
          <div className="login-dialog__navigation">
            <button type="button" className="login-dialog__back" onClick={() => view === "recovery" ? setView("login") : onClose()}><Icon name="back" /> Voltar</button>
            <button type="button" className="icon-button" aria-label="Fechar login" onClick={onClose}><Icon name="close" /></button>
          </div>
          <p className="eyebrow">{view === "login" ? "Acesso" : "Em desenvolvimento"}</p>
          <h2 id="login-title" ref={headingRef} tabIndex={-1}>{view === "login" ? "Entre na sua conta" : "Recuperação de senha"}</h2>
          {view === "login" ? <LoginForm onPreview={onPreview} onRecovery={() => setView("recovery")} onRegister={onRegister} /> : (
            <div className="login-dialog__recovery">
              <p>A recuperação de senha estará disponível em breve. Nenhum e-mail foi enviado.</p>
              <button type="button" className="button button--dark" onClick={() => setView("login")}>Voltar para o login</button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
