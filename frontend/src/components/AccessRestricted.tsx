import { Link } from "react-router-dom";
import { routes } from "../data/site";
import { useAuth } from "../context/authContext";
import { Icon } from "./Icon";
import "./AccessRestricted.css";

interface AccessRestrictedProps {
  title?: string;
  description?: string;
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
}

export function AccessRestricted({
  title = "Área exclusiva para produtores rurais habilitados",
  description = "Para anunciar lotes de animais e gerenciar sua produção no SafraDireta, você precisa ter uma conta com habilitação de vendedor aprovada.",
  onOpenLogin,
  onOpenRegister,
}: AccessRestrictedProps) {
  const { session } = useAuth();

  return (
    <div className="access-restricted-page">
      <div className="container">
        <div className="access-restricted-card">
          <div className="access-restricted-card__icon-wrapper" aria-hidden="true">
            <Icon name="lock" className="access-restricted-card__icon" />
          </div>

          <p className="eyebrow access-restricted-card__eyebrow">Acesso Restrito</p>
          <h1 className="access-restricted-card__title">{title}</h1>
          <p className="access-restricted-card__description">{description}</p>

          <div className="access-restricted-card__actions">
            {session ? (
              <>
                <Link to={routes.sellerUpgrade} className="button button--primary">
                  <Icon name="leaf" /> Habilitar cadastro de vendedor
                </Link>
                <Link to={routes.market} className="button button--outline">
                  Explorar o mercado
                </Link>
              </>
            ) : (
              <>
                {onOpenLogin ? (
                  <button type="button" className="button button--primary" onClick={onOpenLogin}>
                    Entrar na minha conta
                  </button>
                ) : (
                  <Link to={routes.home} className="button button--primary">
                    Ir para o início
                  </Link>
                )}

                {onOpenRegister ? (
                  <button type="button" className="button button--outline" onClick={onOpenRegister}>
                    Criar conta com intenção de venda
                  </button>
                ) : (
                  <Link to={`${routes.registration}?intencao=produtor`} className="button button--outline">
                    Criar conta de produtor
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
