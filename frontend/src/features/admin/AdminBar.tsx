import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { clearSession } from "../../context/session";
import { ADMIN_SECRET_SLUG, routes } from "../../data/site";
import "./admin.css";

export function AdminBar() {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (session?.conta.tipo !== "ADMIN") {
    return null;
  }

  // Não exibe a barra flutuante dentro do próprio painel administrativo
  if (location.pathname === ADMIN_SECRET_SLUG) {
    return null;
  }

  const handleLogoutAdmin = () => {
    clearSession();
    navigate(routes.home);
  };

  return (
    <div className="admin-audit-bar" role="region" aria-label="Barra de Auditoria Administrativa">
      <div className="container admin-audit-bar__inner">
        <div className="admin-audit-bar__info">
          <span className="admin-audit-bar__shield" aria-hidden="true">
            🛡️
          </span>
          <span className="admin-audit-bar__label">
            <strong>Modo Administrador</strong> — Navegando como Auditor
          </span>
          <span className="admin-audit-bar__user">({session.conta.email})</span>
        </div>

        <div className="admin-audit-bar__actions">
          <Link to={ADMIN_SECRET_SLUG} className="admin-audit-bar__btn admin-audit-bar__btn--primary">
            Painel de Gestão ↗
          </Link>
          <button
            type="button"
            onClick={handleLogoutAdmin}
            className="admin-audit-bar__btn admin-audit-bar__btn--ghost"
          >
            Encerrar Auditoria
          </button>
        </div>
      </div>
    </div>
  );
}
