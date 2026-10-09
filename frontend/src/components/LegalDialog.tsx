import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { termsOfUse, privacyPolicy } from "../data/legal";
import { Icon } from "./Icon";
import "./LegalDialog.css";

export type LegalTab = "terms" | "privacy";

interface LegalDialogProps {
  initialTab?: LegalTab;
  onClose: () => void;
}

export function LegalDialog({ initialTab = "terms", onClose }: LegalDialogProps) {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const documentData = activeTab === "terms" ? termsOfUse : privacyPolicy;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = "hidden";
    titleRef.current?.focus();

    return () => {
      dialog.close();
      document.body.style.overflow = previousBodyOverflow;
      if (previousActiveElement && previousActiveElement.isConnected) {
        previousActiveElement.focus();
      }
    };
  }, []);

  function handleTabChange(tab: LegalTab) {
    setActiveTab(tab);
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;

    const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="legal-dialog"
      aria-labelledby="legal-dialog-title"
      aria-describedby="legal-dialog-desc"
      onKeyDown={handleKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          ) {
            onClose();
          }
        }
      }}
    >
      <header className="legal-dialog__header">
        <div className="legal-dialog__top">
          <div className="legal-dialog__tabs" role="tablist" aria-label="Documentos legais">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "terms"}
              className={`legal-dialog__tab ${activeTab === "terms" ? "legal-dialog__tab--active" : ""}`}
              onClick={() => handleTabChange("terms")}
            >
              Termos de Uso
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "privacy"}
              className={`legal-dialog__tab ${activeTab === "privacy" ? "legal-dialog__tab--active" : ""}`}
              onClick={() => handleTabChange("privacy")}
            >
              Privacidade
            </button>
          </div>
          <button
            type="button"
            className="legal-dialog__close"
            aria-label="Fechar janela"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="legal-dialog__meta">
          <h2 id="legal-dialog-title" ref={titleRef} tabIndex={-1} className="legal-dialog__title">
            {documentData.title}
          </h2>
          <span className="legal-dialog__badge">
            Versão {documentData.version} · {documentData.lastUpdated}
          </span>
        </div>
        <p id="legal-dialog-desc" className="legal-dialog__subtitle">
          {documentData.subtitle}
        </p>
      </header>

      <div ref={bodyRef} className="legal-dialog__body" tabIndex={0} role="region" aria-label="Conteúdo do documento">
        <div className="legal-dialog__intro">
          <p>{documentData.introduction}</p>
        </div>

        {documentData.sections.map((section) => (
          <section key={section.id} className="legal-dialog__section" aria-labelledby={`sec-${section.id}`}>
            <h3 id={`sec-${section.id}`} className="legal-dialog__section-title">
              {section.title}
            </h3>

            {section.content.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}

            {section.bulletPoints && section.bulletPoints.length > 0 && (
              <ul className="legal-dialog__list">
                {section.bulletPoints.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            )}

            {section.alert && (
              <div className="legal-dialog__alert" role="note">
                <p>{section.alert}</p>
              </div>
            )}

            {section.contentExtra && (
              <p>{section.contentExtra}</p>
            )}
          </section>
        ))}
      </div>

      <footer className="legal-dialog__footer">
        <span className="legal-dialog__footer-note">
          <Icon name="leaf" />
          SafraDireta · Projeto Acadêmico PUC-Campinas
        </span>
        <div className="legal-dialog__footer-actions">
          <button
            type="button"
            className="button button--outline-light button--small"
            onClick={() => handleTabChange(activeTab === "terms" ? "privacy" : "terms")}
          >
            {activeTab === "terms" ? "Ver Política de Privacidade" : "Ver Termos de Uso"}
          </button>
          <button
            type="button"
            className="button button--primary button--small"
            onClick={onClose}
          >
            Entendi e fechar
          </button>
        </div>
      </footer>
    </dialog>
  );
}
