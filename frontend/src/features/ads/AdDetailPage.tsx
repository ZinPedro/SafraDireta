import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import farmImage from "../../assets/images/farm-landscape.jpeg";
import { formatPhone, phoneDigits } from "../profile/profile";
import type { AnimalLotAd } from "./ads.types";
import { PURPOSE_LABELS, SPECIES_LABELS } from "./ads.types";
import { obterAnuncioPorId, obterPerfilProdutorPublico } from "./adsStorage";
import type { PublicProducerProfile } from "./adsStorage";
import "./ads.css";

export function AdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [anuncio, setAnuncio] = useState<AnimalLotAd | null>(null);
  const [producerProfile, setProducerProfile] = useState<PublicProducerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [contactSuccess, setContactSuccess] = useState(false);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    obterAnuncioPorId(id)
      .then((resultado) => {
        if (!isMounted) return;
        setAnuncio(resultado);
        if (resultado) {
          obterPerfilProdutorPublico(resultado.vendedorId).then((perfil) => {
            if (isMounted) setProducerProfile(perfil);
          });
        }
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
      <div className="ad-detail-page">
        <div className="container">
          <div className="ad-loading-box">
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando ficha técnica do lote...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!anuncio) {
    return (
      <div className="ad-detail-page">
        <div className="container">
          <div className="ad-not-found">
            <h2>Lote de animais não encontrado</h2>
            <p>O anúncio solicitado pode ter sido encerrado ou o identificador está incorreto.</p>
            <Link to={routes.market} className="button button--primary">
              Voltar ao Mercado
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = session && session.conta.id === anuncio.vendedorId;

  return (
    <div className="ad-detail-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="ad-breadcrumb" aria-label="Navegação estrutural">
          <Link to={routes.home}>Início</Link>
          <span aria-hidden="true">/</span>
          <Link to={routes.market}>Mercado</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{anuncio.titulo}</span>
        </nav>

        {/* Layout Principal da Ficha Técnica */}
        <div className="ad-detail-layout">
          {/* Coluna Esquerda: Fotos e Dados Zootécnicos */}
          <div className="ad-detail-main">
            {/* Banner Fotográfico */}
            <div className="ad-detail-banner">
              <img src={anuncio.imagemUrl} alt={anuncio.titulo} />
              <div className="ad-detail-banner__overlay">
                <span className="ad-badge ad-badge--category">
                  {SPECIES_LABELS[anuncio.especie]} · {anuncio.raca}
                </span>
              </div>
            </div>

            {/* Cabeçalho da Oferta */}
            <div className="ad-detail-header-card">
              <div className="ad-detail-meta">
                <span className="ad-detail-date">
                  Publicado em {new Date(anuncio.criadoEm).toLocaleDateString("pt-BR")}
                </span>
                <span className="ad-detail-location">
                  <Icon name="location" /> {anuncio.cidade}, {anuncio.uf}
                </span>
              </div>
              <h1 className="ad-detail-title">{anuncio.titulo}</h1>
            </div>

            {/* Ficha Zootécnica Completa */}
            <section className="ad-detail-section" aria-labelledby="heading-zootecnica">
              <h2 id="heading-zootecnica" className="ad-detail-section__title">
                <Icon name="leaf" /> Ficha Zootécnica do Lote
              </h2>
              <div className="ad-spec-grid">
                <div className="ad-spec-card">
                  <span className="ad-spec-label">Espécie</span>
                  <strong className="ad-spec-val">{SPECIES_LABELS[anuncio.especie]}</strong>
                </div>
                <div className="ad-spec-card">
                  <span className="ad-spec-label">Raça / Cruzamento</span>
                  <strong className="ad-spec-val">{anuncio.raca}</strong>
                </div>
                <div className="ad-spec-card">
                  <span className="ad-spec-label">Quantidade</span>
                  <strong className="ad-spec-val">{anuncio.quantidadeCabecas} cabeças</strong>
                </div>
                <div className="ad-spec-card">
                  <span className="ad-spec-label">Finalidade</span>
                  <strong className="ad-spec-val">{PURPOSE_LABELS[anuncio.finalidade]}</strong>
                </div>
                <div className="ad-spec-card">
                  <span className="ad-spec-label">Era / Idade</span>
                  <strong className="ad-spec-val">
                    {anuncio.idadeMeses ? `${anuncio.idadeMeses} meses` : "Não informada"}
                  </strong>
                </div>
                <div className="ad-spec-card">
                  <span className="ad-spec-label">Peso Médio Estimado</span>
                  <strong className="ad-spec-val">
                    {anuncio.pesoMedioArroba} @ ({anuncio.pesoMedioKg} kg)
                  </strong>
                </div>
                <div className="ad-spec-card ad-spec-card--highlight">
                  <span className="ad-spec-label">Peso Total da Carga</span>
                  <strong className="ad-spec-val">
                    {anuncio.pesoTotalArroba.toLocaleString("pt-BR")} @ (
                    {anuncio.pesoTotalKg.toLocaleString("pt-BR")} kg)
                  </strong>
                </div>
                <div className="ad-spec-card">
                  <span className="ad-spec-label">Local de Retirada</span>
                  <strong className="ad-spec-val">
                    {anuncio.cidade} / {anuncio.uf}
                  </strong>
                </div>
              </div>
            </section>

            {/* Descrição e Manejo */}
            {anuncio.descricao && (
              <section className="ad-detail-section" aria-labelledby="heading-manejo">
                <h2 id="heading-manejo" className="ad-detail-section__title">
                  <Icon name="box" /> Descrição e Manejo da Boiada
                </h2>
                <div className="ad-detail-description">
                  <p>{anuncio.descricao}</p>
                </div>
              </section>
            )}
          </div>

          {/* Coluna Direita: Preço, Produtor e Ação Comercial */}
          <aside className="ad-detail-sidebar">
            {/* Card de Preço */}
            <div className="ad-sidebar-card ad-sidebar-card--price">
              <span className="ad-sidebar-price-label">Preço Total do Lote</span>
              <div className="ad-sidebar-price-val">
                {anuncio.precoTotal.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
              <p className="ad-sidebar-price-hint">Venda do lote completo no MVP</p>

              <div className="ad-sidebar-subprices">
                <div className="ad-sidebar-subprice-item">
                  <span>Valor por cabeça</span>
                  <strong>
                    {anuncio.precoPorCabeca.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>
                </div>
                <div className="ad-sidebar-subprice-item">
                  <span>Valor por arroba (@)</span>
                  <strong>
                    {anuncio.precoPorArroba.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </strong>
                </div>
              </div>

              {/* Botões de Ação */}
              {isOwner ? (
                <div className="ad-owner-box">
                  <div className="ad-owner-badge">
                    <Icon name="user" /> Seu anúncio publicado
                  </div>
                  <button
                    type="button"
                    className="button button--primary button--full"
                    onClick={() => navigate(routes.myAds)}
                  >
                    Gerenciar em Meus Anúncios
                  </button>
                </div>
              ) : (
                <div className="ad-buyer-actions">
                  {contactSuccess ? (
                    <div className="ad-alert ad-alert--success">
                      Interesse registrado com sucesso! Em breve o vendedor entrará em contato.
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button--primary button--large button--full"
                      onClick={() => setContactSuccess(true)}
                    >
                      Tenho Interesse neste Lote
                    </button>
                  )}
                  {producerProfile?.publicPhone && (
                    <a
                      href={`tel:${phoneDigits(producerProfile.publicPhone)}`}
                      className="button button--outline button--full ad-producer-phone-link"
                    >
                      <Icon name="phone" /> Contato: {formatPhone(phoneDigits(producerProfile.publicPhone))}
                    </a>
                  )}
                  <Link to={routes.market} className="button button--outline button--full">
                    Voltar ao Mercado
                  </Link>
                </div>
              )}
            </div>

            {/* Card Clicável do Produtor / Fazenda */}
            <Link
              to={`/produtor/${anuncio.vendedorId}`}
              className="ad-sidebar-card ad-sidebar-card--producer-preview"
              aria-label={`Ver perfil público e vitrine de ${anuncio.farmName}`}
            >
              <div className="ad-producer-preview-banner">
                <img src={farmImage} alt="" width="380" height="120" />
              </div>

              <div className="ad-producer-preview-body">
                <div className="ad-producer-preview-head">
                  <Avatar
                    url={producerProfile?.avatarUrl || anuncio.vendedorAvatar}
                    name={anuncio.vendedorNome}
                    size={64}
                    className="ad-producer-preview-avatar"
                  />
                  <div className="ad-producer-preview-titles">
                    <h3 className="ad-producer-preview-name">{anuncio.farmName}</h3>
                    <p className="ad-producer-preview-owner">Produtor: {anuncio.vendedorNome}</p>
                  </div>
                </div>

                <div className="ad-producer-preview-meta">
                  <span className="ad-producer-preview-location">
                    <Icon name="location" />{" "}
                    {producerProfile?.city && producerProfile?.state
                      ? `${producerProfile.city} — ${producerProfile.state}`
                      : `${anuncio.cidade} — ${anuncio.uf}`}
                  </span>
                </div>

                <p className="ad-producer-preview-bio">
                  {producerProfile?.bio ||
                    "Produtor rural habilitado no SafraDireta, dedicado à pecuária de corte de alta qualidade."}
                </p>

                <div className="ad-producer-preview-cta">
                  <span>Ver perfil completo do produtor</span>
                  <span aria-hidden="true" className="ad-producer-preview-arrow">→</span>
                </div>
              </div>
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
