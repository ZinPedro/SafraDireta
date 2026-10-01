import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { routes } from "../data/site";
import type { OpenDevelopmentDialog } from "../data/site";

type DevelopmentPageProps = {
  title: string;
  description: string;
  onOpenDialog: OpenDevelopmentDialog;
  notFound?: boolean;
};

export function DevelopmentPage({
  title,
  description,
  onOpenDialog,
  notFound = false,
}: DevelopmentPageProps) {
  return (
    <section className="development-page container">
      <span className="status-icon">
        <Icon name={notFound ? "location" : "leaf"} />
      </span>
      <p className="eyebrow">
        {notFound ? "Página não encontrada" : "Em desenvolvimento"}
      </p>
      <h1>{title}</h1>
      <p className="development-page__description">{description}</p>
      <div className="development-page__actions">
        <Link className="button button--dark" to={routes.home}>
          Voltar ao início
          <Icon name="arrow" />
        </Link>
        <button
          type="button"
          className="button button--outline"
          onClick={() => onOpenDialog("contact")}
        >
          Fale com a gente
        </button>
      </div>
    </section>
  );
}
