import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { navigationCategories, routes } from "../data/site";
import type { OpenDevelopmentDialog } from "../data/site";
import { useAuth } from "../context/authContext";
import { Icon } from "./Icon";
import { UserMenu } from "./UserMenu";

export function Header({
  onOpenDialog,
}: {
  onOpenDialog: OpenDevelopmentDialog;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const { session } = useAuth();

  function closeMenus() {
    setMobileOpen(false);
    setCategoriesOpen(false);
  }

  useEffect(() => {
    function handlePointer(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMobileOpen(false);
        setCategoriesOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (categoriesOpen) {
        setCategoriesOpen(false);
        categoryButtonRef.current?.focus();
      } else if (mobileOpen) {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [categoriesOpen, mobileOpen]);

  function openDialog(feature: Parameters<OpenDevelopmentDialog>[0]) {
    // Preserve the trigger until the native dialog takes focus.
    onOpenDialog(feature);
  }

  return (
    <header className="site-header" ref={headerRef}>
      <div className="container site-header__inner">
        <Link
          to={routes.home}
          className="brand"
          aria-label="SafraDireta — início"
          onClick={closeMenus}
        >
          Safra<span>Direta</span>
          <span className="brand__label">Mercado</span>
        </Link>
        <button
          type="button"
          className="icon-button site-header__toggle"
          ref={mobileButtonRef}
          aria-label={mobileOpen ? "Fechar navegação" : "Abrir navegação"}
          aria-expanded={mobileOpen}
          aria-controls="primary-navigation"
          onClick={() => {
            setMobileOpen(!mobileOpen);
            setCategoriesOpen(false);
          }}
        >
          <Icon name={mobileOpen ? "close" : "menu"} />
        </button>
        <nav
          id="primary-navigation"
          className={`site-nav ${mobileOpen ? "site-nav--open" : ""}`}
          aria-label="Navegação principal"
        >
          <NavLink to={routes.market} onClick={closeMenus}>
            Mercado
          </NavLink>
          <div className="category-menu">
            <button
              type="button"
              ref={categoryButtonRef}
              className="category-menu__trigger"
              aria-expanded={categoriesOpen}
              aria-controls="category-links"
              onClick={() => setCategoriesOpen(!categoriesOpen)}
            >
              <Icon name="menu" /> Categorias <Icon name="chevron" />
            </button>
            {categoriesOpen && (
              <ul id="category-links" className="category-menu__list">
                {navigationCategories.map((category) => (
                  <li key={category}>
                    <Link to={routes.market} onClick={closeMenus}>
                      {category}
                      <Icon name="arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <NavLink to={routes.producers} onClick={closeMenus}>
            Produtores
          </NavLink>
          <NavLink to={routes.guide} onClick={closeMenus}>
            Como funciona
          </NavLink>
          <div className="site-nav__account">
            {session ? (<UserMenu onNavigate={closeMenus} />) : (<>
            <button
              type="button"
              className="button button--outline-light button--small"
              onClick={() => openDialog("login")}
            >
              Entrar
            </button>
            <button
              type="button"
              className="button button--primary button--small"
              onClick={() => openDialog("registration")}
            >
              Cadastre-se
            </button>
          </>)}
          </div>
        </nav>
      </div>
      <span className="sr-only">
        Página atual:{" "}
        {location.pathname === "/" ? "Início" : location.pathname.slice(1)}
      </span>
    </header>
  );
}
