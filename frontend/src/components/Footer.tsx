import { Link } from "react-router-dom";
import { routes } from "../data/site";
import type { OpenDevelopmentDialog } from "../data/site";
import { useAuth } from "../context/authContext";
import { Icon } from "./Icon";

const currentYear = new Date().getFullYear();

export function Footer({
  onOpenDialog,
}: {
  onOpenDialog: OpenDevelopmentDialog;
}) {
  const { session } = useAuth();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__about">
            <Link className="brand" to={routes.home}>
              Safra<span>Direta</span>
            </Link>
            <p>
              Do campo a novas possibilidades.
              <br />
              Um lugar para aproximar quem produz de quem procura.
            </p>
            <span className="site-footer__signature">
              <Icon name="leaf" />
              Cultivando boas conexões.
            </span>
          </div>
          <nav aria-label="Explorar">
            <h2>Explore</h2>
            <Link to={routes.market}>Mercado</Link>
            <Link to={routes.producers}>Produtores</Link>
            <Link to={routes.guide}>Como funciona</Link>
          </nav>
          <nav aria-label="Sua jornada">
            <h2>Sua jornada</h2>
            {session ? (
              <>
                <Link to={routes.profile}>Meu perfil</Link>
                {session.conta.tipo !== "PJ" && (
                  <Link to={session.vendedorEstado === "HABILITADO" ? `${routes.profile}?aba=produtor` : routes.sellerUpgrade}>
                    {session.vendedorEstado === "HABILITADO" ? "Área do produtor" : "Habilitar vendas"}
                  </Link>
                )}
                <Link to={routes.market}>Mercado</Link>
              </>
            ) : (
              <>
                <button type="button" onClick={() => onOpenDialog("registration")}>
                  Criar uma conta
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDialog("sellerRegistration")}
                >
                  Quero vender
                </button>
                <button type="button" onClick={() => onOpenDialog("login")}>
                  Acessar minha conta
                </button>
              </>
            )}
          </nav>
          <nav aria-label="Ajuda">
            <h2>Vamos conversar</h2>
            <p>
              Uma dúvida ou uma ideia?
              <br />
              Nosso canal está a caminho.
            </p>
            <button
              type="button"
              className="site-footer__contact"
              onClick={() => onOpenDialog("contact")}
            >
              Fale com a gente
              <Icon name="arrow" />
            </button>
          </nav>
        </div>
        <div className="site-footer__bottom">
          <p>© {currentYear} SafraDireta · Projeto acadêmico</p>
          <div>
            <button type="button" onClick={() => onOpenDialog("terms")}>
              Termos de uso
            </button>
            <button type="button" onClick={() => onOpenDialog("privacy")}>
              Privacidade
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
