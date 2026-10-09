import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { routes } from "../../data/site";
import "../corporate-registration/CorporateRegistrationPage.css";
import "../seller-upgrade/SellerUpgradePage.css";

export function PostRegistrationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    titleRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="post-registration-dialog"
      aria-labelledby="post-registration-title"
      aria-describedby="post-registration-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <h2 id="post-registration-title" ref={titleRef} tabIndex={-1}>Sua conta foi criada!</h2>
      <p id="post-registration-description">Como você quer começar? Acesse os dados da sua conta ou comece a explorar as ofertas no mercado.</p>
      <div className="post-registration-dialog__actions">
        <Link className="button" to={routes.profile} onClick={onClose}>Meu Perfil</Link>
        <Link className="button button--outline" to={routes.market} onClick={onClose}>Explorar o Mercado</Link>
        <Link className="corporate__secondary" to={routes.sellerUpgrade} onClick={onClose} style={{ textAlign: "center", marginTop: "var(--space-2)" }}>
          Deseja comercializar lotes? Habilitar vendas
        </Link>
      </div>
    </dialog>
  );
}
