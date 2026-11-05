import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../../components/Avatar";
import { Icon } from "../../components/Icon";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import farmImage from "../../assets/images/farm-landscape.jpeg";
import { listarTodosProdutoresPublicos } from "./adsStorage";
import type { PublicProducerListItem } from "./adsStorage";
import "./ads.css";

interface ProducersPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

export function ProducersPage({ onOpenDialog: _onOpenDialog }: ProducersPageProps) {
  const navigate = useNavigate();
  const [produtores, setProdutores] = useState<PublicProducerListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("TODAS");

  useEffect(() => {
    let isMounted = true;
    listarTodosProdutoresPublicos()
      .then((itens) => {
        if (isMounted) {
          setProdutores(itens);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar produtores:", err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Extrai lista única de especialidades/categorias existentes
  const todasCategorias = useMemo(() => {
    const set = new Set<string>();
    produtores.forEach((p) => {
      p.categories.forEach((cat) => set.add(cat));
    });
    return Array.from(set);
  }, [produtores]);

  // Filtra produtores por texto (fazenda, nome, cidade, estado) e especialidade
  const produtoresFiltrados = useMemo(() => {
    const termo = filtroBusca.trim().toLowerCase();
    return produtores.filter((p) => {
      // Filtro de especialidade
      if (filtroCategoria !== "TODAS") {
        const temCategoria = p.categories.some(
          (c) => c.toLowerCase() === filtroCategoria.toLowerCase()
        );
        if (!temCategoria) return false;
      }

      // Filtro textual
      if (!termo) return true;

      const campos = [
        p.farmName,
        p.nome,
        p.city,
        p.state,
        p.bio,
        ...p.categories,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return campos.includes(termo);
    });
  }, [produtores, filtroBusca, filtroCategoria]);

  return (
    <div className="producers-directory-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="ad-breadcrumb" aria-label="Navegação estrutural">
          <Link to={routes.home}>Início</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Produtores Rurais</span>
        </nav>

        {/* Cabeçalho da Página */}
        <header className="producers-directory-header">
          <div className="producers-directory-header__info">
            <span className="eyebrow">Origem e Confiabilidade</span>
            <h1 className="producers-directory-header__title">
              Produtores Rurais Habilitados
            </h1>
            <p className="producers-directory-header__desc">
              Conheça quem planta, cria e movimenta o agronegócio no SafraDireta. 
              Propriedades rurais auditadas, histórico de lotes e contato direto com o produtor.
            </p>
          </div>
          <div className="producers-directory-header__stats">
            <div className="producer-stat-badge">
              <span className="producer-stat-badge__number">{produtores.length}</span>
              <span className="producer-stat-badge__label">
                {produtores.length === 1 ? "Produtor Habilitado" : "Produtores Habilitados"}
              </span>
            </div>
          </div>
        </header>

        {/* Barra de Filtros e Busca */}
        <div className="producers-filter-bar">
          <div className="producers-search-box">
            <Icon name="search" className="producers-search-icon" />
            <input
              type="search"
              className="producers-search-input"
              placeholder="Buscar por fazenda, produtor ou município..."
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              aria-label="Buscar produtores"
            />
            {filtroBusca && (
              <button
                type="button"
                className="producers-search-clear"
                onClick={() => setFiltroBusca("")}
                aria-label="Limpar busca"
              >
                &times;
              </button>
            )}
          </div>

          {/* Chips de Categoria / Especialidade */}
          {todasCategorias.length > 0 && (
            <div className="producers-category-chips" role="tablist" aria-label="Filtrar por especialidade">
              <button
                type="button"
                role="tab"
                aria-selected={filtroCategoria === "TODAS"}
                className={`producers-chip ${filtroCategoria === "TODAS" ? "producers-chip--active" : ""}`}
                onClick={() => setFiltroCategoria("TODAS")}
              >
                Todas as Especialidades
              </button>
              {todasCategorias.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={filtroCategoria === cat}
                  className={`producers-chip ${filtroCategoria === cat ? "producers-chip--active" : ""}`}
                  onClick={() => setFiltroCategoria(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conteúdo Principal / Grid de Produtores */}
        {isLoading ? (
          <div className="ad-loading-box" style={{ margin: "4rem 0" }}>
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando diretório de produtores rurais...</p>
          </div>
        ) : produtoresFiltrados.length === 0 ? (
          <div className="producers-empty-state">
            <div className="producers-empty-icon" aria-hidden="true">
              <Icon name="user" />
            </div>
            <h2>Nenhum produtor rural encontrado</h2>
            <p>
              {filtroBusca || filtroCategoria !== "TODAS"
                ? "Nenhum produtor corresponde aos filtros selecionados. Tente buscar por outros termos ou limpar os filtros."
                : "Ainda não há produtores cadastrados no diretório."}
            </p>
            {(filtroBusca || filtroCategoria !== "TODAS") && (
              <button
                type="button"
                className="button button--outline"
                onClick={() => {
                  setFiltroBusca("");
                  setFiltroCategoria("TODAS");
                }}
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="producers-cards-grid">
            {produtoresFiltrados.map((produtor) => (
              <article
                key={produtor.id}
                className="producer-directory-card"
                onClick={() => navigate(routes.producerProfile(produtor.id))}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(routes.producerProfile(produtor.id));
                  }
                }}
                aria-label={`Ficha da propriedade ${produtor.farmName}`}
              >
                {/* Banner de Capa */}
                <div className="producer-directory-card__banner">
                  <img
                    src={produtor.bannerUrl || farmImage}
                    alt={`Paisagem da ${produtor.farmName}`}
                    loading="lazy"
                  />
                  <div className="producer-directory-card__banner-overlay" />
                  {produtor.seloVerificado && (
                    <span className="producer-directory-card__badge" title="Produtor auditado e verificado">
                      <Icon name="check" /> Verificado
                    </span>
                  )}
                </div>

                {/* Corpo do Card */}
                <div className="producer-directory-card__body">
                  <div className="producer-directory-card__avatar-row">
                    <Avatar
                      url={produtor.avatarUrl}
                      name={produtor.nome}
                      size={64}
                      className="producer-directory-card__avatar"
                    />
                    <div className="producer-directory-card__lotes-count">
                      <span className="producer-directory-card__lotes-number">
                        {produtor.totalAnunciosAtivos}
                      </span>
                      <span className="producer-directory-card__lotes-text">
                        {produtor.totalAnunciosAtivos === 1 ? "lote ativo" : "lotes ativos"}
                      </span>
                    </div>
                  </div>

                  <h2 className="producer-directory-card__farm">{produtor.farmName}</h2>
                  <p className="producer-directory-card__owner">
                    <Icon name="user" /> {produtor.nome}
                  </p>
                  <p className="producer-directory-card__location">
                    <Icon name="location" /> {produtor.city} — {produtor.state}
                  </p>

                  <p className="producer-directory-card__bio">
                    {produtor.bio}
                  </p>

                  {/* Tags de Especialidades */}
                  {produtor.categories.length > 0 && (
                    <div className="producer-directory-card__tags">
                      {produtor.categories.slice(0, 3).map((cat) => (
                        <span key={cat} className="producer-tag">
                          {cat}
                        </span>
                      ))}
                      {produtor.hasOwnTransport && (
                        <span className="producer-tag producer-tag--logistics">
                          Logística Própria
                        </span>
                      )}
                    </div>
                  )}

                  {/* Rodapé do Card com Ação */}
                  <div className="producer-directory-card__footer">
                    <span className="button button--primary button--small button--full">
                      Ver Vitrine e Lotes
                      <Icon name="arrow" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
