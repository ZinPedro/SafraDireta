import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { Icon } from "../../components/Icon";
import { GRAIN_PACKAGING_LABELS, obterFotoCapa, obterTagsAnuncio } from "./ads.types";
import type { GrainCrop, MarketplaceAd } from "./ads.types";
import { correspondeBuscaAnuncio, listarAnunciosMercado } from "./adsStorage";
import {
  alternarFavoritoStorage,
  obterFavoritosIds,
} from "./favoritesStorage";
import "./ads.css";

export type MetricaPeso =
  | "PESO_MEDIO_ARROBA"
  | "QTD_CABECAS"
  | "VOLUME_SACAS"
  | "PESO_TOTAL_TON";

interface MetricConfig {
  id: MetricaPeso;
  label: string;
  shortUnit: string;
  minPlaceholder: string;
  maxPlaceholder: string;
  step?: string;
}

const METRICAS_CONFIG: Record<MetricaPeso, MetricConfig> = {
  PESO_MEDIO_ARROBA: {
    id: "PESO_MEDIO_ARROBA",
    label: "Peso Médio (@)",
    shortUnit: "@",
    minPlaceholder: "Ex: 18",
    maxPlaceholder: "Ex: 22",
    step: "0.1",
  },
  QTD_CABECAS: {
    id: "QTD_CABECAS",
    label: "Qtd. Cabeças",
    shortUnit: "cab.",
    minPlaceholder: "Ex: 50",
    maxPlaceholder: "Ex: 150",
    step: "1",
  },
  VOLUME_SACAS: {
    id: "VOLUME_SACAS",
    label: "Volume em Sacas (sc)",
    shortUnit: "sc",
    minPlaceholder: "Ex: 500",
    maxPlaceholder: "Ex: 2.000",
    step: "1",
  },
  PESO_TOTAL_TON: {
    id: "PESO_TOTAL_TON",
    label: "Peso Total (ton)",
    shortUnit: "ton",
    minPlaceholder: "Ex: 20",
    maxPlaceholder: "Ex: 60",
    step: "0.1",
  },
};

function obterMetricasDisponiveis(categoria: "TODOS" | "ANIMAL" | "GRAOS"): MetricaPeso[] {
  if (categoria === "ANIMAL") {
    return ["PESO_MEDIO_ARROBA", "QTD_CABECAS", "PESO_TOTAL_TON"];
  }
  if (categoria === "GRAOS") {
    return ["VOLUME_SACAS", "PESO_TOTAL_TON"];
  }
  return ["PESO_TOTAL_TON"];
}

function obterMetricaPadrao(categoria: "TODOS" | "ANIMAL" | "GRAOS"): MetricaPeso {
  if (categoria === "ANIMAL") return "PESO_MEDIO_ARROBA";
  if (categoria === "GRAOS") return "VOLUME_SACAS";
  return "PESO_TOTAL_TON";
}

function normalizarMetrica(
  metricaRaw: string | null,
  categoria: "TODOS" | "ANIMAL" | "GRAOS"
): MetricaPeso {
  const disponiveis = obterMetricasDisponiveis(categoria);
  if (!metricaRaw) return obterMetricaPadrao(categoria);

  let m = metricaRaw;
  if (m === "QUANTIDADE_CABECAS" || m === "cabecas") m = "QTD_CABECAS";
  if (m === "arroba") m = "PESO_MEDIO_ARROBA";
  if (m === "sacas") m = "VOLUME_SACAS";
  if (m === "toneladas") m = "PESO_TOTAL_TON";

  if (disponiveis.includes(m as MetricaPeso)) {
    return m as MetricaPeso;
  }
  return obterMetricaPadrao(categoria);
}

export type CriterioOrdenacao =
  | "recentes"
  | "menor_preco"
  | "maior_preco"
  | "maior_peso";

export interface MarketPageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

