import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import { Icon } from "../../components/Icon";
import { GRAIN_PACKAGING_LABELS, obterFotoCapa, obterTagsAnuncio } from "./ads.types";
import type { GrainCrop, MarketplaceAd } from "./ads.types";
import { correspondeBuscaAnuncio, listarAnunciosMercado } from "./adsStorage";
import "./ads.css";

export function MarketPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQuery = searchParams.get("q") || "";
  const [searchTerm, setSearchTerm] = useState(urlQuery);
  const [debouncedTerm, setDebouncedTerm] = useState(urlQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [anuncios, setAnuncios] = useState<MarketplaceAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Deriva categoria e cultura da URL (Single Source of Truth)
  const catParam = searchParams.get("categoria");
  const filtroCategoria: "TODOS" | "ANIMAL" | "GRAOS" =
    catParam === "ANIMAL" || catParam === "GRAOS" ? catParam : "TODOS";

  const culParam = searchParams.get("cultura");
  const filtroCultura: "TODAS" | GrainCrop =
    culParam && ["CAFE", "SOJA", "MILHO", "TRIGO", "OUTRO"].includes(culParam)
      ? (culParam as GrainCrop)
      : "TODAS";

  const isSeller = session?.vendedorEstado === "HABILITADO";

  // Sincroniza estado de busca se a navegação do navegador alterar a URL (ex: Voltar / Avançar)
  useEffect(() => {
    const handlePopState = () => {
      const q = new URLSearchParams(window.location.search).get("q") || "";
      setSearchTerm(q);
      setDebouncedTerm(q);
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Debounce de ~350ms para atualização do filtro e sincronização com URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
      const trimmed = searchTerm.trim();

      setSearchParams(
        (prevParams) => {
          const currentQ = prevParams.get("q") || "";
          if (currentQ === trimmed) {
            return prevParams; // Não altera se o valor já for igual
          }
          const next = new URLSearchParams(prevParams);
          if (trimmed) {
            next.set("q", trimmed);
          } else {
            next.delete("q");
          }
          return next;
        },
        { replace: true }
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm, setSearchParams]);

  useEffect(() => {
    let isMounted = true;
    listarAnunciosMercado()
      .then((resultado) => {
        if (isMounted) setAnuncios(resultado);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedTerm(searchTerm);
    const currentQ = searchParams.get("q") || "";
    const trimmed = searchTerm.trim();
    if (currentQ !== trimmed) {
      setSearchParams(
        (prevParams) => {
          const next = new URLSearchParams(prevParams);
          if (trimmed) {
            next.set("q", trimmed);
          } else {
            next.delete("q");
          }
          return next;
        },
        { replace: true }
      );
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setDebouncedTerm("");
    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);
        next.delete("q");
        return next;
      },
      { replace: true }
    );
    searchInputRef.current?.focus();
  };

  const handleSelectCategoria = (cat: "TODOS" | "ANIMAL" | "GRAOS") => {
    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);
        // Se clicar no chip já selecionado (toggle para desselecionar), volta para TODOS
        if (filtroCategoria === cat && cat !== "TODOS") {
          next.delete("categoria");
          next.delete("cultura");
          return next;
        }
        if (cat === "TODOS") {
          next.delete("categoria");
          next.delete("cultura");
        } else {
          next.set("categoria", cat);
          next.delete("cultura");
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleSelectCultura = (cul: "TODAS" | GrainCrop) => {
    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);
        next.set("categoria", "GRAOS");
        // Se clicar na cultura já selecionada (toggle para desselecionar), volta para TODAS
        if (filtroCultura === cul && cul !== "TODAS") {
          next.delete("cultura");
        } else if (cul === "TODAS") {
          next.delete("cultura");
        } else {
          next.set("cultura", cul);
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleClearCategory = () => {
    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);
        next.delete("categoria");
        next.delete("cultura");
        return next;
      },
      { replace: true }
    );
  };

  // Contadores em tempo real do catálogo
  const totalGeral = anuncios.length;
  const totalAnimal = anuncios.filter((a) => a.categoria === "ANIMAL").length;
  const totalGraos = anuncios.filter((a) => a.categoria === "GRAOS").length;

  const totalCafe = anuncios.filter(
    (a) => a.categoria === "GRAOS" && a.cultura === "CAFE"
  ).length;
  const totalSoja = anuncios.filter(
    (a) => a.categoria === "GRAOS" && a.cultura === "SOJA"
  ).length;
  const totalMilho = anuncios.filter(
    (a) => a.categoria === "GRAOS" && a.cultura === "MILHO"
  ).length;
  const totalTrigo = anuncios.filter(
    (a) => a.categoria === "GRAOS" && a.cultura === "TRIGO"
  ).length;
  const totalOutro = anuncios.filter(
    (a) => a.categoria === "GRAOS" && a.cultura === "OUTRO"
  ).length;

  // Rótulo descritivo da categoria/cultura ativa
  const labelCategoriaAtiva = (() => {
    if (filtroCategoria === "ANIMAL") return "Boi Gordo";
    if (filtroCategoria === "GRAOS") {
      if (filtroCultura === "CAFE") return "Café";
      if (filtroCultura === "SOJA") return "Soja";
      if (filtroCultura === "MILHO") return "Milho";
      if (filtroCultura === "TRIGO") return "Trigo";
      if (filtroCultura === "OUTRO") return "Outros Grãos";
      return "Grãos e Café";
    }
    return "Todos os Lotes";
  })();

  const anunciosFiltrados = anuncios.filter((anuncio) => {
    const passaCategoria = (() => {
      if (filtroCategoria === "TODOS") return true;
      if (filtroCategoria === "ANIMAL") return anuncio.categoria === "ANIMAL";
      if (filtroCategoria === "GRAOS") {
        if (filtroCultura === "TODAS") {
          return anuncio.categoria === "GRAOS";
        }
        return anuncio.categoria === "GRAOS" && anuncio.cultura === filtroCultura;
      }
      return true;
    })();

    const passaBusca = correspondeBuscaAnuncio(anuncio, debouncedTerm);
    return passaCategoria && passaBusca;
  });

  return (
    <div className="market-page">
      <div className="container">
        {/* Banner / Cabeçalho do Mercado */}
        <header className="market-header">
          <div className="market-header__content">
            <p className="eyebrow">Mercado Agropecuário</p>
            <h1 className="market-title">Lotes e Ofertas Disponíveis</h1>
            <p className="market-subtitle">
              Negociação direta com produtores rurais. Encontre lotes de gado de corte, café, soja, milho e trigo.
            </p>
          </div>

          {/* Botão de Anunciar se Vendedor Habilitado */}
          {isSeller && (
            <div className="market-header__seller-action">
              <Link to={routes.createAd} className="button button--primary button--large">
                + Anunciar Lote
              </Link>
            </div>
          )}
        </header>

        {/* Barra de Pesquisa por Palavra-Chave (US-020) */}
        <div className="market-search-section">
          <form
            className="market-search-bar"
            role="search"
            onSubmit={handleSubmit}
            aria-label="Buscar anúncios no mercado"
          >
            <div className="market-search-bar__icon" aria-hidden="true">
              <Icon name="search" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              className="market-search-bar__input"
              placeholder="Buscar por lote, raça, cultura, cidade ou palavra-chave..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar anúncios por palavra-chave"
            />
            {searchTerm && (
              <button
                type="button"
                className="market-search-bar__clear"
                onClick={handleClearSearch}
                title="Limpar pesquisa"
                aria-label="Limpar campo de pesquisa"
              >
                <Icon name="close" />
              </button>
            )}
          </form>
        </div>

        {/* Barra de Filtros e Categorias (US-021) */}
        <div className="market-filter-section">
          <div className="market-filter-bar">
            {/* Nível 1: Macro-Categorias */}
            <div className="market-filter-chips" role="radiogroup" aria-label="Filtro de macro-categorias">
              <button
                type="button"
                className={`market-chip ${filtroCategoria === "TODOS" ? "market-chip--active" : ""}`}
                onClick={() => handleSelectCategoria("TODOS")}
                aria-pressed={filtroCategoria === "TODOS"}
              >
                <span className="market-chip__label">Todos os Lotes</span>
                <span className="market-chip__badge">{totalGeral}</span>
              </button>
              <button
                type="button"
                className={`market-chip ${filtroCategoria === "ANIMAL" ? "market-chip--active" : ""}`}
                onClick={() => handleSelectCategoria("ANIMAL")}
                aria-pressed={filtroCategoria === "ANIMAL"}
              >
                <span className="market-chip__label">Boi Gordo</span>
                <span className="market-chip__badge">{totalAnimal}</span>
              </button>
              <button
                type="button"
                className={`market-chip ${filtroCategoria === "GRAOS" ? "market-chip--active" : ""}`}
                onClick={() => handleSelectCategoria("GRAOS")}
                aria-pressed={filtroCategoria === "GRAOS"}
              >
                <span className="market-chip__label">Grãos e Café</span>
                <span className="market-chip__badge">{totalGraos}</span>
              </button>
            </div>

            {/* Linha de Contagem e Controle Independente */}
            <div className="market-count-label">
              <span className="market-count-label__wrap">
                <span>
                  Exibindo <strong>{anunciosFiltrados.length}</strong>{" "}
                  {anunciosFiltrados.length === 1 ? "oferta" : "ofertas"}
                </span>

                {debouncedTerm.trim() && (
                  <span className="market-search-chip">
                    &ldquo;{debouncedTerm.trim()}&rdquo;
                    <button
                      type="button"
                      className="market-search-chip__btn"
                      onClick={handleClearSearch}
                      title="Remover filtro de busca"
                      aria-label="Remover filtro de busca"
                    >
                      <Icon name="close" />
                    </button>
                  </span>
                )}

                {filtroCategoria !== "TODOS" && (
                  <span className="market-category-chip">
                    <span>
                      Categoria: <strong>{labelCategoriaAtiva}</strong>
                    </span>
                    <button
                      type="button"
                      className="market-category-chip__btn"
                      onClick={handleClearCategory}
                      title="Limpar filtro de categoria"
                      aria-label="Limpar filtro de categoria"
                    >
                      <Icon name="close" />
                    </button>
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Nível 2: Sub-faixa de Culturas Agrícolas (Visível quando "Grãos e Café" estiver selecionado) */}
          {filtroCategoria === "GRAOS" && (
            <div className="market-filter-subbar">
              <span className="market-filter-subbar__title">Cultura:</span>
              <div
                className="market-filter-chips market-filter-chips--sub"
                role="radiogroup"
                aria-label="Culturas de grãos e café"
              >
                <button
                  type="button"
                  className={`market-chip market-chip--sub ${
                    filtroCultura === "TODAS" ? "market-chip--active" : ""
                  }`}
                  onClick={() => handleSelectCultura("TODAS")}
                  aria-pressed={filtroCultura === "TODAS"}
                >
                  <span className="market-chip__label">Todas</span>
                  <span className="market-chip__badge">{totalGraos}</span>
                </button>
                <button
                  type="button"
                  className={`market-chip market-chip--sub ${
                    filtroCultura === "CAFE" ? "market-chip--active" : ""
                  }`}
                  onClick={() => handleSelectCultura("CAFE")}
                  aria-pressed={filtroCultura === "CAFE"}
                >
                  <span className="market-chip__label">Café</span>
                  <span className="market-chip__badge">{totalCafe}</span>
                </button>
                <button
                  type="button"
                  className={`market-chip market-chip--sub ${
                    filtroCultura === "SOJA" ? "market-chip--active" : ""
                  }`}
                  onClick={() => handleSelectCultura("SOJA")}
                  aria-pressed={filtroCultura === "SOJA"}
                >
                  <span className="market-chip__label">Soja</span>
                  <span className="market-chip__badge">{totalSoja}</span>
                </button>
                <button
                  type="button"
                  className={`market-chip market-chip--sub ${
                    filtroCultura === "MILHO" ? "market-chip--active" : ""
                  }`}
                  onClick={() => handleSelectCultura("MILHO")}
                  aria-pressed={filtroCultura === "MILHO"}
                >
                  <span className="market-chip__label">Milho</span>
                  <span className="market-chip__badge">{totalMilho}</span>
                </button>
                <button
                  type="button"
                  className={`market-chip market-chip--sub ${
                    filtroCultura === "TRIGO" ? "market-chip--active" : ""
                  }`}
                  onClick={() => handleSelectCultura("TRIGO")}
                  aria-pressed={filtroCultura === "TRIGO"}
                >
                  <span className="market-chip__label">Trigo</span>
                  <span className="market-chip__badge">{totalTrigo}</span>
                </button>
                <button
                  type="button"
                  className={`market-chip market-chip--sub ${
                    filtroCultura === "OUTRO" ? "market-chip--active" : ""
                  }`}
                  onClick={() => handleSelectCultura("OUTRO")}
                  aria-pressed={filtroCultura === "OUTRO"}
                >
                  <span className="market-chip__label">Outros Grãos</span>
                  <span className="market-chip__badge">{totalOutro}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Listagem dos Lotes */}
        {isLoading ? (
          <div className="ad-loading-box" aria-live="polite">
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando ofertas do mercado...</p>
          </div>
        ) : anunciosFiltrados.length === 0 ? (
          debouncedTerm.trim() ? (
            <div className="market-empty-box market-empty-box--search" role="status">
              <div className="market-empty-box__icon-wrapper" aria-hidden="true">
                <Icon name="search" />
              </div>
              <h2>Nenhum lote encontrado para &ldquo;{debouncedTerm.trim()}&rdquo;</h2>
              <p>
                Não encontramos ofertas correspondentes à sua pesquisa
                {filtroCategoria !== "TODOS"
                  ? ` na categoria ${labelCategoriaAtiva}`
                  : ""}
                . Tente palavras-chave mais genéricas, revise a ortografia ou limpe a busca.
              </p>
              <div className="market-empty-box__actions">
                <button
                  type="button"
                  className="button button--primary button--large"
                  onClick={handleClearSearch}
                >
                  Limpar busca e ver ofertas
                </button>
                {filtroCategoria !== "TODOS" && (
                  <button
                    type="button"
                    className="button button--outline button--large"
                    onClick={handleClearCategory}
                  >
                    Ver todas as categorias
                  </button>
                )}
              </div>
            </div>
          ) : filtroCategoria !== "TODOS" ? (
            <div className="market-empty-box market-empty-box--category" role="status">
              <div className="market-empty-box__icon-wrapper" aria-hidden="true">
                <Icon name="box" />
              </div>
              <h2>Nenhum lote disponível em {labelCategoriaAtiva}</h2>
              <p>No momento não há ofertas ativas para este segmento no mercado.</p>
              <div className="market-empty-box__actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={handleClearCategory}
                >
                  Ver todos os lotes do Mercado
                </button>
                {isSeller && (
                  <Link to={routes.createAd} className="button button--outline">
                    + Anunciar nesta Categoria
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="market-empty-box">
              <Icon name="box" />
              <h2>Nenhum lote encontrado nesta categoria</h2>
              <p>Seja o primeiro a anunciar lotes nesta categoria no SafraDireta.</p>
              {isSeller ? (
                <Link to={routes.createAd} className="button button--primary">
                  Anunciar Lote Agora
                </Link>
              ) : (
                <Link to={routes.sellerUpgrade} className="button button--outline">
                  Habilitar como Produtor
                </Link>
              )}
            </div>
          )
        ) : (
          <div className="market-grid">
            {anunciosFiltrados.map((anuncio) => {
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
                    <img src={obterFotoCapa(anuncio)} alt={anuncio.titulo} loading="lazy" />
                    {anuncio.video?.url && (
                      <span className="market-card__video-badge" title="Contém vídeo demonstrativo">
                        <Icon name="play" /> Vídeo
                      </span>
                    )}
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
                    <h2 className="market-card__title">{anuncio.titulo}</h2>
                    <p className="market-card__farm">{anuncio.farmName}</p>

                    <div className="market-card__location">
                      <Icon name="location" />
                      <span>
                        {anuncio.cidade}, {anuncio.uf}
                      </span>
                    </div>

                    {anuncio.categoria === "GRAOS" ? (
                      <dl className="market-card__specs">
                        <div>
                          <dt>Volume</dt>
                          <dd>
                            {anuncio.quantidadeSacas.toLocaleString("pt-BR")} sc ({anuncio.pesoTotalToneladas} ton)
                          </dd>
                        </div>
                        <div>
                          <dt>Safra / Embalagem</dt>
                          <dd>
                            {anuncio.safra} · {GRAIN_PACKAGING_LABELS[anuncio.embalagem]}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <dl className="market-card__specs">
                        <div>
                          <dt>Quantidade</dt>
                          <dd>{anuncio.quantidadeCabecas} cab.</dd>
                        </div>
                        <div>
                          <dt>Média / Cabeça</dt>
                          <dd>
                            {anuncio.pesoMedioArroba} @ ({anuncio.pesoMedioKg} kg)
                          </dd>
                        </div>
                      </dl>
                    )}

                    <div className="market-card__footer">
                      <div className="market-card__price-box">
                        <span className="market-card__price-label">Preço Total do Lote</span>
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
                              })} / saca 60 kg)`
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
      </div>
    </div>
  );
}
