import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "../data/site";
import { useAuth } from "../context/authContext";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import "./UserMenu.css";

export function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { session, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  if (!session) return null;
  const { conta, vendedorEstado, avatarUrl } = session;
  const firstName = conta.nome.trim().split(/\s+/)[0] || "Minha conta";
  const isSeller = vendedorEstado === "HABILITADO";

  function close(restoreFocus = false) {
    setOpen(false);
    onNavigate?.();
    if (restoreFocus) triggerRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close(true);
      return;
    }
    if (!open || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  async function handleSignOut() {
    close();
    await signOut();
    navigate(routes.home);
  }

  return (
    <div className="user-menu" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
      >
        <Avatar url={avatarUrl} name={conta.nome} size={32} />
        <span className="user-menu__name">{firstName}</span>
        <Icon name="chevron" />
      </button>
      {open && (
        <div id={menuId} className="user-menu__panel" role="menu" aria-label="Menu da conta">
          <div className="user-menu__identity">
            <Avatar url={avatarUrl} name={conta.nome} size={44} />
            <div>
              <strong>{conta.nome}</strong>
              <span>{conta.email}</span>
            </div>
          </div>
          <Link role="menuitem" to={routes.profile} onClick={() => close()}><Icon name="user" /> Meu perfil</Link>
          {conta.tipo !== "PJ" && (
            isSeller
              ? <Link role="menuitem" to={`${routes.profile}?aba=produtor`} onClick={() => close()}><Icon name="leaf" /> Área do produtor</Link>
              : vendedorEstado === "PENDENTE"
                ? <Link role="menuitem" to={`${routes.profile}`} onClick={() => close()}><Icon name="clock" /> Habilitação em análise</Link>
                : <Link role="menuitem" to={routes.sellerUpgrade} onClick={() => close()}><Icon name="leaf" /> Área do produtor</Link>
          )}
          <button type="button" role="menuitem" onClick={handleSignOut}><Icon name="back" /> Sair da conta</button>
        </div>
      )}
    </div>
  );
}