export function MarketPage({ onOpenDialog }: MarketPageProps = {}) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [favoritosIds, setFavoritosIds] = useState<string[]>(() =>
    session?.conta?.id ? obterFavoritosIds(session.conta.id) : []
  );
  const [prevUserId, setPrevUserId] = useState(session?.conta?.id);
  if (session?.conta?.id !== prevUserId) {
    setPrevUserId(session?.conta?.id);
    setFavoritosIds(session?.conta?.id ? obterFavoritosIds(session.conta.id) : []);
  }

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

  // Deriva parâmetros de preço e peso da URL (Single Source of Truth)
  const precoMinParam = searchParams.get("preco_min");
  const precoMaxParam = searchParams.get("preco_max");
  const filtroPrecoMin =
    precoMinParam !== null && precoMinParam.trim() !== "" && !isNaN(Number(precoMinParam))
      ? Number(precoMinParam)
      : null;
  const filtroPrecoMax =
    precoMaxParam !== null && precoMaxParam.trim() !== "" && !isNaN(Number(precoMaxParam))
      ? Number(precoMaxParam)
      : null;

  const metricaParam = searchParams.get("metrica_peso");
  const metricaAtiva = normalizarMetrica(metricaParam, filtroCategoria);

  const pesoMinParam = searchParams.get("peso_min");
  const pesoMaxParam = searchParams.get("peso_max");
  const filtroPesoMin =
    pesoMinParam !== null && pesoMinParam.trim() !== "" && !isNaN(Number(pesoMinParam))
      ? Number(pesoMinParam)
      : null;
  const filtroPesoMax =
    pesoMaxParam !== null && pesoMaxParam.trim() !== "" && !isNaN(Number(pesoMaxParam))
      ? Number(pesoMaxParam)
      : null;

  // Deriva parâmetro de ordenação da URL (Single Source of Truth)
  const paramOrdenacao = searchParams.get("ordenacao");
  const ordenacaoAtiva: CriterioOrdenacao =
    paramOrdenacao === "menor_preco" ||
    paramOrdenacao === "maior_preco" ||
    paramOrdenacao === "maior_peso"
      ? paramOrdenacao
      : "recentes";

  // Estados locais do formulário de rascunho do painel colapsável
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [draftPrecoMin, setDraftPrecoMin] = useState("");
  const [draftPrecoMax, setDraftPrecoMax] = useState("");
  const [draftMetricaPeso, setDraftMetricaPeso] = useState<MetricaPeso>(metricaAtiva);
  const [draftPesoMin, setDraftPesoMin] = useState("");
  const [draftPesoMax, setDraftPesoMax] = useState("");

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

  // Sincroniza favoritos com a sessão ativa e resolve pendência pós-login (US-025)
  useEffect(() => {
    if (!session?.conta?.id) return;
    const pendingId = sessionStorage.getItem("safra_pending_favorite");
    if (pendingId) {
      sessionStorage.removeItem("safra_pending_favorite");
      alternarFavoritoStorage(session.conta.id, pendingId);
      setFavoritosIds(obterFavoritosIds(session.conta.id));
      window.dispatchEvent(new CustomEvent("safra:favorites-updated"));
    }
  }, [session]);

  useEffect(() => {
    const handleFavoritesUpdated = () => {
      if (session?.conta?.id) {
        setFavoritosIds(obterFavoritosIds(session.conta.id));
      }
    };
    window.addEventListener("safra:favorites-updated", handleFavoritesUpdated);
    return () => {
      window.removeEventListener("safra:favorites-updated", handleFavoritesUpdated);
    };
  }, [session]);

  const handleToggleFavorito = (e: React.MouseEvent, anuncioId: string) => {
    e.stopPropagation();
    if (!session?.conta?.id) {
      sessionStorage.setItem("safra_pending_favorite", anuncioId);
      onOpenDialog?.("login");
      return;
    }
    alternarFavoritoStorage(session.conta.id, anuncioId);
    setFavoritosIds(obterFavoritosIds(session.conta.id));
  };

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

  const handleSelectOrdenacao = (novaOrdem: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (novaOrdem === "recentes" || !novaOrdem) {
          next.delete("ordenacao");
        } else {
          next.set("ordenacao", novaOrdem);
        }
        return next;
      },
      { replace: true }
    );
  };

  const handleToggleFilterPanel = () => {
    if (!isFilterPanelOpen) {
      setDraftPrecoMin(filtroPrecoMin !== null ? String(filtroPrecoMin) : "");
      setDraftPrecoMax(filtroPrecoMax !== null ? String(filtroPrecoMax) : "");
      setDraftMetricaPeso(metricaAtiva);
      setDraftPesoMin(filtroPesoMin !== null ? String(filtroPesoMin) : "");
      setDraftPesoMax(filtroPesoMax !== null ? String(filtroPesoMax) : "");
    }
    setIsFilterPanelOpen((prev) => !prev);
  };

  // Validação inline dos campos de rascunho
  const numDraftPrecoMin =
    draftPrecoMin.trim() !== "" && !isNaN(Number(draftPrecoMin)) ? Number(draftPrecoMin) : null;
  const numDraftPrecoMax =
    draftPrecoMax.trim() !== "" && !isNaN(Number(draftPrecoMax)) ? Number(draftPrecoMax) : null;
  const numDraftPesoMin =
    draftPesoMin.trim() !== "" && !isNaN(Number(draftPesoMin)) ? Number(draftPesoMin) : null;
  const numDraftPesoMax =
    draftPesoMax.trim() !== "" && !isNaN(Number(draftPesoMax)) ? Number(draftPesoMax) : null;

  const precoInvalido =
    numDraftPrecoMin !== null && numDraftPrecoMax !== null && numDraftPrecoMin > numDraftPrecoMax;
  const pesoInvalido =
    numDraftPesoMin !== null && numDraftPesoMax !== null && numDraftPesoMin > numDraftPesoMax;

  const precoNegativo =
    (numDraftPrecoMin !== null && numDraftPrecoMin < 0) ||
    (numDraftPrecoMax !== null && numDraftPrecoMax < 0);
  const pesoNegativo =
    (numDraftPesoMin !== null && numDraftPesoMin < 0) ||
    (numDraftPesoMax !== null && numDraftPesoMax < 0);

  const temErroValidacao = precoInvalido || pesoInvalido || precoNegativo || pesoNegativo;

  const handleApplyNumericFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (temErroValidacao) return;

    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);

        if (numDraftPrecoMin !== null && numDraftPrecoMin >= 0) {
          next.set("preco_min", String(numDraftPrecoMin));
        } else {
          next.delete("preco_min");
        }

        if (numDraftPrecoMax !== null && numDraftPrecoMax >= 0) {
          next.set("preco_max", String(numDraftPrecoMax));
        } else {
          next.delete("preco_max");
        }

        const temFiltroPeso =
          (numDraftPesoMin !== null && numDraftPesoMin >= 0) ||
          (numDraftPesoMax !== null && numDraftPesoMax >= 0);

        if (temFiltroPeso) {
          next.set("metrica_peso", draftMetricaPeso);
          if (numDraftPesoMin !== null && numDraftPesoMin >= 0) {
            next.set("peso_min", String(numDraftPesoMin));
          } else {
            next.delete("peso_min");
          }
          if (numDraftPesoMax !== null && numDraftPesoMax >= 0) {
            next.set("peso_max", String(numDraftPesoMax));
          } else {
            next.delete("peso_max");
          }
        } else {
          next.delete("metrica_peso");
          next.delete("peso_min");
          next.delete("peso_max");
        }

        return next;
      },
      { replace: true }
    );

    setIsFilterPanelOpen(false);
  };

  const handleResetDrafts = () => {
    setDraftPrecoMin("");
    setDraftPrecoMax("");
    setDraftPesoMin("");
    setDraftPesoMax("");
    setDraftMetricaPeso(obterMetricaPadrao(filtroCategoria));
  };

  const handleClearPriceFilter = () => {
    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);
        next.delete("preco_min");
        next.delete("preco_max");
        return next;
      },
      { replace: true }
    );
    setDraftPrecoMin("");
    setDraftPrecoMax("");
  };

  const handleClearWeightFilter = () => {
    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);
        next.delete("metrica_peso");
        next.delete("peso_min");
        next.delete("peso_max");
        return next;
      },
      { replace: true }
    );
    setDraftPesoMin("");
    setDraftPesoMax("");
  };

  const handleClearNumericFilters = () => {
    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);
        next.delete("preco_min");
        next.delete("preco_max");
        next.delete("metrica_peso");
        next.delete("peso_min");
        next.delete("peso_max");
        return next;
      },
      { replace: true }
    );
    setDraftPrecoMin("");
    setDraftPrecoMax("");
    setDraftPesoMin("");
    setDraftPesoMax("");
  };

  const handleClearAllFilters = () => {
    setSearchTerm("");
    setDebouncedTerm("");
    setDraftPrecoMin("");
    setDraftPrecoMax("");
    setDraftPesoMin("");
    setDraftPesoMax("");
    setIsFilterPanelOpen(false);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams();
        const ordem = prev.get("ordenacao");
        if (ordem) next.set("ordenacao", ordem);
        return next;
      },
      { replace: true }
    );
    searchInputRef.current?.focus();
  };

  const handleSelectCategoria = (cat: "TODOS" | "ANIMAL" | "GRAOS") => {
    const targetCat = filtroCategoria === cat && cat !== "TODOS" ? "TODOS" : cat;

    setSearchParams(
      (prevParams) => {
        const next = new URLSearchParams(prevParams);

        if (targetCat === "TODOS") {
          next.delete("categoria");
          next.delete("cultura");
        } else {
          next.set("categoria", targetCat);
          next.delete("cultura");
        }

        // Se a métrica de peso aplicada na URL não for compatível com a nova categoria, ajusta/remove
        const metricaAtual = next.get("metrica_peso");
        if (metricaAtual) {
          const metricasValidas = obterMetricasDisponiveis(targetCat);
          if (!metricasValidas.includes(metricaAtual as MetricaPeso)) {
            next.delete("metrica_peso");
            next.delete("peso_min");
            next.delete("peso_max");
          }
        }

        return next;
      },
      { replace: true }
    );

    // Ajusta draft de métrica se a atual não for compatível
    const metricasValidas = obterMetricasDisponiveis(targetCat);
    if (!metricasValidas.includes(draftMetricaPeso)) {
      setDraftMetricaPeso(obterMetricaPadrao(targetCat));
      setDraftPesoMin("");
      setDraftPesoMax("");
    }
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

    const passaPreco = (() => {
      if (filtroPrecoMin !== null && anuncio.precoTotal < filtroPrecoMin) {
        return false;
      }
      if (filtroPrecoMax !== null && anuncio.precoTotal > filtroPrecoMax) {
        return false;
      }
      return true;
    })();

    const passaPesoVolume = (() => {
      if (filtroPesoMin === null && filtroPesoMax === null) {
        return true;
      }

      let valorComparacao: number | undefined;

      if (anuncio.categoria === "ANIMAL") {
        if (metricaAtiva === "PESO_MEDIO_ARROBA") {
          valorComparacao = anuncio.pesoMedioArroba;
        } else if (metricaAtiva === "QTD_CABECAS") {
          valorComparacao = anuncio.quantidadeCabecas;
        } else if (metricaAtiva === "PESO_TOTAL_TON") {
          const totalKg =
            anuncio.pesoTotalKg ?? (anuncio.quantidadeCabecas * (anuncio.pesoMedioKg ?? 0));
          valorComparacao = totalKg ? totalKg / 1000 : undefined;
        }
      } else if (anuncio.categoria === "GRAOS") {
        if (metricaAtiva === "VOLUME_SACAS") {
          valorComparacao = anuncio.quantidadeSacas;
        } else if (metricaAtiva === "PESO_TOTAL_TON") {
          valorComparacao =
            anuncio.pesoTotalToneladas ?? (anuncio.pesoTotalKg ? anuncio.pesoTotalKg / 1000 : undefined);
        }
      }

      if (valorComparacao === undefined) {
        return false;
      }

      if (filtroPesoMin !== null && valorComparacao < filtroPesoMin) {
        return false;
      }
      if (filtroPesoMax !== null && valorComparacao > filtroPesoMax) {
        return false;
      }
      return true;
    })();

    return passaCategoria && passaBusca && passaPreco && passaPesoVolume;
  });

  const obterPesoTotalToneladas = (anuncio: MarketplaceAd): number => {
    if (anuncio.categoria === "GRAOS") {
      return (
        anuncio.pesoTotalToneladas ??
        (anuncio.pesoTotalKg ? anuncio.pesoTotalKg / 1000 : 0)
      );
    }
    const totalKg =
      anuncio.pesoTotalKg ??
      (anuncio.quantidadeCabecas * (anuncio.pesoMedioKg ?? 0));
    return totalKg ? totalKg / 1000 : 0;
  };

  const anunciosOrdenados = [...anunciosFiltrados].sort((a, b) => {
    if (ordenacaoAtiva === "menor_preco") {
      const diff = a.precoTotal - b.precoTotal;
      if (diff !== 0) return diff;
    } else if (ordenacaoAtiva === "maior_preco") {
      const diff = b.precoTotal - a.precoTotal;
      if (diff !== 0) return diff;
    } else if (ordenacaoAtiva === "maior_peso") {
      const diff = obterPesoTotalToneladas(b) - obterPesoTotalToneladas(a);
      if (diff !== 0) return diff;
    }

    // Desempate estável ou critério padrão ("recentes"): mais recente primeiro
    const dateDiff =
      new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.id.localeCompare(a.id);
  });

  // Estados e textos para tags de filtros ativos
  const temBuscaAtiva = Boolean(debouncedTerm.trim());
  const temCategoriaAtiva = filtroCategoria !== "TODOS" || filtroCultura !== "TODAS";
  const temPrecoAtivo = filtroPrecoMin !== null || filtroPrecoMax !== null;
  const temPesoAtivo = filtroPesoMin !== null || filtroPesoMax !== null;
  const activeNumericFilterCount = (temPrecoAtivo ? 1 : 0) + (temPesoAtivo ? 1 : 0);
  const temFiltroAtivo =
    temBuscaAtiva || temCategoriaAtiva || temPrecoAtivo || temPesoAtivo;

  const textoTagPreco = (() => {
    if (!temPrecoAtivo) return "";
    const formatar = (val: number) =>
      val.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      });

    if (filtroPrecoMin !== null && filtroPrecoMax !== null) {
      return `De ${formatar(filtroPrecoMin)} até ${formatar(filtroPrecoMax)}`;
    }
    if (filtroPrecoMin !== null) {
      return `A partir de ${formatar(filtroPrecoMin)}`;
    }
    if (filtroPrecoMax !== null) {
      return `Até ${formatar(filtroPrecoMax)}`;
    }
    return "";
  })();

  const textoTagPeso = (() => {
    if (!temPesoAtivo) return "";
    const config = METRICAS_CONFIG[metricaAtiva];
    const unit = config.shortUnit;

    const formatarNum = (val: number) =>
      val.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

    if (filtroPesoMin !== null && filtroPesoMax !== null) {
      if (metricaAtiva === "PESO_MEDIO_ARROBA") {
        return `${formatarNum(filtroPesoMin)}@ a ${formatarNum(filtroPesoMax)}@`;
      }
      return `${formatarNum(filtroPesoMin)} a ${formatarNum(filtroPesoMax)} ${unit}`;
    }
    if (filtroPesoMin !== null) {
      return `A partir de ${formatarNum(filtroPesoMin)} ${unit}`;
    }
    if (filtroPesoMax !== null) {
      return `Até ${formatarNum(filtroPesoMax)} ${unit}`;
    }
    return "";
  })();

  const iconeTagPeso = (() => {
    if (metricaAtiva === "VOLUME_SACAS") return "📦";
    if (metricaAtiva === "QTD_CABECAS") return "🐂";
    return "⚖️";
  })();

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

            {/* Linha de Utilidades: Contagem de Ofertas, Ordenação e Filtros */}
            <div className="market-utility-bar">
              <span className="market-count-text">
                Exibindo <strong>{anunciosOrdenados.length}</strong>{" "}
                {anunciosOrdenados.length === 1 ? "oferta" : "ofertas"}
              </span>

              <div className="market-utility-actions">
                <div className="market-sort">
                  <label htmlFor="market-sort-select" className="market-sort__label">
                    Ordenar:
                  </label>
                  <select
                    id="market-sort-select"
                    className="market-sort__select"
                    value={ordenacaoAtiva}
                    onChange={(e) => handleSelectOrdenacao(e.target.value)}
                    aria-label="Critério de ordenação dos anúncios"
                  >
                    <option value="recentes">Mais recentes</option>
                    <option value="menor_preco">Menor preço total</option>
                    <option value="maior_preco">Maior preço total</option>
                    <option value="maior_peso">Maior peso / volume</option>
                  </select>
                </div>

                <button
                  type="button"
                  className={`market-filter-btn-trigger ${
                    isFilterPanelOpen ? "market-filter-btn-trigger--open" : ""
                  } ${activeNumericFilterCount > 0 ? "market-filter-btn-trigger--active" : ""}`}
                  onClick={handleToggleFilterPanel}
                  aria-expanded={isFilterPanelOpen}
                  aria-controls="market-filter-panel"
                  title="Filtros avançados de preço e volume"
                >
                  <Icon name="sliders" className="market-filter-btn-icon" />
                  <span>Filtros de Preço e Peso</span>
                  {activeNumericFilterCount > 0 && (
                    <span className="market-filter-badge" title={`${activeNumericFilterCount} filtros ativos`}>
                      {activeNumericFilterCount}
                    </span>
                  )}
                  <Icon
                    name="chevron"
                    className={`market-filter-btn-chevron ${
                      isFilterPanelOpen ? "market-filter-btn-chevron--rotated" : ""
                    }`}
                  />
                </button>
              </div>
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

          {/* Painel Suspenso de Filtros Numéricos (US-023) */}
          {isFilterPanelOpen && (
            <form
              id="market-filter-panel"
              className="market-filter-panel"
              onSubmit={handleApplyNumericFilters}
              noValidate
            >
              <div className="market-filter-panel__header">
                <div className="market-filter-panel__title">
                  <Icon name="sliders" />
                  <strong>Filtros Avançados de Preço e Volume</strong>
                </div>
                <button
                  type="button"
                  className="market-filter-panel__close"
                  onClick={() => setIsFilterPanelOpen(false)}
                  title="Fechar painel de filtros"
                  aria-label="Fechar painel de filtros"
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="market-filter-panel__body">
                {/* Grupo 1: Faixa de Preço */}
                <div className="market-filter-group">
                  <div className="market-filter-group__header">
                    <label className="market-filter-group__label">
                      Preço Total do Lote (R$)
                    </label>
                    <span className="market-filter-group__hint">
                      Valor total da negociação
                    </span>
                  </div>
                  <div className="market-range-inputs">
                    <div className="market-input-wrapper">
                      <span className="market-input-prefix">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        className={`market-number-input ${
                          precoInvalido || precoNegativo ? "market-number-input--error" : ""
                        }`}
                        placeholder="Mínimo (ex: 50.000)"
                        value={draftPrecoMin}
                        onChange={(e) => setDraftPrecoMin(e.target.value)}
                        aria-label="Preço mínimo em reais"
                      />
                    </div>
                    <span className="market-range-sep">até</span>
                    <div className="market-input-wrapper">
                      <span className="market-input-prefix">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        className={`market-number-input ${
                          precoInvalido || precoNegativo ? "market-number-input--error" : ""
                        }`}
                        placeholder="Máximo (ex: 250.000)"
                        value={draftPrecoMax}
                        onChange={(e) => setDraftPrecoMax(e.target.value)}
                        aria-label="Preço máximo em reais"
                      />
                    </div>
                  </div>
                  {precoInvalido && (
                    <p className="market-filter-error" role="alert">
                      <Icon name="alert" />
                      <span>O preço mínimo não pode ser maior que o máximo.</span>
                    </p>
                  )}
                  {precoNegativo && (
                    <p className="market-filter-error" role="alert">
                      <Icon name="alert" />
                      <span>Os valores de preço não podem ser negativos.</span>
                    </p>
                  )}
                </div>

                {/* Grupo 2: Volume e Peso */}
                <div className="market-filter-group">
                  <div className="market-filter-group__header">
                    <label className="market-filter-group__label">
                      Volume e Peso do Lote
                    </label>
                    <span className="market-filter-group__hint">
                      Escolha a métrica ideal para sua logística
                    </span>
                  </div>

                  {/* Seletor Segmentado de Métricas */}
                  <div
                    className="market-metric-selector"
                    role="radiogroup"
                    aria-label="Selecione a métrica de peso ou volume"
                  >
                    {obterMetricasDisponiveis(filtroCategoria).map((metrica) => {
                      const cfg = METRICAS_CONFIG[metrica];
                      const isSelected = draftMetricaPeso === metrica;
                      return (
                        <button
                          key={metrica}
                          type="button"
                          className={`market-metric-chip ${
                            isSelected ? "market-metric-chip--active" : ""
                          }`}
                          onClick={() => {
                            if (draftMetricaPeso !== metrica) {
                              setDraftMetricaPeso(metrica);
                              setDraftPesoMin("");
                              setDraftPesoMax("");
                            }
                          }}
                          aria-pressed={isSelected}
                        >
                          {filtroCategoria === "TODOS" && metrica === "PESO_TOTAL_TON"
                            ? "Peso Total da Carga (ton)"
                            : cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="market-range-inputs">
                    <div className="market-input-wrapper">
                      <input
                        type="number"
                        min="0"
                        step={METRICAS_CONFIG[draftMetricaPeso].step || "1"}
                        className={`market-number-input ${
                          pesoInvalido || pesoNegativo ? "market-number-input--error" : ""
                        }`}
                        placeholder={`Mínimo (${METRICAS_CONFIG[draftMetricaPeso].minPlaceholder})`}
                        value={draftPesoMin}
                        onChange={(e) => setDraftPesoMin(e.target.value)}
                        aria-label={`Valor mínimo em ${METRICAS_CONFIG[draftMetricaPeso].label}`}
                      />
                      <span className="market-input-suffix">
                        {METRICAS_CONFIG[draftMetricaPeso].shortUnit}
                      </span>
                    </div>
                    <span className="market-range-sep">até</span>
                    <div className="market-input-wrapper">
                      <input
                        type="number"
                        min="0"
                        step={METRICAS_CONFIG[draftMetricaPeso].step || "1"}
                        className={`market-number-input ${
                          pesoInvalido || pesoNegativo ? "market-number-input--error" : ""
                        }`}
                        placeholder={`Máximo (${METRICAS_CONFIG[draftMetricaPeso].maxPlaceholder})`}
                        value={draftPesoMax}
                        onChange={(e) => setDraftPesoMax(e.target.value)}
                        aria-label={`Valor máximo em ${METRICAS_CONFIG[draftMetricaPeso].label}`}
                      />
                      <span className="market-input-suffix">
                        {METRICAS_CONFIG[draftMetricaPeso].shortUnit}
                      </span>
                    </div>
                  </div>
                  {pesoInvalido && (
                    <p className="market-filter-error" role="alert">
                      <Icon name="alert" />
                      <span>O valor mínimo não pode ser maior que o máximo.</span>
                    </p>
                  )}
                  {pesoNegativo && (
                    <p className="market-filter-error" role="alert">
                      <Icon name="alert" />
                      <span>Os valores de peso/volume não podem ser negativos.</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Rodapé de Ações do Painel */}
              <div className="market-filter-panel__footer">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={handleResetDrafts}
                >
                  Limpar campos
                </button>
                <div className="market-filter-panel__footer-actions">
                  <button
                    type="button"
                    className="button button--outline"
                    onClick={() => setIsFilterPanelOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="button button--primary"
                    disabled={temErroValidacao}
                  >
                    Aplicar Filtros
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Tags de Filtros Ativos e "Limpar todos" (US-023) */}
          {temFiltroAtivo && (
            <div className="market-active-filters" aria-label="Filtros aplicados">
              <span className="market-active-filters__label">Filtros ativos:</span>
              <div className="market-active-filters__list">
                {/* Tag de Busca */}
                {temBuscaAtiva && (
                  <span className="market-filter-pill">
                    <span className="market-filter-pill__icon">🔍</span>
                    <span>&ldquo;{debouncedTerm.trim()}&rdquo;</span>
                    <button
                      type="button"
                      className="market-filter-pill__btn"
                      onClick={handleClearSearch}
                      title="Remover filtro de busca"
                      aria-label="Remover filtro de busca"
                    >
                      <Icon name="close" />
                    </button>
                  </span>
                )}

                {/* Tag de Categoria */}
                {temCategoriaAtiva && (
                  <span className="market-filter-pill">
                    <span className="market-filter-pill__icon">
                      {filtroCategoria === "ANIMAL" ? "🐂" : "🌾"}
                    </span>
                    <span>Categoria: {labelCategoriaAtiva}</span>
                    <button
                      type="button"
                      className="market-filter-pill__btn"
                      onClick={handleClearCategory}
                      title="Remover filtro de categoria"
                      aria-label="Remover filtro de categoria"
                    >
                      <Icon name="close" />
                    </button>
                  </span>
                )}

                {/* Tag de Preço */}
                {temPrecoAtivo && (
                  <span className="market-filter-pill">
                    <span className="market-filter-pill__icon">💰</span>
                    <span>{textoTagPreco}</span>
                    <button
                      type="button"
                      className="market-filter-pill__btn"
                      onClick={handleClearPriceFilter}
                      title="Remover filtro de preço"
                      aria-label="Remover filtro de preço"
                    >
                      <Icon name="close" />
                    </button>
                  </span>
                )}

                {/* Tag de Peso / Volume */}
                {temPesoAtivo && (
                  <span className="market-filter-pill">
                    <span className="market-filter-pill__icon">{iconeTagPeso}</span>
                    <span>{textoTagPeso}</span>
                    <button
                      type="button"
                      className="market-filter-pill__btn"
                      onClick={handleClearWeightFilter}
                      title="Remover filtro de peso ou volume"
                      aria-label="Remover filtro de peso ou volume"
                    >
                      <Icon name="close" />
                    </button>
                  </span>
                )}

                {/* Botão Discreto Limpar Todos */}
                <button
                  type="button"
                  className="market-clear-all-btn"
                  onClick={handleClearAllFilters}
                  title="Limpar todos os filtros e ver catálogo completo"
                >
                  • Limpar todos
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
        ) : anunciosOrdenados.length === 0 ? (
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
                {temPrecoAtivo || temPesoAtivo ? " com os filtros de preço e peso atuais" : ""}.
                Tente palavras-chave mais genéricas, revise a ortografia ou limpe a busca.
              </p>
              <div className="market-empty-box__actions">
                <button
                  type="button"
                  className="button button--primary button--large"
                  onClick={handleClearSearch}
                >
                  Limpar busca e ver ofertas
                </button>
                {temFiltroAtivo && (
                  <button
                    type="button"
                    className="button button--outline button--large"
                    onClick={handleClearAllFilters}
                  >
                    Limpar todos os filtros
                  </button>
                )}
              </div>
            </div>
          ) : temPrecoAtivo || temPesoAtivo ? (
            <div className="market-empty-box market-empty-box--filters" role="status">
              <div className="market-empty-box__icon-wrapper" aria-hidden="true">
                <Icon name="sliders" />
              </div>
              <h2>Nenhum lote encontrado com os filtros aplicados</h2>
              <p>
                Não há ofertas que atendam aos limites de valores e volumes estipulados
                {filtroCategoria !== "TODOS" ? ` em ${labelCategoriaAtiva}` : ""}.
                Amplie a faixa informada ou limpe os filtros para visualizar as ofertas disponíveis.
              </p>
              <div className="market-empty-box__actions">
                <button
                  type="button"
                  className="button button--primary button--large"
                  onClick={handleClearNumericFilters}
                >
                  Limpar filtros de preço e peso
                </button>
                <button
                  type="button"
                  className="button button--outline button--large"
                  onClick={handleClearAllFilters}
                >
                  Ver todo o mercado
                </button>
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
            {anunciosOrdenados.map((anuncio) => {
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
                    <button
                      type="button"
                      className={`market-card__fav-btn ${
                        favoritosIds.includes(anuncio.id) ? "market-card__fav-btn--active" : ""
                      }`}
                      onClick={(e) => handleToggleFavorito(e, anuncio.id)}
                      title={
                        favoritosIds.includes(anuncio.id)
                          ? "Remover dos favoritos"
                          : "Salvar nos favoritos"
                      }
                      aria-label="Favoritar anúncio"
                      aria-pressed={favoritosIds.includes(anuncio.id)}
                    >
                      <Icon name="star" />
                    </button>
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
