import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import farmImage from "../../assets/images/farm-landscape.jpeg";
import { formatPhone, phoneDigits } from "../profile/profile";
import {
  COFFEE_SCREEN_LABELS,
  GRAIN_CROP_LABELS,
  GRAIN_PACKAGING_LABELS,
  PURPOSE_LABELS,
  SPECIES_LABELS,
  obterTagsAnuncio,
} from "./ads.types";
import type { MarketplaceAd } from "./ads.types";
import { obterAnuncioPorId, obterPerfilProdutorPublico } from "./adsStorage";
import type { PublicProducerProfile } from "./adsStorage";
import "./ads.css";

export function AdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [anuncio, setAnuncio] = useState<MarketplaceAd | null>(null);
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
            <h2>Lote não encontrado</h2>
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
  const [tag1, tag2] = obterTagsAnuncio(anuncio);

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
          {/* Coluna Esquerda: Fotos e Dados Técnicos */}
          <div className="ad-detail-main">
            {/* Banner Fotográfico */}
            <div className="ad-detail-banner">
              <img src={anuncio.imagemUrl} alt={anuncio.titulo} />
              <div className="ad-detail-banner__overlay">
                <span className="ad-badge ad-badge--category">{tag1}</span>
                <span className="ad-badge ad-badge--category">{tag2}</span>
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

            {/* Ficha Técnica Polimórfica (Pecuária vs. Grãos e Café) */}
            {anuncio.categoria === "GRAOS" ? (
              <>
                {/* 1. Quadro de Volume e Carga */}
                <section className="ad-detail-section" aria-labelledby="heading-volume-carga">
                  <h2 id="heading-volume-carga" className="ad-detail-section__title">
                    <Icon name="box" /> Volume e Carga da Safra
                  </h2>
                  <div className="ad-spec-grid">
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Cultura Principal</span>
                      <strong className="ad-spec-val">
                        {anuncio.cultura === "OUTRO"
                          ? `Outro (${anuncio.culturaPersonalizada || anuncio.tagSecundaria})`
                          : GRAIN_CROP_LABELS[anuncio.cultura]}
                      </strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Tipo / Classificação Comercial</span>
                      <strong className="ad-spec-val">{anuncio.subtipo}</strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Safra de Colheita</span>
                      <strong className="ad-spec-val">Safra {anuncio.safra}</strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Armazenamento / Embalagem</span>
                      <strong className="ad-spec-val">
                        {GRAIN_PACKAGING_LABELS[anuncio.embalagem]}
                      </strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Volume em Sacas (60 kg)</span>
                      <strong className="ad-spec-val">
                        {anuncio.quantidadeSacas.toLocaleString("pt-BR")} sacas
                      </strong>
                    </div>
                    <div className="ad-spec-card ad-spec-card--highlight">
                      <span className="ad-spec-label">Peso Total da Carga</span>
                      <strong className="ad-spec-val">
                        {anuncio.pesoTotalToneladas.toLocaleString("pt-BR")} ton (
                        {anuncio.pesoTotalKg.toLocaleString("pt-BR")} kg)
                      </strong>
                    </div>
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Local de Retirada / Armazém</span>
                      <strong className="ad-spec-val">
                        {anuncio.cidade} / {anuncio.uf}
                      </strong>
                    </div>
                  </div>
                </section>

                {/* 2. Quadro de Laudo Técnico e Qualidade Física */}
                <section className="ad-detail-section" aria-labelledby="heading-laudo-tecnico">
                  <h2 id="heading-laudo-tecnico" className="ad-detail-section__title">
                    <Icon name="leaf" /> Laudo Técnico e Qualidade Agronômica
                  </h2>
                  <div className="ad-spec-grid">
                    {/* Umidade: sempre informada */}
                    <div className="ad-spec-card">
                      <span className="ad-spec-label">Umidade Estimada</span>
                      <strong className="ad-spec-val">
                        {anuncio.umidadePercentual
                          ? `${anuncio.umidadePercentual}%`
                          : "Padrão comercial"}
                      </strong>
                    </div>

                    {/* Especificações de Café */}
                    {anuncio.cultura === "CAFE" && anuncio.laudoTecnico?.cafePeneira && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Peneira Predominante</span>
                        <strong className="ad-spec-val">
                          {COFFEE_SCREEN_LABELS[anuncio.laudoTecnico.cafePeneira]}
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "CAFE" && anuncio.laudoTecnico?.cafeCatacaoDefeitos && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Catação / Defeitos</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.cafeCatacaoDefeitos}
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "CAFE" && typeof anuncio.laudoTecnico?.cafePontuacaoSca === "number" && (
                      <div className="ad-spec-card ad-spec-card--highlight">
                        <span className="ad-spec-label">Pontuação SCA (Especial)</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.cafePontuacaoSca} pts
                        </strong>
                      </div>
                    )}

                    {/* Especificações de Soja */}
                    {anuncio.cultura === "SOJA" && typeof anuncio.laudoTecnico?.sojaImpurezasPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Impurezas e Matérias Estranhas</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.sojaImpurezasPct}%
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "SOJA" && typeof anuncio.laudoTecnico?.sojaAvariadosPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Grãos Avariados Totais</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.sojaAvariadosPct}%
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "SOJA" && typeof anuncio.laudoTecnico?.sojaQuebradosPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Grãos Quebrados</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.sojaQuebradosPct}%
                        </strong>
                      </div>
                    )}

                    {/* Especificações de Milho */}
                    {anuncio.cultura === "MILHO" && typeof anuncio.laudoTecnico?.milhoImpurezasPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Impurezas e Fragmentos</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.milhoImpurezasPct}%
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "MILHO" && typeof anuncio.laudoTecnico?.milhoArdidosPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Grãos Ardidos</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.milhoArdidosPct}%
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "MILHO" && typeof anuncio.laudoTecnico?.milhoQuebradosPct === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Grãos Quebrados</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.milhoQuebradosPct}%
                        </strong>
                      </div>
                    )}

                    {/* Especificações de Trigo */}
                    {anuncio.cultura === "TRIGO" && typeof anuncio.laudoTecnico?.trigoPhKgHl === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">PH / Peso Hectolítrico</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.trigoPhKgHl} kg/hL
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "TRIGO" && typeof anuncio.laudoTecnico?.trigoForcaGlutenW === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Força de Glúten (W)</span>
                        <strong className="ad-spec-val">
                          W {anuncio.laudoTecnico.trigoForcaGlutenW}
                        </strong>
                      </div>
                    )}
                    {anuncio.cultura === "TRIGO" && typeof anuncio.laudoTecnico?.trigoFallingNumberSeg === "number" && (
                      <div className="ad-spec-card">
                        <span className="ad-spec-label">Falling Number (FN)</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.trigoFallingNumberSeg} s
                        </strong>
                      </div>
                    )}

                    {/* Especificações de Outro */}
                    {anuncio.cultura === "OUTRO" && anuncio.laudoTecnico?.outroObservacoesLaudo && (
                      <div className="ad-spec-card ad-spec-card--wide">
                        <span className="ad-spec-label">Observações Técnicas do Laudo</span>
                        <strong className="ad-spec-val">
                          {anuncio.laudoTecnico.outroObservacoesLaudo}
                        </strong>
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
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
            )}

            {/* Descrição e Manejo / Qualidade */}
            {anuncio.descricao && (
              <section className="ad-detail-section" aria-labelledby="heading-manejo">
                <h2 id="heading-manejo" className="ad-detail-section__title">
                  <Icon name="box" />{" "}
                  {anuncio.categoria === "GRAOS"
                    ? "Descrição da Qualidade e Lote Agrícola"
                    : "Descrição e Manejo da Boiada"}
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

              {anuncio.categoria === "GRAOS" ? (
                <div className="ad-sidebar-subprices">
                  <div className="ad-sidebar-subprice-item">
                    <span>Valor por saca (60 kg)</span>
                    <strong>
                      {anuncio.precoPorSaca.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                  <div className="ad-sidebar-subprice-item">
                    <span>Valor por tonelada</span>
                    <strong>
                      {anuncio.precoPorTonelada.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>
                </div>
              ) : (
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
              )}

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
              aria-label={`Ver perfil público e vitrine de ${producerProfile?.farmName || anuncio.farmName}`}
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
                    <h3 className="ad-producer-preview-name">
                      {producerProfile?.farmName || anuncio.farmName}
                    </h3>
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
                    "Produtor rural habilitado no SafraDireta, dedicado à produção agropecuária de alta qualidade."}
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
