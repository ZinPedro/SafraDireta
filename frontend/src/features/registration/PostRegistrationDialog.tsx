import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { routes } from "../../data/site";
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
      <p id="post-registration-description">Como você quer começar? Você pode habilitar a venda agora ou a qualquer momento, na mesma conta.</p>
      <div className="post-registration-dialog__actions">
        <Link className="button" to={routes.sellerUpgrade} onClick={onClose}>Habilitar Vendas</Link>
        <Link className="button button--outline" to={routes.market} onClick={onClose}>Explorar o Mercado</Link>
      </div>
    </dialog>
  );
}
