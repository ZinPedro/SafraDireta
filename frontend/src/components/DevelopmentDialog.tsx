import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { developmentFeatures } from "../data/site";
import type { DevelopmentFeature } from "../data/site";
import { Icon } from "./Icon";

export function DevelopmentDialog({
  feature,
  onClose,
}: {
  feature: DevelopmentFeature | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!feature || !dialog) return;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [feature]);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  const content = feature ? developmentFeatures[feature] : null;

  return (
    <dialog
      ref={dialogRef}
      onKeyDown={handleKeyDown}
      className="development-dialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
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
          )
            onClose();
        }
      }}
    >
      <button
        type="button"
        className="icon-button development-dialog__close"
        aria-label="Fechar janela"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      <span className="status-icon">
        <Icon name="clock" />
      </span>
      <p className="eyebrow">Em desenvolvimento</p>
      <h2 id="dialog-title">{content?.title}</h2>
      <p id="dialog-description">{content?.description}</p>
      <button type="button" className="button button--dark" onClick={onClose}>
        Entendi, continuar explorando
        <Icon name="arrow" />
      </button>
    </dialog>
  );
}
