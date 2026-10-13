import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { routes } from "../../data/site";
import farmImage from "../../assets/images/farm-landscape.jpeg";
import { formatPhone, phoneDigits } from "../profile/profile";
import { GRAIN_PACKAGING_LABELS, obterTagsAnuncio } from "./ads.types";
import type { MarketplaceAd } from "./ads.types";
import { listarMeusAnuncios, obterPerfilProdutorPublico } from "./adsStorage";
import type { PublicProducerProfile } from "./adsStorage";
import "./ads.css";

export function PublicProducerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProducerProfile | null>(null);
  const [ads, setAds] = useState<MarketplaceAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    Promise.all([obterPerfilProdutorPublico(id), listarMeusAnuncios(id)])
      .then(([perfilRes, anunciosRes]) => {
        if (!isMounted) return;
        setProfile(perfilRes);
        setAds(anunciosRes);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="producer-public-page">
        <div className="container">
          <div className="ad-loading-box">
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando perfil e vitrine do produtor...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="producer-public-page">
        <div className="container">
          <div className="ad-not-found">
            <h2>Produtor rural não localizado</h2>
            <p>Não encontramos informações para a propriedade rural informada.</p>
            <Link to={routes.market} className="button button--primary">
              Voltar ao Mercado
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="producer-public-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="ad-breadcrumb" aria-label="Navegação estrutural">
          <Link to={routes.home}>Início</Link>
          <span aria-hidden="true">/</span>
          <Link to={routes.market}>Mercado</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Produtor: {profile.farmName}</span>
        </nav>

        {/* Hero Card da Vitrine Pública */}
        <section className="producer-hero-card" aria-label="Vitrine pública do produtor">
          <div className="producer-hero-banner">
            <img src={farmImage} alt="Paisagem rural da fazenda" />
            <div className="producer-hero-banner-overlay" />
          </div>

          <div className="producer-hero-body">
            <div className="producer-hero-head">
              <Avatar
                url={profile.avatarUrl}
                name={profile.nome}
                size={84}
                className="producer-hero-avatar"
              />
              <div className="producer-hero-titles">
                <h1 className="producer-hero-title">{profile.farmName}</h1>
                <p className="producer-hero-owner">Produtor Responsável: {profile.nome}</p>
                <div className="producer-hero-meta">
                  <span className="producer-meta-item">
                    <Icon name="location" /> {profile.city} — {profile.state}
                  </span>
                  {profile.hasOwnTransport && (
                    <span className="producer-meta-item">
                      <Icon name="box" /> Logística própria disponível
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Biografia e Manejo */}
            <div className="producer-about-section">
              <h2 className="producer-about-title">Sobre a Propriedade e Produção</h2>
              <p className="producer-about-text">{profile.bio}</p>

              {profile.categories.length > 0 && (
                <div className="producer-categories-row">
                  <span className="producer-categories-label">Especialidades da Fazenda:</span>
                  <div className="producer-categories-tags">
                    {profile.categories.map((cat) => (
                      <span key={cat} className="producer-tag">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ação de Contato Comercial */}
            <div className="producer-contact-box">
              {profile.publicPhone ? (
                <a
                  href={`tel:${phoneDigits(profile.publicPhone)}`}
                  className="button button--primary button--large"
                >
                  <Icon name="phone" /> Falar com o Produtor ({formatPhone(phoneDigits(profile.publicPhone))})
                </a>
              ) : (
                <div className="producer-contact-platform-hint">
                  <Icon name="phone" /> Contato direto via plataforma
                </div>
              )}
              <Link to={routes.market} className="button button--outline button--large">
                Explorar Outros Lotes no Mercado
              </Link>
            </div>
          </div>
        </section>

        {/* Vitrine de Lotes Ofertados */}
        <section className="producer-lots-section" aria-labelledby="producer-lots-heading">
          <div className="producer-lots-header">
            <div>
              <h2 id="producer-lots-heading" className="producer-lots-title">
                Lotes Ativos no Mercado
              </h2>
              <p className="producer-lots-subtitle">
                Ofertas disponíveis para negociação direta com {profile.farmName}
              </p>
            </div>
            <span className="producer-lots-count">
              {ads.length} {ads.length === 1 ? "lote anunciado" : "lotes anunciados"}
            </span>
          </div>

          {ads.length === 0 ? (
            <div className="producer-lots-empty">
              <Icon name="leaf" />
              <h3>Nenhum lote ativo no momento</h3>
              <p>Esta propriedade não possui lotes anunciados no mercado no momento.</p>
              <Link to={routes.market} className="button button--outline">
                Ver todos os lotes no Mercado
              </Link>
            </div>
          ) : (
            <div className="market-grid">
              {ads.map((anuncio) => {
                const [tag1, tag2] = obterTagsAnuncio(anuncio);
                return (
                  <article
                    key={anuncio.id}
                    className="market-card"
                    onClick={() => navigate(`/anuncios/${anuncio.id}`)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/anuncios/${anuncio.id}`);
                      }
                    }}
                  >
                    <div className="market-card__thumb">
                      <img src={anuncio.imagemUrl} alt={anuncio.titulo} />
                      <div className="market-card__tags">
                        <span className="market-card__tag market-card__tag--primary" title={tag1}>
                          {tag1}
                        </span>
                        <span className="market-card__tag market-card__tag--secondary" title={tag2}>
                          {tag2}
                        </span>
                      </div>
                    </div>

                    <div className="market-card__body">
                      <h3 className="market-card__title">{anuncio.titulo}</h3>
                      <div className="market-card__location">
                        <Icon name="location" /> {anuncio.cidade} — {anuncio.uf}
                      </div>

                      {anuncio.categoria === "GRAOS" ? (
                        <dl className="market-card__specs">
                          <div>
                            <dt>Volume</dt>
                            <dd>{anuncio.quantidadeSacas.toLocaleString("pt-BR")} sacas</dd>
                          </div>
                          <div>
                            <dt>Peso Total</dt>
                            <dd>
                              {anuncio.pesoTotalToneladas} ton ({anuncio.pesoTotalKg.toLocaleString("pt-BR")} kg)
                            </dd>
                          </div>
                          <div>
                            <dt>Safra</dt>
                            <dd>{anuncio.safra}</dd>
                          </div>
                          <div>
                            <dt>Embalagem</dt>
                            <dd>{GRAIN_PACKAGING_LABELS[anuncio.embalagem]}</dd>
                          </div>
                        </dl>
                      ) : (
                        <dl className="market-card__specs">
                          <div>
                            <dt>Quantidade</dt>
                            <dd>{anuncio.quantidadeCabecas} cabeças</dd>
                          </div>
                          <div>
                            <dt>Peso Médio</dt>
                            <dd>
                              {anuncio.pesoMedioArroba} @ ({anuncio.pesoMedioKg} kg)
                            </dd>
                          </div>
                          <div>
                            <dt>Carga Total</dt>
                            <dd>{anuncio.pesoTotalArroba.toLocaleString("pt-BR")} @</dd>
                          </div>
                          <div>
                            <dt>Finalidade</dt>
                            <dd>Boi Gordo</dd>
                          </div>
                        </dl>
                      )}

                      <div className="market-card__footer">
                        <div className="market-card__price-box">
                          <span className="market-card__price-label">Preço Total</span>
                          <strong className="market-card__price-val">
                            {anuncio.precoTotal.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </strong>
                          <span className="market-card__price-sub">
                            {anuncio.categoria === "GRAOS"
                              ? `(${anuncio.precoPorSaca.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })} / saca)`
                              : `(${anuncio.precoPorCabeca.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })} / cabeça)`}
                          </span>
                        </div>

                        <span className="market-card__btn-view">
                          Ver Lote <Icon name="arrow" />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
