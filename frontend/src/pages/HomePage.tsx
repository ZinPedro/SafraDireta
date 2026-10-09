import { Link } from "react-router-dom";
import heroImage from "../assets/images/harvest-sunset.jpeg";
import sellerImage from "../assets/images/farm-landscape.jpeg";
import { Icon } from "../components/Icon";
import {
  CategoryPlaceholder,
  OfferPlaceholder,
  ProducerPlaceholder,
} from "../components/PlaceholderCards";
import { guideSteps, routes } from "../data/site";
import type { OpenDevelopmentDialog } from "../data/site";
import { useAuth } from "../context/authContext";
import "./HomePage.css";

export function HomePage({
  onOpenDialog,
}: {
  onOpenDialog: OpenDevelopmentDialog;
}) {
  const { session } = useAuth();
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <img
          className="hero__image"
          src={heroImage}
          alt=""
          fetchPriority="high"
          width="1457"
          height="720"
        />
        <div className="container hero__inner">
          <div className="hero__content">
            <p className="eyebrow hero__eyebrow">Do campo à negociação</p>
            <h1 id="hero-title">
              O mercado do
              <br />
              <em>agronegócio</em>
              <br />
              brasileiro
            </h1>
            <p className="hero__description">
              Conectamos produtores rurais e compradores.
              <br className="hero__line-break" /> Café, grãos, gado e muito mais
              — novas oportunidades começam aqui.
            </p>
            <div className="hero__actions">
              <Link className="button button--primary" to={routes.market}>
                Explorar o mercado
                <Icon name="arrow" />
              </Link>
              {session ? (
                <Link className="button button--outline-light" to={routes.profile}>
                  Meu perfil
                </Link>
              ) : (
                <button
                  className="button button--outline-light"
                  type="button"
                  onClick={() => onOpenDialog("registration")}
                >
                  Cadastre-se
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section
        className="section categories-section"
        aria-labelledby="categories-title"
      >
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Categorias</p>
              <h2 id="categories-title">O que você encontra aqui</h2>
            </div>
            <p className="section-heading__aside">
              Novas categorias ganham espaço
              <br />
              conforme o mercado cresce.
            </p>
          </div>
          <div className="category-grid">
            {[1, 2, 3, 4].map((index) => (
              <CategoryPlaceholder key={index} index={index} />
            ))}
          </div>
          <p className="section-note">
            Espaços reservados para os futuros destaques do mercado.
          </p>
        </div>
      </section>

      <section
        className="section offers-section"
        aria-labelledby="offers-title"
      >
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Encontre novas oportunidades</p>
              <h2 id="offers-title">Ofertas do momento</h2>
            </div>
            <span className="section-heading__aside">
              Os próximos lotes começam aqui.
            </span>
          </div>
          <div className="offer-grid">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <OfferPlaceholder key={index} index={index} />
            ))}
          </div>
          <div className="section-action">
            <Link className="button button--outline" to={routes.market}>
              Explorar todas as ofertas
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section how-section" aria-labelledby="how-title">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Como funciona</p>
              <h2 id="how-title">Simples, do primeiro contato à compra</h2>
            </div>
          </div>
          <ol className="steps-grid">
            {guideSteps.map((step) => (
              <li className="step" key={step.number}>
                <span className="step__number" aria-hidden="true">
                  {step.number}
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
          <div className="how-section__footer">
            <p>Conheça a jornada que estamos construindo para você.</p>
            <Link className="text-link" to={routes.guide}>
              Ver guia do usuário
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>

      <section
        className="section producers-section"
        aria-labelledby="producers-title"
      >
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Gente que faz o campo acontecer</p>
              <h2 id="producers-title">Quem está vendendo</h2>
            </div>
            <span className="section-heading__aside">
              Histórias e novas conexões, em breve.
            </span>
          </div>
          <div className="producer-grid">
            {[1, 2, 3].map((index) => (
              <ProducerPlaceholder key={index} index={index} />
            ))}
          </div>
          <div className="section-action">
            <Link
              className="button button--outline-light"
              to={routes.producers}
            >
              Conheça os produtores
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
      </section>

      <section className="seller-banner" aria-labelledby="seller-title">
        <img
          className="seller-banner__image"
          src={sellerImage}
          alt=""
          loading="lazy"
          width="2752"
          height="1536"
        />
        <div className="container seller-banner__inner">
          <p className="eyebrow">Para quem vive de produzir</p>
          <h2 id="seller-title">
            Sua próxima colheita
            <br />
            merece o melhor preço.
          </h2>
          <p>
            Aproxime sua produção de novos compradores.
            <br />O próximo capítulo da sua safra começa com uma conexão.
          </p>
          {session ? (
            session.conta.tipo === "PJ" ? (
              <Link className="button button--primary" to={routes.profile}>
                Acessar perfil corporativo
                <Icon name="arrow" />
              </Link>
            ) : session.vendedorEstado === "HABILITADO" ? (
              <Link className="button button--primary" to={`${routes.profile}?aba=produtor`}>
                Minha vitrine de produtor
                <Icon name="arrow" />
              </Link>
            ) : (
              <Link className="button button--primary" to={routes.sellerUpgrade}>
                Habilitar vendas
                <Icon name="arrow" />
              </Link>
            )
          ) : (
            <button
              className="button button--primary"
              type="button"
              onClick={() => onOpenDialog("sellerRegistration")}
            >
              Sou vendedor — quero me cadastrar
              <Icon name="arrow" />
            </button>
          )}
        </div>
      </section>
    </>
  );
}
