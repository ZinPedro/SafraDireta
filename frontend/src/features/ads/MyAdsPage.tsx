import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { AccessRestricted } from "../../components/AccessRestricted";
import { Icon } from "../../components/Icon";
import { GRAIN_PACKAGING_LABELS, obterTagsAnuncio } from "./ads.types";
import type { MarketplaceAd } from "./ads.types";
import { listarMeusAnuncios } from "./adsStorage";
import "./ads.css";

interface MyAdsPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

export function MyAdsPage({ onOpenDialog }: MyAdsPageProps) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [anuncios, setAnuncios] = useState<MarketplaceAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session || session.vendedorEstado !== "HABILITADO") return;

    let isMounted = true;
    listarMeusAnuncios(session.conta.id)
      .then((resultado) => {
        if (isMounted) setAnuncios(resultado);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  if (!session || session.vendedorEstado !== "HABILITADO") {
    return (
      <AccessRestricted
        title="Área restrita para produtores habilitados"
        description="Acesse o painel dos seus lotes de animais, grãos ou café completando o cadastro de vendedor na sua conta."
        onOpenLogin={() => onOpenDialog?.("login")}
        onOpenRegister={() => onOpenDialog?.("registration")}
      />
    );
  }

  return (
    <div className="my-ads-page">
      <div className="container">
        {/* Cabeçalho do Painel */}
        <div className="my-ads-header">
          <div>
            <p className="eyebrow">Área do Produtor</p>
            <h1 className="my-ads-title">Meus Anúncios</h1>
            <p className="my-ads-subtitle">
              Acompanhe seus lotes de gado, grãos e café anunciados no mercado.
            </p>
          </div>
          <div className="my-ads-header__actions">
            <Link to={routes.createAd} className="button button--primary">
              + Novo Anúncio
            </Link>
          </div>
        </div>

        {/* Listagem ou Empty State */}
        {isLoading ? (
          <div className="ad-loading-box" aria-live="polite">
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando seus anúncios...</p>
          </div>
        ) : anuncios.length === 0 ? (
          <div className="my-ads-empty">
            <div className="my-ads-empty__icon-wrapper" aria-hidden="true">
              <Icon name="box" className="my-ads-empty__icon" />
            </div>
            <h2>Você ainda não possui anúncios publicados</h2>
            <p>
              Publique seu primeiro lote de boi gordo, grãos ou café e conecte sua produção a compradores, cooperativas e indústrias em todo o Brasil.
            </p>
            <Link to={routes.createAd} className="button button--primary button--large">
              + Criar Primeiro Anúncio
            </Link>
          </div>
        ) : (
          <div className="my-ads-grid">
            {anuncios.map((anuncio) => {
              const [tag1, tag2] = obterTagsAnuncio(anuncio);
              return (
                <article
                  key={anuncio.id}
                  className="my-ad-card"
                  onClick={() => navigate(`/anuncios/${anuncio.id}`)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalhes do anúncio ${anuncio.titulo}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/anuncios/${anuncio.id}`);
                    }
                  }}
                >
                  <div className="my-ad-card__thumb">
                    <img src={anuncio.imagemUrl} alt={anuncio.titulo} loading="lazy" />
                    <div className="market-card__tags">
                      <span className="market-card__tag market-card__tag--primary" title={tag1}>
                        {tag1}
                      </span>
                      <span className="market-card__tag market-card__tag--secondary" title={tag2}>
                        {tag2}
                      </span>
                    </div>
                    <span className="my-ad-card__status-badge my-ad-card__status-badge--active">
                      Ativo no Mercado
                    </span>
                  </div>
                  <div className="my-ad-card__content">
                    <div className="my-ad-card__category-tag">
                      {tag1} · {tag2}
                    </div>
                    <h3 className="my-ad-card__title">{anuncio.titulo}</h3>

                    {anuncio.categoria === "GRAOS" ? (
                      <div className="my-ad-card__metrics">
                        <div>
                          <span className="my-ad-card__metric-label">Volume</span>
                          <strong>
                            {anuncio.quantidadeSacas.toLocaleString("pt-BR")} sc ({anuncio.pesoTotalToneladas} ton)
                          </strong>
                        </div>
                        <div>
                          <span className="my-ad-card__metric-label">Safra / Embalagem</span>
                          <strong>
                            {anuncio.safra} · {GRAIN_PACKAGING_LABELS[anuncio.embalagem]}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div className="my-ad-card__metrics">
                        <div>
                          <span className="my-ad-card__metric-label">Quantidade</span>
                          <strong>{anuncio.quantidadeCabecas} cabeças</strong>
                        </div>
                        <div>
                          <span className="my-ad-card__metric-label">Média / Cabeça</span>
                          <strong>
                            {anuncio.pesoMedioArroba} @ ({anuncio.pesoMedioKg} kg)
                          </strong>
                        </div>
                      </div>
                    )}

                    <div className="my-ad-card__location">
                      <Icon name="location" />
                      <span>
                        {anuncio.cidade}, {anuncio.uf}
                      </span>
                    </div>

                    <div className="my-ad-card__footer">
                      <div className="my-ad-card__price">
                        <span className="my-ad-card__price-label">Preço Total do Lote</span>
                        <strong>
                          {anuncio.precoTotal.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </strong>
                        <span className="my-ad-card__price-sub">
                          {anuncio.categoria === "GRAOS"
                            ? `(${anuncio.precoPorSaca.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })} / saca)`
                            : `(${anuncio.precoPorCabeca.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })} / cab.)`}
                        </span>
                      </div>

                      <span className="market-card__btn-view">
                        Ver Ficha Técnica <Icon name="arrow" />
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
