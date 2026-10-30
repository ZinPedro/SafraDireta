import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { ufs } from "../corporate-registration/corporateRegistration";
import { AccessRestricted } from "../../components/AccessRestricted";
import { Icon } from "../../components/Icon";
import { SellerBlockedView } from "../admin/SellerBlockedView";
import { obterStatusGovernancaProdutor } from "../admin/adminStorage";
import {
  BEEF_CATTLE_BREEDS,
  BEEF_CATTLE_PURPOSES,
  COFFEE_SCREEN_OPTIONS,
  GRAIN_CROPS,
  GRAIN_CROP_LABELS,
  GRAIN_HARVEST_SEASONS,
  GRAIN_PACKAGING_LABELS,
  GRAIN_PACKAGING_OPTIONS,
  GRAIN_SUBTYPES,
  comprimirImagemParaUpload,
  extrairYoutubeId,
  obterYoutubeEmbedUrl,
} from "./ads.types";
import type {
  AdDocumentItem,
  AdVideoItem,
  AnimalPurpose,
  CoffeeScreen,
  CreateAnimalAdInput,
  CreateGrainAdInput,
  GrainCrop,
  GrainPackaging,
  GrainPricingMode,
  GrainQualitySpecs,
  MarketplaceAd,
  PricingMode,
} from "./ads.types";
import {
  atualizarAnuncio,
  criarAnuncioAnimal,
  criarAnuncioGraos,
  obterAnuncioPorId,
} from "./adsStorage";
import { AdDocumentsSection } from "./AdDocumentsSection";
import defaultFarmImage from "../../assets/images/farm-landscape.jpeg";
import harvestSunsetImage from "../../assets/images/harvest-sunset.jpeg";
import "./ads.css";

interface AnimalAdCreatePageProps {
  onOpenDialog?: OpenDevelopmentDialog;
  mode?: "create" | "edit";
}

export function AnimalAdCreatePage({ onOpenDialog, mode = "create" }: AnimalAdCreatePageProps) {
  const { session } = useAuth();
  const navigate = useNavigate();

  // Modalidade ativa: Pecuária de Corte (ANIMAL) vs. Grãos e Café (GRAOS)
  const [modalidade, setModalidade] = useState<"ANIMAL" | "GRAOS">("ANIMAL");

  // Campos comuns
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");

  // Campos exclusivos de Pecuária de Corte (US-010)
  const [racaSelect, setRacaSelect] = useState("");
  const [racaCustom, setRacaCustom] = useState("");
  const [quantidadeCabecas, setQuantidadeCabecas] = useState<number | "">("");
  const [finalidade, setFinalidade] = useState<AnimalPurpose>("ENGORDA_ABATE");
  const [idadeMeses, setIdadeMeses] = useState<number | "">("");
  const [pesoUnitMode, setPesoUnitMode] = useState<"KG" | "ARROBA">("KG");
  const [pesoInputValue, setPesoInputValue] = useState<number | "">("");
  const [pricingMode, setPricingMode] = useState<PricingMode>("TOTAL");
  const [precoTotal, setPrecoTotal] = useState<number | "">("");
  const [precoPorCabeca, setPrecoPorCabeca] = useState<number | "">("");

  // Campos exclusivos de Grãos e Café (US-011)
  const [cultura, setCultura] = useState<GrainCrop | "">("");
  const [culturaPersonalizada, setCulturaPersonalizada] = useState("");
  const [subtipoSelect, setSubtipoSelect] = useState("");
  const [subtipoCustom, setSubtipoCustom] = useState("");
  const [safra, setSafra] = useState("2024/2025");
  const [embalagem, setEmbalagem] = useState<GrainPackaging>("SACARIA");
  const [umidadePercentual, setUmidadePercentual] = useState<number | "">("");
  const [volumeUnitMode, setVolumeUnitMode] = useState<"SACAS" | "TONELADAS">("SACAS");
  const [volumeInputValue, setVolumeInputValue] = useState<number | "">("");
  const [grainPricingMode, setGrainPricingMode] = useState<GrainPricingMode>("TOTAL");
  const [precoTotalGraos, setPrecoTotalGraos] = useState<number | "">("");
  const [precoPorSaca, setPrecoPorSaca] = useState<number | "">("");

  // Laudo Técnico e Qualidade Física Específicos por Cultura (US-011)
  // Soja
  const [sojaImpurezasPct, setSojaImpurezasPct] = useState<number | "">("");
  const [sojaAvariadosPct, setSojaAvariadosPct] = useState<number | "">("");
  const [sojaQuebradosPct, setSojaQuebradosPct] = useState<number | "">("");

  // Milho
  const [milhoImpurezasPct, setMilhoImpurezasPct] = useState<number | "">("");
  const [milhoArdidosPct, setMilhoArdidosPct] = useState<number | "">("");
  const [milhoQuebradosPct, setMilhoQuebradosPct] = useState<number | "">("");

  // Café
  const [cafePeneira, setCafePeneira] = useState<CoffeeScreen | "">("");
  const [cafeCatacaoDefeitos, setCafeCatacaoDefeitos] = useState("");
  const [cafePontuacaoSca, setCafePontuacaoSca] = useState<number | "">("");

  // Trigo
  const [trigoPhKgHl, setTrigoPhKgHl] = useState<number | "">("");
  const [trigoForcaGlutenW, setTrigoForcaGlutenW] = useState<number | "">("");
  const [trigoFallingNumberSeg, setTrigoFallingNumberSeg] = useState<number | "">("");

  // Outro
  const [outroObservacoesLaudo, setOutroObservacoesLaudo] = useState("");

  // Localização pré-carregada do perfil do produtor se existente
  const [cidade, setCidade] = useState(() => {
    if (!session) return "";
    try {
      const raw = localStorage.getItem(`safradireta_mock_profile:${session.conta.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return (parsed?.seller?.city || parsed?.address?.cidade || "") as string;
      }
    } catch {
      /* ignore */
    }
    return "";
  });

  const [uf, setUf] = useState(() => {
    if (!session) return "";
    try {
      const raw = localStorage.getItem(`safradireta_mock_profile:${session.conta.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return (parsed?.seller?.state || parsed?.address?.uf || "") as string;
      }
    } catch {
      /* ignore */
    }
    return "";
  });

  // Estados de Mídia (US-012)
  const [fotos, setFotos] = useState<string[]>([]);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videoMode, setVideoMode] = useState<"UPLOAD" | "YOUTUBE">("UPLOAD");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploadUrl, setVideoUploadUrl] = useState<string>("");
  const [videoUploadName, setVideoUploadName] = useState<string>("");
  const [videoYoutubeUrl, setVideoYoutubeUrl] = useState<string>("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  async function processarArquivosFotos(arquivos: FileList | File[]) {
    setFotoError(null);
    const lista = Array.from(arquivos);
    if (lista.length === 0) return;

    const vagasRestantes = 6 - fotos.length;
    if (vagasRestantes <= 0) {
      setFotoError("O limite máximo de 6 fotos por anúncio já foi atingido.");
      return;
    }

    const arquivosParaProcessar = lista.slice(0, vagasRestantes);
    if (lista.length > vagasRestantes) {
      setFotoError(`Apenas ${vagasRestantes} foto(s) pôde(ram) ser adicionada(s). Limite de 6 fotos atingido.`);
    }

    const fotosValidadas: string[] = [];
    for (const arquivo of arquivosParaProcessar) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) {
        setFotoError("Formato de arquivo inválido. Formatos suportados: JPEG, PNG e WebP.");
        continue;
      }
      if (arquivo.size > 10 * 1024 * 1024) {
        setFotoError("Cada foto deve ter no máximo 10MB.");
        continue;
      }
      try {
        const fotoComprimida = await comprimirImagemParaUpload(arquivo, 800, 0.7);
        fotosValidadas.push(fotoComprimida);
      } catch {
        setFotoError("Erro ao processar imagem para envio.");
      }
    }

    if (fotosValidadas.length > 0) {
      setFotos((prev) => [...prev, ...fotosValidadas]);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      void processarArquivosFotos(event.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      void processarArquivosFotos(e.dataTransfer.files);
    }
  }

  function definirComoCapa(index: number) {
    setFotos((prev) => {
      if (index === 0 || index >= prev.length) return prev;
      const escolhida = prev[index];
      const restantes = prev.filter((_, i) => i !== index);
      return [escolhida, ...restantes];
    });
  }

  function removerFoto(index: number) {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoError(null);

    const validVideoTypes = ["video/mp4", "video/quicktime", "video/webm"];
    if (!validVideoTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      setVideoError("Formato de vídeo inválido. Aceitos: MP4, MOV ou WebM.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setVideoError("O arquivo de vídeo excede o tamanho máximo de 30MB.");
      return;
    }

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUploadUrl(url);
    setVideoUploadName(file.name);
  }

  function removerVideoArquivo() {
    setVideoFile(null);
    setVideoUploadUrl("");
    setVideoUploadName("");
    setVideoError(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  }

  // Estados de Documentação Comprobatória (US-013)
  const [documentos, setDocumentos] = useState<AdDocumentItem[]>([]);

  // Estados de controle
  const [erros, setErros] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAdId, setCreatedAdId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { id } = useParams<{ id: string }>();
  const isEditMode = mode === "edit";

  const [isLoadingAd, setIsLoadingAd] = useState(isEditMode);
  const [adNotFound, setAdNotFound] = useState(false);
  const [loadedAd, setLoadedAd] = useState<MarketplaceAd | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    if (!isEditMode || !id) return;
    let isMounted = true;

    obterAnuncioPorId(id)
      .then((ad) => {
        if (!isMounted) return;
        if (!ad) {
          setAdNotFound(true);
          return;
        }

        if (session && ad.vendedorId !== session.conta.id) {
          setUnauthorized(true);
          return;
        }

        setLoadedAd(ad);
        setModalidade(ad.categoria);
        setTitulo(ad.titulo);
        setDescricao(ad.descricao || "");
        setCidade(ad.cidade);
        setUf(ad.uf);

        if (ad.fotos && ad.fotos.length > 0) {
          setFotos(ad.fotos);
        } else if (ad.imagemUrl) {
          setFotos([ad.imagemUrl]);
        }

        if (ad.video) {
          if (ad.video.tipo === "UPLOAD") {
            setVideoMode("UPLOAD");
            setVideoUploadUrl(ad.video.url);
            setVideoUploadName(ad.video.fileName || "Vídeo demonstrativo");
          } else {
            setVideoMode("YOUTUBE");
            setVideoYoutubeUrl(ad.video.url);
          }
        }

        if (ad.documentos && ad.documentos.length > 0) {
          setDocumentos(ad.documentos);
        }

        if (ad.categoria === "ANIMAL") {
          const matchBreed = BEEF_CATTLE_BREEDS.find((b) => b.value === ad.raca);
          if (matchBreed && matchBreed.value !== "OUTRA") {
            setRacaSelect(ad.raca);
            setRacaCustom("");
          } else {
            setRacaSelect("OUTRA");
            setRacaCustom(ad.raca);
          }

          setQuantidadeCabecas(ad.quantidadeCabecas);
          setFinalidade(ad.finalidade);
          if (ad.idadeMeses) setIdadeMeses(ad.idadeMeses);
          setPesoUnitMode("KG");
          setPesoInputValue(ad.pesoMedioKg);
          setPrecoTotal(ad.precoTotal);
          setPrecoPorCabeca(ad.precoPorCabeca);
          if (ad.precoPorCabeca > 0 && Math.round(ad.precoPorCabeca * ad.quantidadeCabecas) === Math.round(ad.precoTotal)) {
            setPricingMode("PER_HEAD");
          } else {
            setPricingMode("TOTAL");
          }
        } else {
          // GRAOS
          setCultura(ad.cultura);
          if (ad.culturaPersonalizada) setCulturaPersonalizada(ad.culturaPersonalizada);

          if (ad.cultura !== "OUTRO") {
            const listaSubtipos = GRAIN_SUBTYPES[ad.cultura];
            const matchSubtipo = listaSubtipos ? listaSubtipos.find((s) => s.value === ad.subtipo) : null;
            if (matchSubtipo && matchSubtipo.value !== "OUTRO") {
              setSubtipoSelect(ad.subtipo);
              setSubtipoCustom("");
            } else {
              setSubtipoSelect("OUTRO");
              setSubtipoCustom(ad.subtipo);
            }
          } else {
            setSubtipoCustom(ad.subtipo);
          }

          setSafra(ad.safra);
          setEmbalagem(ad.embalagem);
          setUmidadePercentual(ad.umidadePercentual);
          setVolumeUnitMode("SACAS");
          setVolumeInputValue(ad.quantidadeSacas);
          setPrecoTotalGraos(ad.precoTotal);
          setPrecoPorSaca(ad.precoPorSaca);

          if (ad.precoPorSaca > 0 && Math.round(ad.precoPorSaca * ad.quantidadeSacas) === Math.round(ad.precoTotal)) {
            setGrainPricingMode("PER_SACK");
          } else {
            setGrainPricingMode("TOTAL");
          }

          if (ad.laudoTecnico) {
            const spec = ad.laudoTecnico;
            if (spec.sojaImpurezasPct !== undefined) setSojaImpurezasPct(spec.sojaImpurezasPct);
            if (spec.sojaAvariadosPct !== undefined) setSojaAvariadosPct(spec.sojaAvariadosPct);
            if (spec.sojaQuebradosPct !== undefined) setSojaQuebradosPct(spec.sojaQuebradosPct);

            if (spec.milhoImpurezasPct !== undefined) setMilhoImpurezasPct(spec.milhoImpurezasPct);
            if (spec.milhoArdidosPct !== undefined) setMilhoArdidosPct(spec.milhoArdidosPct);
            if (spec.milhoQuebradosPct !== undefined) setMilhoQuebradosPct(spec.milhoQuebradosPct);

            if (spec.cafePeneira) setCafePeneira(spec.cafePeneira);
            if (spec.cafeCatacaoDefeitos) setCafeCatacaoDefeitos(spec.cafeCatacaoDefeitos);
            if (spec.cafePontuacaoSca !== undefined) setCafePontuacaoSca(spec.cafePontuacaoSca);

            if (spec.trigoPhKgHl !== undefined) setTrigoPhKgHl(spec.trigoPhKgHl);
            if (spec.trigoForcaGlutenW !== undefined) setTrigoForcaGlutenW(spec.trigoForcaGlutenW);
            if (spec.trigoFallingNumberSeg !== undefined) setTrigoFallingNumberSeg(spec.trigoFallingNumberSeg);

            if (spec.outroObservacoesLaudo) setOutroObservacoesLaudo(spec.outroObservacoesLaudo);
          }
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar anúncio para edição:", err);
        if (isMounted) setAdNotFound(true);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAd(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isEditMode, id, session]);

  const govStatus = session ? obterStatusGovernancaProdutor(session.conta.id) : null;
  const isBlockedSeller =
    session?.vendedorEstado === "SUSPENSO" ||
    session?.vendedorEstado === "BANIDO" ||
    govStatus?.estado === "SUSPENSO" ||
    govStatus?.estado === "BANIDO";

  if (session && isBlockedSeller) {
    const estadoBloqueio =
      session.vendedorEstado === "BANIDO" || govStatus?.estado === "BANIDO"
        ? "BANIDO"
        : "SUSPENSO";
    return (
      <SellerBlockedView
        produtorId={session.conta.id}
        estadoSessao={estadoBloqueio}
        nomeProdutor={session.conta.nome}
      />
    );
  }

  // Guarda de rota: Vendedor precisa estar habilitado
  if (!session || session.vendedorEstado !== "HABILITADO") {
    return (
      <AccessRestricted
        title="Área de publicação exclusiva para produtores habilitados"
        description="Para anunciar lotes de gado, grãos ou café e comercializar com compradores de todo o país, complete sua habilitação de vendedor na sua conta."
        onOpenLogin={() => onOpenDialog?.("login")}
        onOpenRegister={() => onOpenDialog?.("registration")}
      />
    );
  }

  if (isEditMode && isLoadingAd) {
    return (
      <div className="ad-create-page">
        <div className="container">
          <div className="ad-loading-box">
            <Icon name="clock" className="ad-loading-spinner" />
            <p>Carregando dados do lote para edição...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isEditMode && adNotFound) {
    return (
      <div className="ad-create-page">
        <div className="container">
          <div className="ad-not-found">
            <h2>Lote não encontrado</h2>
            <p>O anúncio solicitado para edição não foi localizado ou já foi encerrado.</p>
            <Link to={routes.myAds} className="button button--primary">
              Voltar aos Meus Anúncios
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isEditMode && (unauthorized || (loadedAd && session && loadedAd.vendedorId !== session.conta.id))) {
    return (
      <AccessRestricted
        title="Acesso não autorizado"
        description="Acesso não autorizado. Você só possui permissão para editar anúncios criados pela sua conta."
        customAction={
          <Link to={routes.myAds} className="button button--primary">
            Voltar aos Meus Anúncios
          </Link>
        }
      />
    );
  }

  function handleSelectModalidade(novaModalidade: "ANIMAL" | "GRAOS") {
    if (novaModalidade === modalidade) return;
    setModalidade(novaModalidade);
    setErros({});
  }

  // ---------------------------------------------------------------------------
  // Cálculos Reativos — Pecuária de Corte (Boi Gordo)
  // ---------------------------------------------------------------------------
  function handleTogglePesoUnit(modo: "KG" | "ARROBA") {
    if (modo === pesoUnitMode) return;
    if (typeof pesoInputValue === "number" && pesoInputValue > 0) {
      if (modo === "ARROBA") {
        setPesoInputValue(Number((pesoInputValue / 30).toFixed(2)));
      } else {
        setPesoInputValue(Number((pesoInputValue * 30).toFixed(1)));
      }
    }
    setPesoUnitMode(modo);
  }

  const cabecasNum = typeof quantidadeCabecas === "number" && quantidadeCabecas > 0 ? quantidadeCabecas : 0;

  const pesoKgNum =
    typeof pesoInputValue === "number" && pesoInputValue > 0
      ? pesoUnitMode === "KG"
        ? pesoInputValue
        : Number((pesoInputValue * 30).toFixed(1))
      : 0;

  const arrobasPorCabeca =
    typeof pesoInputValue === "number" && pesoInputValue > 0
      ? pesoUnitMode === "ARROBA"
        ? pesoInputValue
        : Number((pesoInputValue / 30).toFixed(2))
      : 0;

  const pesoTotalBoiadaKg = cabecasNum > 0 && pesoKgNum > 0 ? cabecasNum * pesoKgNum : 0;
  const pesoTotalBoiadaArrobas = pesoTotalBoiadaKg > 0 ? Number((pesoTotalBoiadaKg / 30).toFixed(2)) : 0;
  const pesoTotalToneladas = pesoTotalBoiadaKg > 0 ? Number((pesoTotalBoiadaKg / 1000).toFixed(2)) : 0;

  const precoTotalNum = typeof precoTotal === "number" && precoTotal > 0 ? precoTotal : 0;
  const precoCabecaNum = typeof precoPorCabeca === "number" && precoPorCabeca > 0 ? precoPorCabeca : 0;

  const valorTotalFinal =
    pricingMode === "TOTAL"
      ? precoTotalNum
      : cabecasNum > 0 && precoCabecaNum > 0
      ? cabecasNum * precoCabecaNum
      : 0;

  const valorCabecaFinal =
    pricingMode === "PER_HEAD"
      ? precoCabecaNum
      : cabecasNum > 0 && valorTotalFinal > 0
      ? Number((valorTotalFinal / cabecasNum).toFixed(2))
      : 0;

  const valorArrobaFinal =
    pesoTotalBoiadaArrobas > 0 && valorTotalFinal > 0
      ? Number((valorTotalFinal / pesoTotalBoiadaArrobas).toFixed(2))
      : 0;

  const racaFinal = racaSelect === "OUTRA" ? racaCustom.trim() : racaSelect;

  // ---------------------------------------------------------------------------
  // Cálculos Reativos — Grãos e Café (US-011)
  // ---------------------------------------------------------------------------
  function handleToggleVolumeUnit(modo: "SACAS" | "TONELADAS") {
    if (modo === volumeUnitMode) return;
    if (typeof volumeInputValue === "number" && volumeInputValue > 0) {
      if (modo === "TONELADAS") {
        // Converte Sacas de 60 kg para Toneladas: (sacas * 60) / 1000
        setVolumeInputValue(Number(((volumeInputValue * 60) / 1000).toFixed(2)));
      } else {
        // Converte Toneladas para Sacas de 60 kg: round((ton * 1000) / 60)
        setVolumeInputValue(Math.max(1, Math.round((volumeInputValue * 1000) / 60)));
      }
    }
    setVolumeUnitMode(modo);
  }

  const sacasCalculadas =
    typeof volumeInputValue === "number" && volumeInputValue > 0
      ? volumeUnitMode === "SACAS"
        ? Math.max(1, Math.round(volumeInputValue))
        : Math.max(1, Math.round((volumeInputValue * 1000) / 60))
      : 0;

  const kgGraosCalculados = sacasCalculadas > 0 ? Number((sacasCalculadas * 60).toFixed(1)) : 0;

  const toneladasGraosCalculadas =
    typeof volumeInputValue === "number" && volumeInputValue > 0
      ? volumeUnitMode === "TONELADAS"
        ? Number(volumeInputValue.toFixed(2))
        : Number(((sacasCalculadas * 60) / 1000).toFixed(2))
      : 0;

  const precoTotalGraosNum = typeof precoTotalGraos === "number" && precoTotalGraos > 0 ? precoTotalGraos : 0;
  const precoSacaNum = typeof precoPorSaca === "number" && precoPorSaca > 0 ? precoPorSaca : 0;

  const valorTotalGraosFinal =
    grainPricingMode === "TOTAL"
      ? precoTotalGraosNum
      : sacasCalculadas > 0 && precoSacaNum > 0
      ? Number((sacasCalculadas * precoSacaNum).toFixed(2))
      : 0;

  const valorSacaFinal =
    grainPricingMode === "PER_SACK"
      ? precoSacaNum
      : sacasCalculadas > 0 && valorTotalGraosFinal > 0
      ? Number((valorTotalGraosFinal / sacasCalculadas).toFixed(2))
      : 0;

  const valorToneladaFinal =
    toneladasGraosCalculadas > 0 && valorTotalGraosFinal > 0
      ? Number((valorTotalGraosFinal / toneladasGraosCalculadas).toFixed(2))
      : 0;

  const subtipoGraoFinal =
    cultura === "OUTRO"
      ? culturaPersonalizada.trim()
      : subtipoSelect === "OUTRO"
      ? subtipoCustom.trim()
      : subtipoSelect;

  const grainTag1 = cultura ? GRAIN_CROP_LABELS[cultura] : "Cultura";
  const grainTag2 = (() => {
    if (!cultura) return "Classificação";
    if (cultura === "OUTRO") return culturaPersonalizada.trim() || "Especifique o grão";
    if (subtipoSelect === "OUTRO") return subtipoCustom.trim() || "Especifique o tipo";
    if (subtipoSelect) {
      const found = GRAIN_SUBTYPES[cultura].find((item) => item.value === subtipoSelect);
      return found ? found.shortTag : subtipoSelect;
    }
    return "Tipo comercial";
  })();

  // ---------------------------------------------------------------------------
  // Validação Condicional por Modalidade
  // ---------------------------------------------------------------------------
  function validar(): boolean {
    const novosErros: Record<string, string> = {};

    if (!titulo.trim() || titulo.trim().length < 5) {
      novosErros.titulo = "Informe um título descritivo de pelo menos 5 caracteres.";
    }

    if (modalidade === "ANIMAL") {
      if (!racaSelect) {
        novosErros.raca = "Selecione a raça dos animais.";
      } else if (racaSelect === "OUTRA" && !racaCustom.trim()) {
        novosErros.racaCustom = "Especifique a raça ou cruzamento (máximo 30 caracteres).";
      }
      if (!quantidadeCabecas || quantidadeCabecas <= 0) {
        novosErros.quantidadeCabecas = "A quantidade de cabeças deve ser maior que zero.";
      }
      if (!pesoInputValue || pesoInputValue <= 0) {
        novosErros.peso = `Informe o peso médio estimado por cabeça (${pesoUnitMode === "KG" ? "em kg" : "em @"}).`;
      }
      if (pricingMode === "TOTAL" && (!precoTotal || precoTotal <= 0)) {
        novosErros.precoTotal = "Informe o preço total do lote.";
      }
      if (pricingMode === "PER_HEAD" && (!precoPorCabeca || precoPorCabeca <= 0)) {
        novosErros.precoPorCabeca = "Informe o preço unitário por cabeça.";
      }
    } else {
      if (!cultura) {
        novosErros.cultura = "Selecione a cultura principal do lote.";
      } else if (cultura === "OUTRO" && !culturaPersonalizada.trim()) {
        novosErros.culturaPersonalizada = "Informe qual é a cultura ou grão (máximo 30 caracteres).";
      } else if (cultura !== "OUTRO") {
        if (!subtipoSelect) {
          novosErros.subtipo = "Selecione o tipo ou classificação comercial.";
        } else if (subtipoSelect === "OUTRO" && !subtipoCustom.trim()) {
          novosErros.subtipoCustom = "Especifique o tipo ou classificação (máximo 30 caracteres).";
        }
      }

      if (!safra) {
        novosErros.safra = "Selecione a safra de colheita.";
      }
      if (!embalagem) {
        novosErros.embalagem = "Selecione o padrão de embalagem ou armazenamento.";
      }

      // Umidade obrigatória para todas as culturas na lavoura
      if (
        umidadePercentual === "" ||
        Number(umidadePercentual) <= 0 ||
        Number(umidadePercentual) > 50
      ) {
        novosErros.umidade = "Informe o percentual de umidade do grão (obrigatório, entre 1% e 50%).";
      }

      // Parâmetros obrigatórios e validações contextuais de laudo
      if (cultura === "CAFE") {
        if (!cafePeneira) {
          novosErros.cafePeneira = "Selecione a peneira predominante do lote de café (obrigatório).";
        }
        if (
          cafePontuacaoSca !== "" &&
          (Number(cafePontuacaoSca) < 80 || Number(cafePontuacaoSca) > 100)
        ) {
          novosErros.cafePontuacao = "A pontuação SCA para cafés especiais deve estar entre 80 e 100 pontos.";
        }
      } else if (cultura === "TRIGO") {
        if (
          trigoPhKgHl === "" ||
          Number(trigoPhKgHl) < 50 ||
          Number(trigoPhKgHl) > 100
        ) {
          novosErros.trigoPh = "Informe o PH / peso hectolítrico do trigo (obrigatório, entre 50 e 100 kg/hL).";
        }
      }

      if (!volumeInputValue || volumeInputValue <= 0) {
        novosErros.volume =
          volumeUnitMode === "SACAS"
            ? "Informe a quantidade de sacas de 60 kg."
            : "Informe o volume total em toneladas.";
      }
      if (grainPricingMode === "TOTAL" && (!precoTotalGraos || precoTotalGraos <= 0)) {
        novosErros.precoTotalGraos = "Informe o valor total do lote agrícola.";
      }
      if (grainPricingMode === "PER_SACK" && (!precoPorSaca || precoPorSaca <= 0)) {
        novosErros.precoPorSaca = "Informe o valor unitário por saca de 60 kg.";
      }
    }

    if (!cidade.trim()) {
      novosErros.cidade = "Informe o município de retirada.";
    }
    if (!uf.trim()) {
      novosErros.uf = "Selecione o estado (UF).";
    }

    setErros(novosErros);
    const valido = Object.keys(novosErros).length === 0;

    if (!valido) {
      setTimeout(() => {
        const primeiroErro = document.querySelector(".form-input--error, .form-select--error") as HTMLElement;
        primeiroErro?.scrollIntoView({ behavior: "smooth", block: "center" });
        primeiroErro?.focus();
      }, 50);
    }

    return valido;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validar() || !session) return;

    setIsSubmitting(true);
    try {
      let videoPayload: AdVideoItem | undefined = undefined;
      if (videoMode === "UPLOAD" && videoUploadUrl) {
        videoPayload = {
          tipo: "UPLOAD",
          url: videoUploadUrl,
          fileBlob: videoFile || undefined,
          fileName: videoUploadName || undefined,
        };
      } else if (videoMode === "YOUTUBE" && videoYoutubeUrl.trim()) {
        const ytId = extrairYoutubeId(videoYoutubeUrl);
        if (ytId) {
          videoPayload = { tipo: "YOUTUBE", url: videoYoutubeUrl.trim() };
        }
      }

      if (modalidade === "ANIMAL") {
        const input: CreateAnimalAdInput = {
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          especie: "BOVINO",
          raca:
            isEditMode && loadedAd && loadedAd.categoria === "ANIMAL"
              ? loadedAd.raca
              : racaFinal.slice(0, 30),
          quantidadeCabecas: Number(quantidadeCabecas),
          finalidade,
          idadeMeses: idadeMeses ? Number(idadeMeses) : undefined,
          pesoMedioKg: pesoKgNum,
          pricingMode,
          precoTotal: pricingMode === "TOTAL" ? Number(precoTotal) : valorTotalFinal,
          precoPorCabeca: pricingMode === "PER_HEAD" ? Number(precoPorCabeca) : valorCabecaFinal,
          cidade: cidade.trim(),
          uf,
          fotos: fotos.length > 0 ? fotos : undefined,
          video: videoPayload,
          documentos: documentos.length > 0 ? documentos : undefined,
        };

        if (isEditMode && id) {
          const wasModerated = loadedAd?.status === "PAUSADO_MODERACAO";
          await atualizarAnuncio(id, input, session);
          navigate(`/anuncios/${id}`, {
            state: {
              toastMessage: wasModerated
                ? "Alterações enviadas! O lote entrou em revisão e voltará ao Mercado após liberação da Moderação."
                : "Anúncio atualizado com sucesso!",
            },
          });
          return;
        }

        const criado = await criarAnuncioAnimal(input, session);
        setCreatedAdId(criado.id);
      } else {
        let laudoTecnico: GrainQualitySpecs | undefined = undefined;

        if (cultura === "SOJA") {
          const specs: GrainQualitySpecs = {};
          if (sojaImpurezasPct !== "") specs.sojaImpurezasPct = Number(sojaImpurezasPct);
          if (sojaAvariadosPct !== "") specs.sojaAvariadosPct = Number(sojaAvariadosPct);
          if (sojaQuebradosPct !== "") specs.sojaQuebradosPct = Number(sojaQuebradosPct);
          if (Object.keys(specs).length > 0) laudoTecnico = specs;
        } else if (cultura === "MILHO") {
          const specs: GrainQualitySpecs = {};
          if (milhoImpurezasPct !== "") specs.milhoImpurezasPct = Number(milhoImpurezasPct);
          if (milhoArdidosPct !== "") specs.milhoArdidosPct = Number(milhoArdidosPct);
          if (milhoQuebradosPct !== "") specs.milhoQuebradosPct = Number(milhoQuebradosPct);
          if (Object.keys(specs).length > 0) laudoTecnico = specs;
        } else if (cultura === "CAFE") {
          const specs: GrainQualitySpecs = {};
          if (cafePeneira) specs.cafePeneira = cafePeneira as CoffeeScreen;
          if (cafeCatacaoDefeitos.trim()) specs.cafeCatacaoDefeitos = cafeCatacaoDefeitos.trim().slice(0, 30);
          if (cafePontuacaoSca !== "") specs.cafePontuacaoSca = Number(cafePontuacaoSca);
          laudoTecnico = specs;
        } else if (cultura === "TRIGO") {
          const specs: GrainQualitySpecs = {};
          if (trigoPhKgHl !== "") specs.trigoPhKgHl = Number(trigoPhKgHl);
          if (trigoForcaGlutenW !== "") specs.trigoForcaGlutenW = Number(trigoForcaGlutenW);
          if (trigoFallingNumberSeg !== "") specs.trigoFallingNumberSeg = Number(trigoFallingNumberSeg);
          laudoTecnico = specs;
        } else if (cultura === "OUTRO") {
          if (outroObservacoesLaudo.trim()) {
            laudoTecnico = { outroObservacoesLaudo: outroObservacoesLaudo.trim().slice(0, 60) };
          }
        }

        const inputGraos: CreateGrainAdInput = {
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          cultura: (isEditMode && loadedAd && loadedAd.categoria === "GRAOS"
            ? loadedAd.cultura
            : cultura) as GrainCrop,
          culturaPersonalizada:
            isEditMode && loadedAd && loadedAd.categoria === "GRAOS"
              ? loadedAd.culturaPersonalizada
              : cultura === "OUTRO"
              ? culturaPersonalizada.trim().slice(0, 30)
              : undefined,
          subtipo:
            isEditMode && loadedAd && loadedAd.categoria === "GRAOS"
              ? loadedAd.subtipo
              : subtipoGraoFinal.slice(0, 60),
          safra: isEditMode && loadedAd && loadedAd.categoria === "GRAOS" ? loadedAd.safra : safra,
          embalagem,
          umidadePercentual: Number(umidadePercentual),
          laudoTecnico,
          quantidadeSacas: sacasCalculadas,
          pesoTotalToneladas: toneladasGraosCalculadas,
          pricingMode: grainPricingMode,
          precoTotal:
            grainPricingMode === "TOTAL" ? Number(precoTotalGraos) : valorTotalGraosFinal,
          precoPorSaca:
            grainPricingMode === "PER_SACK" ? Number(precoPorSaca) : valorSacaFinal,
          cidade: cidade.trim(),
          uf,
          fotos: fotos.length > 0 ? fotos : undefined,
          video: videoPayload,
          documentos: documentos.length > 0 ? documentos : undefined,
        };

        if (isEditMode && id) {
          const wasModerated = loadedAd?.status === "PAUSADO_MODERACAO";
          await atualizarAnuncio(id, inputGraos, session);
          navigate(`/anuncios/${id}`, {
            state: {
              toastMessage: wasModerated
                ? "Alterações enviadas! O lote entrou em revisão e voltará ao Mercado após liberação da Moderação."
                : "Anúncio atualizado com sucesso!",
            },
          });
          return;
        }

        const criado = await criarAnuncioGraos(inputGraos, session);
        setCreatedAdId(criado.id);
      }

      setShowSuccessModal(true);
    } catch (err) {
      console.error("Erro ao salvar anúncio de lote:", err);
      const mensagem =
        err instanceof Error
          ? err.message
          : isEditMode
          ? "Ocorreu um erro ao atualizar o lote. Verifique o armazenamento do navegador e tente novamente."
          : "Ocorreu um erro ao publicar o lote. Verifique o armazenamento do navegador e tente novamente.";
      setErros({ geral: mensagem });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="ad-create-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="ad-breadcrumb" aria-label="Navegação estrutural">
          <Link to={routes.home}>Início</Link>
          <span aria-hidden="true">/</span>
          <Link to={routes.myAds}>Meus Anúncios</Link>
          <span aria-hidden="true">/</span>
          {isEditMode && loadedAd ? (
            <>
              <Link to={routes.adDetail(loadedAd.id)}>
                {loadedAd.titulo.length > 28 ? `${loadedAd.titulo.slice(0, 28)}...` : loadedAd.titulo}
              </Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">Editar Anúncio</span>
            </>
          ) : (
            <span aria-current="page">
              {modalidade === "ANIMAL" ? "Novo Lote de Boi Gordo" : "Novo Lote de Grãos ou Café"}
            </span>
          )}
        </nav>

        <header className="ad-create-header">
          <p className="eyebrow">
            {isEditMode
              ? modalidade === "ANIMAL"
                ? "Edição de Anúncio · Pecuária de Corte"
                : "Edição de Anúncio · Grãos e Café"
              : modalidade === "ANIMAL"
              ? "Pecuária de Corte · Boi Gordo"
              : "Produção Agrícola · Grãos e Café"}
          </p>
          <h1 className="ad-create-title">
            {isEditMode
              ? `Editar Lote: ${loadedAd?.titulo || "Anúncio"}`
              : modalidade === "ANIMAL"
              ? "Cadastro de Lote de Boi Gordo"
              : "Cadastro de Lote de Grãos ou Café"}
          </h1>
          <p className="ad-create-subtitle">
            {isEditMode
              ? "Atualize as informações técnicas, comerciais, valores ou fotos do lote. As alterações refletirão imediatamente no mercado."
              : modalidade === "ANIMAL"
              ? "Publique as especificações zootécnicas e comerciais da sua boiada. O lote ficará ativo imediatamente no mercado."
              : "Publique as especificações agronômicas, safra, volume e condições comerciais da sua produção agrícola no mercado."}
          </p>
        </header>

        {isEditMode && loadedAd?.status === "PAUSADO_MODERACAO" && (
          <div
            className="admin-ad-row__reason"
            style={{
              marginBottom: "1.5rem",
              padding: "1rem 1.25rem",
              fontSize: "0.92rem",
              borderRadius: "10px",
            }}
            role="status"
          >
            <strong>⏸ Anúncio Pausado pela Moderação:</strong>{" "}
            {loadedAd.motivoModeracao || "Realize os ajustes solicitados."}
            <br />
            <span style={{ display: "inline-block", marginTop: "0.35rem" }}>
              Ao salvar as alterações abaixo, este lote será encaminhado automaticamente para o
              status <strong>"Em Revisão"</strong> para liberação pela equipe de Governança.
            </span>
          </div>
        )}

        {/* Seletor de Modalidade (Boi Gordo vs Grãos e Café) */}
        <section className="ad-modality-selector" aria-label="Selecione a categoria do lote">
          <div className="ad-modality-selector__header">
            <span className="ad-modality-selector__label">Qual categoria de produção deseja anunciar?</span>
            {isEditMode && (
              <span className="ad-locked-badge">
                <Icon name="lock" /> Modalidade Fixada
              </span>
            )}
          </div>
          {isEditMode && (
            <div className="ad-edit-notice-banner" role="status">
              <Icon name="box" />
              <span>A modalidade do anúncio não pode ser alterada após a publicação.</span>
            </div>
          )}
          <div className="ad-modality-grid" role="radiogroup" aria-label="Modalidade do anúncio">
            <button
              type="button"
              role="radio"
              aria-checked={modalidade === "ANIMAL"}
              disabled={isEditMode}
              className={`ad-modality-card ${modalidade === "ANIMAL" ? "ad-modality-card--active" : ""} ${isEditMode ? "ad-modality-card--disabled" : ""}`}
              onClick={() => !isEditMode && handleSelectModalidade("ANIMAL")}
            >
              <div className="ad-modality-card__icon">
                <Icon name="box" />
              </div>
              <div className="ad-modality-card__body">
                <strong>Pecuária de Corte (Boi Gordo)</strong>
                <span>Lotes de engorda, terminação, recria e reprodução bovina.</span>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={modalidade === "GRAOS"}
              disabled={isEditMode}
              className={`ad-modality-card ${modalidade === "GRAOS" ? "ad-modality-card--active" : ""} ${isEditMode ? "ad-modality-card--disabled" : ""}`}
              onClick={() => !isEditMode && handleSelectModalidade("GRAOS")}
            >
              <div className="ad-modality-card__icon">
                <Icon name="leaf" />
              </div>
              <div className="ad-modality-card__body">
                <strong>Grãos e Café (Lavoura)</strong>
                <span>Lotes de café, soja, milho, trigo e outros grãos em sacas ou toneladas.</span>
              </div>
            </button>
          </div>
        </section>

        {erros.geral && (
          <div className="ad-alert ad-alert--error" role="alert">
            {erros.geral}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="ad-form">
          {/* BLOCO 1: Informações Gerais */}
          <section className="ad-form-section" aria-labelledby="section-geral">
            <h2 id="section-geral" className="ad-form-section__title">
              <Icon name="box" /> 1. Informações Gerais da Oferta
            </h2>

            <div className="form-group">
              <label htmlFor="ad-titulo" className="form-label">
                Título do Anúncio <span className="required">*</span>
              </label>
              <input
                id="ad-titulo"
                type="text"
                className={`form-input ${erros.titulo ? "form-input--error" : ""}`}
                placeholder={
                  modalidade === "ANIMAL"
                    ? "Ex: Lote de 80 Bois Nelore prontos para abate"
                    : "Ex: Lote de 500 Sacas de Café Arábica Bebida Mole — Safra 2024/2025"
                }
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={120}
                aria-invalid={Boolean(erros.titulo)}
                aria-describedby={erros.titulo ? "ad-titulo-error" : undefined}
                required
              />
              {erros.titulo && (
                <span id="ad-titulo-error" className="form-error">
                  {erros.titulo}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="ad-descricao" className="form-label">
                {modalidade === "ANIMAL"
                  ? "Descrição Detalhada do Manejo"
                  : "Descrição de Qualidade e Lote Agrícola"}{" "}
                <span className="form-label__optional">(opcional)</span>
              </label>
              <textarea
                id="ad-descricao"
                className="form-textarea"
                rows={4}
                placeholder={
                  modalidade === "ANIMAL"
                    ? "Informe detalhes da pastagem, confinamento, suplementação mineral, histórico sanitário e facilidade de embarque..."
                    : "Informe detalhes de peneira, bebida, secagem, laudo de classificação, condições de armazenagem e embarque..."
                }
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={800}
              />
              <span className="form-hint">
                {modalidade === "ANIMAL"
                  ? "Destaque os diferenciais de qualidade, acabamento de carcaça e rastreabilidade."
                  : "Destaque informações de laudo, peneira, índice de defeitos, secagem e logística de carregamento."}
              </span>
            </div>
          </section>

          {/* BLOCO 2 CONDICIONAL: Pecuária (ANIMAL) vs Lavoura (GRAOS) */}
          {modalidade === "ANIMAL" ? (
            <section className="ad-form-section" aria-labelledby="section-zootecnica">
              <h2 id="section-zootecnica" className="ad-form-section__title">
                <Icon name="leaf" /> 2. Especificações Zootécnicas do Rebanho
              </h2>

              {/* Linha 1: Raça e Quantidade de cabeças */}
              <div className="ad-form-grid ad-form-grid--2">
                <div className="form-group">
                  <label htmlFor="ad-raca" className="form-label">
                    Raça ou Linhagem Predominante <span className="required">*</span>
                  </label>
                  <select
                    id="ad-raca"
                    className={`form-select ${erros.raca ? "form-select--error" : ""} ${isEditMode ? "form-select--disabled" : ""}`}
                    disabled={isEditMode}
                    value={racaSelect}
                    onChange={(e) => {
                      if (isEditMode) return;
                      setRacaSelect(e.target.value);
                      if (erros.raca) {
                        setErros((prev) => ({ ...prev, raca: "" }));
                      }
                    }}
                    aria-invalid={Boolean(erros.raca)}
                    aria-describedby={erros.raca ? "ad-raca-error" : "ad-raca-hint"}
                    required
                  >
                    <option value="">Selecione a raça</option>
                    {BEEF_CATTLE_BREEDS.map((breed) => (
                      <option key={breed.value} value={breed.value}>
                        {breed.label}
                      </option>
                    ))}
                  </select>
                  {erros.raca && (
                    <span id="ad-raca-error" className="form-error">
                      {erros.raca}
                    </span>
                  )}
                  {!isEditMode && (
                    <span id="ad-raca-hint" className="form-hint">
                      Informe apenas a raça ou linhagem zootécnica. Detalhes de nutrição, cocho e manejo devem ser descritos no campo Descrição.
                    </span>
                  )}

                  {racaSelect === "OUTRA" && (
                    <div className="ad-raca-custom-box">
                      <div className="ad-raca-custom-header">
                        <label htmlFor="ad-raca-custom" className="form-label">
                          Especifique a Raça / Cruzamento <span className="required">*</span>
                        </label>
                        <span className="ad-char-counter" aria-live="polite">
                          {racaCustom.length}/30
                        </span>
                      </div>
                      <input
                        id="ad-raca-custom"
                        type="text"
                        className={`form-input ${erros.racaCustom ? "form-input--error" : ""} ${isEditMode ? "form-input--disabled" : ""}`}
                        disabled={isEditMode}
                        placeholder="Ex: Senepol x Nelore F2"
                        value={racaCustom}
                        onChange={(e) => {
                          if (isEditMode) return;
                          setRacaCustom(e.target.value);
                          if (erros.racaCustom) {
                            setErros((prev) => ({ ...prev, racaCustom: "" }));
                          }
                        }}
                        maxLength={30}
                        aria-invalid={Boolean(erros.racaCustom)}
                        aria-describedby={erros.racaCustom ? "ad-raca-custom-error" : undefined}
                        required
                      />
                      {erros.racaCustom && (
                        <span id="ad-raca-custom-error" className="form-error">
                          {erros.racaCustom}
                        </span>
                      )}
                    </div>
                  )}

                  {isEditMode && (
                    <span className="form-hint form-hint--locked">
                      🔒 A raça predominante do lote não pode ser alterada após a publicação.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="ad-quantidade" className="form-label">
                    Quantidade de Cabeças <span className="required">*</span>
                  </label>
                  <input
                    id="ad-quantidade"
                    type="number"
                    min={1}
                    max={5000}
                    className={`form-input ${erros.quantidadeCabecas ? "form-input--error" : ""}`}
                    placeholder="Ex: 80"
                    value={quantidadeCabecas}
                    onChange={(e) => setQuantidadeCabecas(e.target.value === "" ? "" : Number(e.target.value))}
                    aria-invalid={Boolean(erros.quantidadeCabecas)}
                    aria-describedby={erros.quantidadeCabecas ? "ad-quantidade-error" : undefined}
                    required
                  />
                  {erros.quantidadeCabecas && (
                    <span id="ad-quantidade-error" className="form-error">
                      {erros.quantidadeCabecas}
                    </span>
                  )}
                </div>
              </div>

              {/* Linha 2: Finalidade e Idade/Era */}
              <div className="ad-form-grid ad-form-grid--2">
                <div className="form-group">
                  <label htmlFor="ad-finalidade" className="form-label">
                    Finalidade da Criação <span className="required">*</span>
                  </label>
                  <select
                    id="ad-finalidade"
                    className="form-select"
                    value={finalidade}
                    onChange={(e) => setFinalidade(e.target.value as AnimalPurpose)}
                  >
                    {BEEF_CATTLE_PURPOSES.map((purp) => (
                      <option key={purp.value} value={purp.value}>
                        {purp.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="ad-idade" className="form-label">
                    Era / Idade Aproximada <span className="form-label__optional">(meses)</span>
                  </label>
                  <input
                    id="ad-idade"
                    type="number"
                    min={1}
                    max={120}
                    className="form-input"
                    placeholder="Ex: 30"
                    value={idadeMeses}
                    onChange={(e) => setIdadeMeses(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Linha 3: Mecanismo Bi-direcional de Peso (Kg <-> @) */}
              <div className="ad-weight-block">
                <div className="ad-weight-header">
                  <div>
                    <label htmlFor="ad-peso" className="form-label">
                      Peso Médio por Cabeça <span className="required">*</span>
                    </label>
                    <span className="ad-weight-subtext">
                      {pesoUnitMode === "KG"
                        ? "Digitando em Quilos (kg): o sistema converte automaticamente para Arrobas (@)"
                        : "Digitando em Arrobas (@): o sistema converte automaticamente para Quilos (kg)"}
                    </span>
                  </div>

                  <div className="ad-weight-unit-toggle" role="group" aria-label="Unidade de entrada de peso">
                    <button
                      type="button"
                      className={`ad-unit-btn ${pesoUnitMode === "KG" ? "ad-unit-btn--active" : ""}`}
                      onClick={() => handleTogglePesoUnit("KG")}
                    >
                      Quilos (kg)
                    </button>
                    <button
                      type="button"
                      className={`ad-unit-btn ${pesoUnitMode === "ARROBA" ? "ad-unit-btn--active" : ""}`}
                      onClick={() => handleTogglePesoUnit("ARROBA")}
                    >
                      Arrobas (@)
                    </button>
                  </div>
                </div>

                <div className="ad-input-with-unit">
                  <input
                    id="ad-peso"
                    type="number"
                    min={pesoUnitMode === "KG" ? 50 : 2}
                    max={pesoUnitMode === "KG" ? 1500 : 50}
                    step={pesoUnitMode === "KG" ? 5 : 0.5}
                    className={`form-input ${erros.peso ? "form-input--error" : ""}`}
                    placeholder={pesoUnitMode === "KG" ? "Ex: 540" : "Ex: 18"}
                    value={pesoInputValue}
                    onChange={(e) => setPesoInputValue(e.target.value === "" ? "" : Number(e.target.value))}
                    aria-invalid={Boolean(erros.peso)}
                    aria-describedby={erros.peso ? "ad-peso-error" : undefined}
                    required
                  />
                  <span className="ad-input-unit">
                    {pesoUnitMode === "KG" ? "kg peso vivo" : "@ por cabeça"}
                  </span>
                </div>
                {erros.peso && (
                  <span id="ad-peso-error" className="form-error">
                    {erros.peso}
                  </span>
                )}

                {typeof pesoInputValue === "number" && pesoInputValue > 0 && (
                  <div className="ad-weight-helper">
                    <Icon name="leaf" />
                    <span>
                      {pesoUnitMode === "KG" ? (
                        <>
                          Conversão zootécnica: <strong>{arrobasPorCabeca.toFixed(2)} @</strong> por cabeça (base: peso vivo ÷ 30 kg)
                        </>
                      ) : (
                        <>
                          Conversão zootécnica: <strong>{pesoKgNum.toFixed(1)} kg</strong> peso vivo por cabeça (base: @ × 30 kg)
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Linha 4: Painel Resumo da Boiada */}
              {cabecasNum > 0 && pesoKgNum > 0 ? (
                <div className="ad-metric-panel" aria-live="polite">
                  <div className="ad-metric-item">
                    <span className="ad-metric-label">Peso Médio por Cabeça</span>
                    <strong className="ad-metric-value">
                      {arrobasPorCabeca.toFixed(2)} @{" "}
                      <span className="ad-metric-sub">({pesoKgNum} kg)</span>
                    </strong>
                  </div>
                  <div className="ad-metric-item">
                    <span className="ad-metric-label">Carga Total Estimada</span>
                    <strong className="ad-metric-value">
                      {pesoTotalBoiadaArrobas.toLocaleString("pt-BR")} @{" "}
                      <span className="ad-metric-sub">
                        ({pesoTotalToneladas} t · {pesoTotalBoiadaKg.toLocaleString("pt-BR")} kg)
                      </span>
                    </strong>
                  </div>
                  <div className="ad-metric-item">
                    <span className="ad-metric-label">Total do Rebanho</span>
                    <strong className="ad-metric-value">{cabecasNum} cabeças</strong>
                  </div>
                </div>
              ) : (
                <div className="ad-metric-panel ad-metric-panel--empty">
                  <Icon name="leaf" />
                  <p>Preencha a quantidade de cabeças e o peso médio para ver o resumo da boiada.</p>
                </div>
              )}
            </section>
          ) : (
            <section className="ad-form-section" aria-labelledby="section-agronomica">
              <h2 id="section-agronomica" className="ad-form-section__title">
                <Icon name="leaf" /> 2. Especificações Agronômicas e Qualidade da Safra
              </h2>

              {/* Linha 1: Menu 1 (Cultura Principal) e Menu 2 (Tipo / Classificação Comercial) */}
              <div className="ad-form-grid ad-form-grid--2">
                <div className="form-group">
                  <label htmlFor="ad-cultura" className="form-label">
                    Cultura Principal <span className="required">*</span>
                  </label>
                  <select
                    id="ad-cultura"
                    className={`form-select ${erros.cultura ? "form-select--error" : ""} ${isEditMode ? "form-select--disabled" : ""}`}
                    value={cultura}
                    disabled={isEditMode}
                    onChange={(e) => {
                      if (isEditMode) return;
                      const novaCultura = e.target.value as GrainCrop | "";
                      setCultura(novaCultura);
                      setSubtipoSelect("");
                      setSubtipoCustom("");
                      setCulturaPersonalizada("");
                      setCafePeneira("");
                      setCafeCatacaoDefeitos("");
                      setCafePontuacaoSca("");
                      setSojaImpurezasPct("");
                      setSojaAvariadosPct("");
                      setSojaQuebradosPct("");
                      setMilhoImpurezasPct("");
                      setMilhoArdidosPct("");
                      setMilhoQuebradosPct("");
                      setTrigoPhKgHl("");
                      setTrigoForcaGlutenW("");
                      setTrigoFallingNumberSeg("");
                      setOutroObservacoesLaudo("");
                      setErros((prev) => {
                        const {
                          cultura: _c,
                          subtipo: _s,
                          culturaPersonalizada: _cp,
                          subtipoCustom: _sc,
                          umidade: _u,
                          cafePeneira: _cpn,
                          cafePontuacao: _cps,
                          trigoPh: _tph,
                          ...resto
                        } = prev;
                        return resto;
                      });
                    }}
                    aria-invalid={Boolean(erros.cultura)}
                    aria-describedby={erros.cultura ? "ad-cultura-error" : "ad-cultura-hint"}
                    required
                  >
                    <option value="">Selecione a cultura</option>
                    {GRAIN_CROPS.map((crop) => (
                      <option key={crop.value} value={crop.value}>
                        {crop.label}
                      </option>
                    ))}
                  </select>
                  {erros.cultura && (
                    <span id="ad-cultura-error" className="form-error">
                      {erros.cultura}
                    </span>
                  )}
                  {isEditMode ? (
                    <span id="ad-cultura-hint" className="form-hint form-hint--locked">
                      🔒 A cultura principal do lote não pode ser alterada após a publicação.
                    </span>
                  ) : (
                    <span id="ad-cultura-hint" className="form-hint">
                      Escolha entre Café, Soja, Milho, Trigo ou selecione Outro para culturas diversas.
                    </span>
                  )}
                </div>

                {cultura === "OUTRO" ? (
                  <div className="form-group">
                    <div className="ad-raca-custom-header">
                      <label htmlFor="ad-cultura-custom" className="form-label">
                        Qual é a Cultura ou Grão? <span className="required">*</span>
                      </label>
                      <span className="ad-char-counter" aria-live="polite">
                        {culturaPersonalizada.length}/30
                      </span>
                    </div>
                    <input
                      id="ad-cultura-custom"
                      type="text"
                      className={`form-input ${erros.culturaPersonalizada ? "form-input--error" : ""} ${isEditMode ? "form-input--disabled" : ""}`}
                      placeholder="Ex: Sorgo Granífero, Feijão Carioca, Aveia"
                      value={culturaPersonalizada}
                      disabled={isEditMode}
                      onChange={(e) => {
                        if (isEditMode) return;
                        setCulturaPersonalizada(e.target.value);
                        if (erros.culturaPersonalizada) {
                          setErros((prev) => ({ ...prev, culturaPersonalizada: "" }));
                        }
                      }}
                      maxLength={30}
                      aria-invalid={Boolean(erros.culturaPersonalizada)}
                      aria-describedby={erros.culturaPersonalizada ? "ad-cultura-custom-error" : undefined}
                      required
                    />
                    {erros.culturaPersonalizada && (
                      <span id="ad-cultura-custom-error" className="form-error">
                        {erros.culturaPersonalizada}
                      </span>
                    )}
                    <span className="form-hint">
                      Será exibido com a tag fixa <strong>Outro</strong> seguida do nome informado.
                    </span>
                  </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="ad-subtipo" className="form-label">
                      Tipo / Classificação Comercial <span className="required">*</span>
                    </label>
                    <select
                      id="ad-subtipo"
                      className={`form-select ${erros.subtipo ? "form-select--error" : ""} ${isEditMode ? "form-select--disabled" : ""}`}
                      value={subtipoSelect}
                      disabled={isEditMode || !cultura}
                      onChange={(e) => {
                        if (isEditMode) return;
                        setSubtipoSelect(e.target.value);
                        if (erros.subtipo) {
                          setErros((prev) => ({ ...prev, subtipo: "" }));
                        }
                      }}
                      aria-invalid={Boolean(erros.subtipo)}
                      aria-describedby={erros.subtipo ? "ad-subtipo-error" : undefined}
                      required
                    >
                      <option value="">
                        {cultura
                          ? `Selecione a classificação de ${GRAIN_CROP_LABELS[cultura]}`
                          : "Selecione primeiro a cultura ao lado"}
                      </option>
                      {cultura &&
                        GRAIN_SUBTYPES[cultura].map((sub) => (
                          <option key={sub.value} value={sub.value}>
                            {sub.label}
                          </option>
                        ))}
                    </select>
                    {erros.subtipo && (
                      <span id="ad-subtipo-error" className="form-error">
                        {erros.subtipo}
                      </span>
                    )}

                    {subtipoSelect === "OUTRO" && (
                      <div className="ad-raca-custom-box">
                        <div className="ad-raca-custom-header">
                          <label htmlFor="ad-subtipo-custom" className="form-label">
                            Especifique o Tipo / Classificação <span className="required">*</span>
                          </label>
                          <span className="ad-char-counter" aria-live="polite">
                            {subtipoCustom.length}/30
                          </span>
                        </div>
                        <input
                          id="ad-subtipo-custom"
                          type="text"
                          className={`form-input ${erros.subtipoCustom ? "form-input--error" : ""} ${isEditMode ? "form-input--disabled" : ""}`}
                          disabled={isEditMode}
                          placeholder="Ex: Peneira 17/18 Cereja Descascado"
                          value={subtipoCustom}
                          onChange={(e) => {
                            if (isEditMode) return;
                            setSubtipoCustom(e.target.value);
                            if (erros.subtipoCustom) {
                              setErros((prev) => ({ ...prev, subtipoCustom: "" }));
                            }
                          }}
                          maxLength={30}
                          aria-invalid={Boolean(erros.subtipoCustom)}
                          aria-describedby={erros.subtipoCustom ? "ad-subtipo-custom-error" : undefined}
                          required
                        />
                        {erros.subtipoCustom && (
                          <span id="ad-subtipo-custom-error" className="form-error">
                            {erros.subtipoCustom}
                          </span>
                        )}
                      </div>
                    )}

                    {isEditMode && (
                      <span className="form-hint form-hint--locked">
                        🔒 O tipo e classificação comercial do lote não podem ser alterados após a publicação.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Prévia das 2 Tags do Card */}
              {cultura && (
                <div className="ad-tags-preview-bar" aria-live="polite">
                  <span className="ad-tags-preview-bar__label">Tags geradas no card do anúncio:</span>
                  <div className="ad-tags-preview-bar__chips">
                    <span className="ad-tag-pill ad-tag-pill--primary">{grainTag1}</span>
                    <span className="ad-tag-pill ad-tag-pill--secondary">{grainTag2}</span>
                  </div>
                </div>
              )}

              {/* Linha 2: Safra de Colheita e Padrão de Armazenamento */}
              <div className="ad-form-grid ad-form-grid--2">
                <div className="form-group">
                  <label htmlFor="ad-safra" className="form-label">
                    Safra de Colheita <span className="required">*</span>
                  </label>
                  <select
                    id="ad-safra"
                    className={`form-select ${erros.safra ? "form-select--error" : ""} ${isEditMode ? "form-select--disabled" : ""}`}
                    disabled={isEditMode}
                    value={safra}
                    onChange={(e) => {
                      if (isEditMode) return;
                      setSafra(e.target.value);
                    }}
                    required
                  >
                    {GRAIN_HARVEST_SEASONS.map((season) => (
                      <option key={season} value={season}>
                        Safra {season}
                      </option>
                    ))}
                  </select>
                  {erros.safra && (
                    <span id="ad-safra-error" className="form-error">
                      {erros.safra}
                    </span>
                  )}
                  {isEditMode && (
                    <span className="form-hint form-hint--locked">
                      🔒 A safra de colheita não pode ser alterada após a publicação. Para outra colheita, publique um novo lote.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="ad-embalagem" className="form-label">
                    Armazenamento / Embalagem <span className="required">*</span>
                  </label>
                  <select
                    id="ad-embalagem"
                    className={`form-select ${erros.embalagem ? "form-select--error" : ""}`}
                    value={embalagem}
                    onChange={(e) => setEmbalagem(e.target.value as GrainPackaging)}
                    required
                  >
                    {GRAIN_PACKAGING_OPTIONS.map((pack) => (
                      <option key={pack.value} value={pack.value}>
                        {pack.label}
                      </option>
                    ))}
                  </select>
                  {erros.embalagem && (
                    <span id="ad-embalagem-error" className="form-error">
                      {erros.embalagem}
                    </span>
                  )}
                </div>
              </div>

              {/* Linha 3: Bloco de Laudo Técnico e Qualidade Física (US-011) */}
              <div className="ad-quality-block" aria-labelledby="heading-laudo-tecnico-form">
                <div className="ad-quality-block__header">
                  <h3 id="heading-laudo-tecnico-form" className="ad-quality-block__title">
                    <Icon name="leaf" /> Laudo Técnico e Qualidade Agronômica {cultura ? `— ${GRAIN_CROP_LABELS[cultura]}` : ""}
                  </h3>
                  <p className="ad-quality-block__subtitle">
                    Parâmetros oficiais (MAPA, CONAB, ANEC e CECAFÉ). Campos com asterisco (<span className="required">*</span>) são de aferição direta na balança da fazenda; parâmetros de análise laboratorial são opcionais e podem ser deixados em branco.
                  </p>
                </div>

                {!cultura ? (
                  <div className="ad-quality-notice">
                    <Icon name="leaf" />
                    <span>Selecione a cultura principal no primeiro menu para carregar os parâmetros oficiais de qualidade física e classificação.</span>
                  </div>
                ) : (
                  <div className="ad-quality-content">
                    {/* Umidade: Obrigatória para todas as culturas */}
                    <div className="ad-form-grid ad-form-grid--2">
                      <div className="form-group">
                        <label htmlFor="ad-umidade" className="form-label">
                          Umidade Estimada <span className="required">*</span>
                        </label>
                        <div className="ad-input-with-unit">
                          <input
                            id="ad-umidade"
                            type="number"
                            min={1}
                            max={50}
                            step={0.1}
                            className={`form-input ${erros.umidade ? "form-input--error" : ""}`}
                            placeholder={
                              cultura === "CAFE"
                                ? "Ex: 11.5"
                                : cultura === "TRIGO"
                                ? "Ex: 12.5"
                                : "Ex: 13.5"
                            }
                            value={umidadePercentual}
                            onChange={(e) => {
                              setUmidadePercentual(e.target.value === "" ? "" : Number(e.target.value));
                              if (erros.umidade) {
                                setErros((prev) => ({ ...prev, umidade: "" }));
                              }
                            }}
                            aria-invalid={Boolean(erros.umidade)}
                            aria-describedby={erros.umidade ? "ad-umidade-error" : "ad-umidade-hint"}
                            required
                          />
                          <span className="ad-input-unit">%</span>
                        </div>
                        {erros.umidade && (
                          <span id="ad-umidade-error" className="form-error">
                            {erros.umidade}
                          </span>
                        )}
                        <span id="ad-umidade-hint" className="form-hint">
                          {cultura === "CAFE"
                            ? "Padrão de mercado entre 11% e 12,5%."
                            : cultura === "TRIGO"
                            ? "Máximo comercial tolerado de 13%."
                            : "Base comercial padrão máxima de 14%."}
                        </span>
                      </div>
                    </div>

                    {/* Especificações de Qualidade: Soja */}
                    {cultura === "SOJA" && (
                      <div className="ad-form-grid ad-form-grid--3">
                        <div className="form-group">
                          <label htmlFor="ad-soja-impurezas" className="form-label">
                            Impurezas e Matérias Estranhas <span className="form-label__optional">(opcional)</span>
                          </label>
                          <div className="ad-input-with-unit">
                            <input
                              id="ad-soja-impurezas"
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              className="form-input"
                              placeholder="Ex: máx. 1%"
                              value={sojaImpurezasPct}
                              onChange={(e) =>
                                setSojaImpurezasPct(e.target.value === "" ? "" : Number(e.target.value))
                              }
                            />
                            <span className="ad-input-unit">%</span>
                          </div>
                          <span className="form-hint">Tolerância padrão de até 1%.</span>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ad-soja-avariados" className="form-label">
                            Grãos Avariados Totais <span className="form-label__optional">(opcional)</span>
                          </label>
                          <div className="ad-input-with-unit">
                            <input
                              id="ad-soja-avariados"
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              className="form-input"
                              placeholder="Ex: máx. 8%"
                              value={sojaAvariadosPct}
                              onChange={(e) =>
                                setSojaAvariadosPct(e.target.value === "" ? "" : Number(e.target.value))
                              }
                            />
                            <span className="ad-input-unit">%</span>
                          </div>
                          <span className="form-hint">Padrão ANEC máx. 8% (ardidos/mofados).</span>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ad-soja-quebrados" className="form-label">
                            Grãos Quebrados <span className="form-label__optional">(opcional)</span>
                          </label>
                          <div className="ad-input-with-unit">
                            <input
                              id="ad-soja-quebrados"
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              className="form-input"
                              placeholder="Ex: até 15%"
                              value={sojaQuebradosPct}
                              onChange={(e) =>
                                setSojaQuebradosPct(e.target.value === "" ? "" : Number(e.target.value))
                              }
                            />
                            <span className="ad-input-unit">%</span>
                          </div>
                          <span className="form-hint">Tolerância de grãos quebrados.</span>
                        </div>
                      </div>
                    )}

                    {/* Especificações de Qualidade: Milho */}
                    {cultura === "MILHO" && (
                      <div className="ad-form-grid ad-form-grid--3">
                        <div className="form-group">
                          <label htmlFor="ad-milho-impurezas" className="form-label">
                            Impurezas e Fragmentos <span className="form-label__optional">(opcional)</span>
                          </label>
                          <div className="ad-input-with-unit">
                            <input
                              id="ad-milho-impurezas"
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              className="form-input"
                              placeholder="Ex: máx. 1%"
                              value={milhoImpurezasPct}
                              onChange={(e) =>
                                setMilhoImpurezasPct(e.target.value === "" ? "" : Number(e.target.value))
                              }
                            />
                            <span className="ad-input-unit">%</span>
                          </div>
                          <span className="form-hint">Padrão Tipo 1 (máx. 1%).</span>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ad-milho-ardidos" className="form-label">
                            Grãos Ardidos <span className="form-label__optional">(opcional)</span>
                          </label>
                          <div className="ad-input-with-unit">
                            <input
                              id="ad-milho-ardidos"
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              className="form-input"
                              placeholder="Ex: máx. 2%"
                              value={milhoArdidosPct}
                              onChange={(e) =>
                                setMilhoArdidosPct(e.target.value === "" ? "" : Number(e.target.value))
                              }
                            />
                            <span className="ad-input-unit">%</span>
                          </div>
                          <span className="form-hint">Nutrição animal (Tipo 1: 1%, Tipo 2: 3%).</span>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ad-milho-quebrados" className="form-label">
                            Grãos Quebrados <span className="form-label__optional">(opcional)</span>
                          </label>
                          <div className="ad-input-with-unit">
                            <input
                              id="ad-milho-quebrados"
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              className="form-input"
                              placeholder="Ex: até 3%"
                              value={milhoQuebradosPct}
                              onChange={(e) =>
                                setMilhoQuebradosPct(e.target.value === "" ? "" : Number(e.target.value))
                              }
                            />
                            <span className="ad-input-unit">%</span>
                          </div>
                          <span className="form-hint">Tolerância padrão de até 3%.</span>
                        </div>
                      </div>
                    )}

                    {/* Especificações de Qualidade: Café */}
                    {cultura === "CAFE" && (
                      <div className="ad-form-grid ad-form-grid--3">
                        <div className="form-group">
                          <label htmlFor="ad-cafe-peneira" className="form-label">
                            Peneira Predominante <span className="required">*</span>
                          </label>
                          <select
                            id="ad-cafe-peneira"
                            className={`form-select ${erros.cafePeneira ? "form-select--error" : ""}`}
                            value={cafePeneira}
                            onChange={(e) => {
                              setCafePeneira(e.target.value as CoffeeScreen);
                              if (erros.cafePeneira) {
                                setErros((prev) => ({ ...prev, cafePeneira: "" }));
                              }
                            }}
                            aria-invalid={Boolean(erros.cafePeneira)}
                            aria-describedby={erros.cafePeneira ? "ad-cafe-peneira-error" : undefined}
                            required
                          >
                            <option value="">Selecione a peneira</option>
                            {COFFEE_SCREEN_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {erros.cafePeneira && (
                            <span id="ad-cafe-peneira-error" className="form-error">
                              {erros.cafePeneira}
                            </span>
                          )}
                          <span className="form-hint">Granulometria física do lote.</span>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ad-cafe-catacao" className="form-label">
                            Catação / Defeitos <span className="form-label__optional">(opcional)</span>
                          </label>
                          <input
                            id="ad-cafe-catacao"
                            type="text"
                            maxLength={30}
                            className="form-input"
                            placeholder="Ex: 12% ou Tipo 4"
                            value={cafeCatacaoDefeitos}
                            onChange={(e) => setCafeCatacaoDefeitos(e.target.value)}
                          />
                          <span className="form-hint">Percentual de catação ou contagem COB.</span>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ad-cafe-sca" className="form-label">
                            Pontuação SCA <span className="form-label__optional">(opcional, 80-100 pts)</span>
                          </label>
                          <input
                            id="ad-cafe-sca"
                            type="number"
                            min={80}
                            max={100}
                            step={0.5}
                            className={`form-input ${erros.cafePontuacao ? "form-input--error" : ""}`}
                            placeholder="Ex: 84"
                            value={cafePontuacaoSca}
                            onChange={(e) => {
                              setCafePontuacaoSca(e.target.value === "" ? "" : Number(e.target.value));
                              if (erros.cafePontuacao) {
                                setErros((prev) => ({ ...prev, cafePontuacao: "" }));
                              }
                            }}
                            aria-invalid={Boolean(erros.cafePontuacao)}
                            aria-describedby={erros.cafePontuacao ? "ad-cafe-sca-error" : undefined}
                          />
                          {erros.cafePontuacao && (
                            <span id="ad-cafe-sca-error" className="form-error">
                              {erros.cafePontuacao}
                            </span>
                          )}
                          <span className="form-hint">Cafés especiais (SCA ≥ 80 pts).</span>
                        </div>
                      </div>
                    )}

                    {/* Especificações de Qualidade: Trigo */}
                    {cultura === "TRIGO" && (
                      <div className="ad-form-grid ad-form-grid--3">
                        <div className="form-group">
                          <label htmlFor="ad-trigo-ph" className="form-label">
                            PH / Peso Hectolítrico <span className="required">*</span>
                          </label>
                          <div className="ad-input-with-unit">
                            <input
                              id="ad-trigo-ph"
                              type="number"
                              min={50}
                              max={100}
                              step={0.5}
                              className={`form-input ${erros.trigoPh ? "form-input--error" : ""}`}
                              placeholder="Ex: 78"
                              value={trigoPhKgHl}
                              onChange={(e) => {
                                setTrigoPhKgHl(e.target.value === "" ? "" : Number(e.target.value));
                                if (erros.trigoPh) {
                                  setErros((prev) => ({ ...prev, trigoPh: "" }));
                                }
                              }}
                              aria-invalid={Boolean(erros.trigoPh)}
                              aria-describedby={erros.trigoPh ? "ad-trigo-ph-error" : undefined}
                              required
                            />
                            <span className="ad-input-unit">kg/hL</span>
                          </div>
                          {erros.trigoPh && (
                            <span id="ad-trigo-ph-error" className="form-error">
                              {erros.trigoPh}
                            </span>
                          )}
                          <span className="form-hint">Densidade volumétrica (Tipo 1: ≥ 78).</span>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ad-trigo-gluten" className="form-label">
                            Força de Glúten (W) <span className="form-label__optional">(opcional)</span>
                          </label>
                          <input
                            id="ad-trigo-gluten"
                            type="number"
                            min={50}
                            max={500}
                            step={1}
                            className="form-input"
                            placeholder="Ex: 240 ou 300"
                            value={trigoForcaGlutenW}
                            onChange={(e) =>
                              setTrigoForcaGlutenW(e.target.value === "" ? "" : Number(e.target.value))
                            }
                          />
                          <span className="form-hint">Alveografia (Trigo Pão W ≥ 220).</span>
                        </div>

                        <div className="form-group">
                          <label htmlFor="ad-trigo-fn" className="form-label">
                            Falling Number (FN) <span className="form-label__optional">(opcional)</span>
                          </label>
                          <div className="ad-input-with-unit">
                            <input
                              id="ad-trigo-fn"
                              type="number"
                              min={60}
                              max={600}
                              step={1}
                              className="form-input"
                              placeholder="Ex: 280"
                              value={trigoFallingNumberSeg}
                              onChange={(e) =>
                                setTrigoFallingNumberSeg(e.target.value === "" ? "" : Number(e.target.value))
                              }
                            />
                            <span className="ad-input-unit">s</span>
                          </div>
                          <span className="form-hint">Atividade enzimática (padrão ≥ 250 s).</span>
                        </div>
                      </div>
                    )}

                    {/* Especificações de Qualidade: Outro */}
                    {cultura === "OUTRO" && (
                      <div className="form-group">
                        <label htmlFor="ad-outro-obs" className="form-label">
                          Observações Técnicas do Laudo <span className="form-label__optional">(opcional, máx. 60 caracteres)</span>
                        </label>
                        <input
                          id="ad-outro-obs"
                          type="text"
                          maxLength={60}
                          className="form-input"
                          placeholder="Ex: Grão limpo em silo próprio, peneira 12..."
                          value={outroObservacoesLaudo}
                          onChange={(e) => setOutroObservacoesLaudo(e.target.value)}
                        />
                        <span className="form-hint">
                          Detalhe o padrão de secagem, pureza ou beneficiamento do lote alternativo.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Linha 3: Conversão Bi-direcional de Volume (Sacas <-> Toneladas) */}
              <div className="ad-weight-block">
                <div className="ad-weight-header">
                  <div>
                    <label htmlFor="ad-volume" className="form-label">
                      Volume Total do Lote <span className="required">*</span>
                    </label>
                    <span className="ad-weight-subtext">
                      {volumeUnitMode === "SACAS"
                        ? "Digitando em Sacas (60 kg): o sistema calcula automaticamente o peso em Toneladas (ton)"
                        : "Digitando em Toneladas (ton): o sistema calcula automaticamente o equivalente em Sacas de 60 kg"}
                    </span>
                  </div>

                  <div className="ad-weight-unit-toggle" role="group" aria-label="Unidade de entrada de volume">
                    <button
                      type="button"
                      className={`ad-unit-btn ${volumeUnitMode === "SACAS" ? "ad-unit-btn--active" : ""}`}
                      onClick={() => handleToggleVolumeUnit("SACAS")}
                    >
                      Sacas (60 kg)
                    </button>
                    <button
                      type="button"
                      className={`ad-unit-btn ${volumeUnitMode === "TONELADAS" ? "ad-unit-btn--active" : ""}`}
                      onClick={() => handleToggleVolumeUnit("TONELADAS")}
                    >
                      Toneladas (ton)
                    </button>
                  </div>
                </div>

                <div className="ad-input-with-unit">
                  <input
                    id="ad-volume"
                    type="number"
                    min={volumeUnitMode === "SACAS" ? 1 : 0.1}
                    max={volumeUnitMode === "SACAS" ? 500000 : 30000}
                    step={volumeUnitMode === "SACAS" ? 10 : 0.5}
                    className={`form-input ${erros.volume ? "form-input--error" : ""}`}
                    placeholder={volumeUnitMode === "SACAS" ? "Ex: 500" : "Ex: 30"}
                    value={volumeInputValue}
                    onChange={(e) => {
                      setVolumeInputValue(e.target.value === "" ? "" : Number(e.target.value));
                      if (erros.volume) {
                        setErros((prev) => ({ ...prev, volume: "" }));
                      }
                    }}
                    aria-invalid={Boolean(erros.volume)}
                    aria-describedby={erros.volume ? "ad-volume-error" : undefined}
                    required
                  />
                  <span className="ad-input-unit">
                    {volumeUnitMode === "SACAS" ? "sacas de 60 kg" : "toneladas (1.000 kg)"}
                  </span>
                </div>
                {erros.volume && (
                  <span id="ad-volume-error" className="form-error">
                    {erros.volume}
                  </span>
                )}

                {typeof volumeInputValue === "number" && volumeInputValue > 0 && (
                  <div className="ad-weight-helper">
                    <Icon name="leaf" />
                    <span>
                      {volumeUnitMode === "SACAS" ? (
                        <>
                          Conversão comercial: <strong>{toneladasGraosCalculadas.toLocaleString("pt-BR")} toneladas</strong> ({kgGraosCalculados.toLocaleString("pt-BR")} kg totais)
                        </>
                      ) : (
                        <>
                          Conversão comercial: <strong>{sacasCalculadas.toLocaleString("pt-BR")} sacas de 60 kg</strong> ({kgGraosCalculados.toLocaleString("pt-BR")} kg totais)
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Linha 4: Painel Resumo da Safra */}
              {sacasCalculadas > 0 ? (
                <div className="ad-metric-panel" aria-live="polite">
                  <div className="ad-metric-item">
                    <span className="ad-metric-label">Volume em Sacas (60 kg)</span>
                    <strong className="ad-metric-value">
                      {sacasCalculadas.toLocaleString("pt-BR")} sacas
                    </strong>
                  </div>
                  <div className="ad-metric-item">
                    <span className="ad-metric-label">Peso Total da Carga</span>
                    <strong className="ad-metric-value">
                      {toneladasGraosCalculadas.toLocaleString("pt-BR")} ton{" "}
                      <span className="ad-metric-sub">
                        ({kgGraosCalculados.toLocaleString("pt-BR")} kg)
                      </span>
                    </strong>
                  </div>
                  <div className="ad-metric-item">
                    <span className="ad-metric-label">Safra / Armazenamento</span>
                    <strong className="ad-metric-value">
                      {safra}{" "}
                      <span className="ad-metric-sub">· {GRAIN_PACKAGING_LABELS[embalagem]}</span>
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="ad-metric-panel ad-metric-panel--empty">
                  <Icon name="leaf" />
                  <p>Informe o volume em sacas ou toneladas para visualizar o resumo da carga agrícola.</p>
                </div>
              )}
            </section>
          )}

          {/* BLOCO 3: Fotos e Vídeo do Lote (US-012) */}
          <section className="ad-form-section" aria-labelledby="section-midia">
            <h2 id="section-midia" className="ad-form-section__title">
              <Icon name="camera" /> 3. Fotos e Vídeo do Lote
            </h2>
            <p className="ad-form-section__desc">
              Anúncios com fotos reais e vídeo atraem até 4x mais visualizações e facilitam a decisão de compra sem intermediários.
            </p>

            {/* A. Fotos do Lote */}
            <div className="ad-media-block">
              <div className="ad-media-header">
                <div>
                  <h3 className="ad-media-heading">Fotos do Lote (Até 6 fotos)</h3>
                  <span className="ad-media-counter">
                    Fotos adicionadas: {fotos.length}/6
                  </span>
                </div>
                {fotos.length < 6 && (
                  <button
                    type="button"
                    className="button button--outline button--small"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon name="upload" /> Adicionar Fotos
                  </button>
                )}
              </div>

              {/* Dropzone */}
              <div
                className={`ad-media-dropzone ${isDraggingOver ? "ad-media-dropzone--active" : ""} ${fotos.length >= 6 ? "ad-media-dropzone--disabled" : ""}`}
                onClick={() => {
                  if (fotos.length < 6) fileInputRef.current?.click();
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                aria-label="Área de envio de fotos do anúncio"
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && fotos.length < 6) {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={fotos.length >= 6}
                />
                <div className="ad-media-dropzone__content">
                  <div className="ad-media-dropzone__icon">
                    <Icon name="camera" />
                  </div>
                  <strong className="ad-media-dropzone__title">
                    {fotos.length >= 6
                      ? "Limite máximo de 6 fotos atingido"
                      : "Arraste fotos do lote aqui ou clique para selecionar"}
                  </strong>
                  <span className="ad-media-dropzone__hint">
                    Formatos aceitos: JPEG, PNG ou WebP (máximo 10MB por foto).
                  </span>
                </div>
              </div>

              {fotoError && (
                <p className="ad-field-error" role="alert">
                  <Icon name="clock" /> {fotoError}
                </p>
              )}

              {/* Grade de Miniaturas */}
              {fotos.length > 0 && (
                <div className="ad-media-thumbnails" aria-label="Miniaturas das fotos adicionadas">
                  {fotos.map((foto, index) => (
                    <div key={index} className="ad-media-thumb">
                      <img src={foto} alt={`Foto ${index + 1} do lote`} />
                      {index === 0 ? (
                        <span className="ad-media-badge-cover">
                          <Icon name="star" /> Capa
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="ad-media-btn-cover"
                          onClick={() => definirComoCapa(index)}
                          title="Definir esta foto como capa do anúncio"
                        >
                          Definir Capa
                        </button>
                      )}
                      <button
                        type="button"
                        className="ad-media-btn-remove"
                        onClick={() => removerFoto(index)}
                        title="Remover esta foto"
                        aria-label={`Remover foto ${index + 1}`}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* B. Vídeo Demonstrativo */}
            <div className="ad-media-block ad-media-block--video">
              <div className="ad-media-header">
                <div>
                  <h3 className="ad-media-heading">Vídeo Demonstrativo (Opcional - 1 vídeo)</h3>
                  <span className="ad-media-counter">
                    Mostre a dinâmica do lote, movimentação, pastagem ou padrão dos grãos
                  </span>
                </div>
              </div>

              {/* Abas de Modo de Vídeo */}
              <div className="ad-media-video-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={videoMode === "UPLOAD"}
                  className={`ad-media-tab ${videoMode === "UPLOAD" ? "ad-media-tab--active" : ""}`}
                  onClick={() => setVideoMode("UPLOAD")}
                >
                  <Icon name="video" /> Arquivo de Vídeo (.mp4, .mov)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={videoMode === "YOUTUBE"}
                  className={`ad-media-tab ${videoMode === "YOUTUBE" ? "ad-media-tab--active" : ""}`}
                  onClick={() => setVideoMode("YOUTUBE")}
                >
                  <Icon name="youtube" /> Link do YouTube
                </button>
              </div>

              {videoMode === "UPLOAD" ? (
                <div className="ad-media-video-content">
                  {videoUploadUrl ? (
                    <div className="ad-media-video-preview-wrap">
                      <video
                        src={videoUploadUrl}
                        controls
                        playsInline
                        className="ad-media-video-player"
                      />
                      <div className="ad-media-video-actions">
                        <span className="ad-media-video-filename">
                          <Icon name="video" /> {videoUploadName || "Vídeo do lote"}
                        </span>
                        <button
                          type="button"
                          className="button button--outline button--small button--danger"
                          onClick={removerVideoArquivo}
                        >
                          <Icon name="trash" /> Remover Vídeo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="ad-media-video-uploader">
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                        className="sr-only"
                        onChange={handleVideoFileChange}
                      />
                      <button
                        type="button"
                        className="button button--outline"
                        onClick={() => videoInputRef.current?.click()}
                      >
                        <Icon name="upload" /> Selecionar Arquivo de Vídeo
                      </button>
                      <span className="ad-media-dropzone__hint">
                        Formatos aceitos: MP4, MOV ou WebM (tamanho máximo: 30MB).
                      </span>
                    </div>
                  )}
                  {videoError && (
                    <p className="ad-field-error" role="alert">
                      <Icon name="clock" /> {videoError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="ad-media-video-content">
                  <div className="form-group">
                    <label htmlFor="ad-video-youtube-url" className="form-label">
                      URL do Vídeo no YouTube
                    </label>
                    <input
                      id="ad-video-youtube-url"
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                      className="form-input"
                      value={videoYoutubeUrl}
                      onChange={(e) => setVideoYoutubeUrl(e.target.value)}
                    />
                    <span className="form-hint">
                      Cole o link de um vídeo público ou não listado do YouTube.
                    </span>
                  </div>

                  {/* Preview YouTube */}
                  {extrairYoutubeId(videoYoutubeUrl) ? (
                    <div className="ad-media-youtube-preview">
                      <iframe
                        src={obterYoutubeEmbedUrl(videoYoutubeUrl)!}
                        title="Pré-visualização do vídeo do YouTube"
                        className="ad-media-youtube-iframe"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                      <div className="ad-media-video-actions">
                        <button
                          type="button"
                          className="button button--outline button--small button--danger"
                          onClick={() => setVideoYoutubeUrl("")}
                        >
                          <Icon name="trash" /> Limpar Link
                        </button>
                      </div>
                    </div>
                  ) : videoYoutubeUrl.trim() ? (
                    <p className="ad-field-warning">
                      Link do YouTube não reconhecido. Certifique-se de usar um link no formato youtube.com/watch?v=... ou youtu.be/...
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          {/* BLOCO 4: Documentação Comprobatória do Lote (US-013) */}
          <AdDocumentsSection
            documentos={documentos}
            onChangeDocumentos={setDocumentos}
            modalidade={modalidade}
            anuncioId={id}
          />

          {/* BLOCO 5: Precificação e Localização */}
          <section className="ad-form-section" aria-labelledby="section-preco">
            <h2 id="section-preco" className="ad-form-section__title">
              <Icon name="location" /> 5. Precificação Comercial e Localização
            </h2>

            {modalidade === "ANIMAL" ? (
              <>
                <div className="form-group">
                  <span className="form-label">Como deseja definir o valor?</span>
                  <div className="ad-pricing-tabs" role="radiogroup" aria-label="Modo de precificação">
                    <label className={`ad-pricing-tab ${pricingMode === "TOTAL" ? "ad-pricing-tab--active" : ""}`}>
                      <input
                        type="radio"
                        name="pricingMode"
                        value="TOTAL"
                        checked={pricingMode === "TOTAL"}
                        onChange={() => setPricingMode("TOTAL")}
                        className="sr-only"
                      />
                      <span>Preço Total do Lote (R$)</span>
                    </label>
                    <label className={`ad-pricing-tab ${pricingMode === "PER_HEAD" ? "ad-pricing-tab--active" : ""}`}>
                      <input
                        type="radio"
                        name="pricingMode"
                        value="PER_HEAD"
                        checked={pricingMode === "PER_HEAD"}
                        onChange={() => setPricingMode("PER_HEAD")}
                        className="sr-only"
                      />
                      <span>Calcular por Cabeça (R$)</span>
                    </label>
                  </div>
                </div>

                {pricingMode === "TOTAL" ? (
                  <div className="form-group">
                    <label htmlFor="ad-preco-total" className="form-label">
                      Valor Total do Lote (R$) <span className="required">*</span>
                    </label>
                    <div className="ad-input-with-unit">
                      <span className="ad-input-prefix">R$</span>
                      <input
                        id="ad-preco-total"
                        type="number"
                        min={100}
                        step={100}
                        className={`form-input ${erros.precoTotal ? "form-input--error" : ""}`}
                        placeholder="Ex: 240000"
                        value={precoTotal}
                        onChange={(e) => setPrecoTotal(e.target.value === "" ? "" : Number(e.target.value))}
                        aria-invalid={Boolean(erros.precoTotal)}
                        aria-describedby={erros.precoTotal ? "ad-preco-total-error" : undefined}
                        required
                      />
                    </div>
                    {erros.precoTotal && (
                      <span id="ad-preco-total-error" className="form-error">
                        {erros.precoTotal}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="ad-preco-cabeca" className="form-label">
                      Valor Unitário por Cabeça (R$) <span className="required">*</span>
                    </label>
                    <div className="ad-input-with-unit">
                      <span className="ad-input-prefix">R$</span>
                      <input
                        id="ad-preco-cabeca"
                        type="number"
                        min={100}
                        step={50}
                        className={`form-input ${erros.precoPorCabeca ? "form-input--error" : ""}`}
                        placeholder="Ex: 3000"
                        value={precoPorCabeca}
                        onChange={(e) => setPrecoPorCabeca(e.target.value === "" ? "" : Number(e.target.value))}
                        aria-invalid={Boolean(erros.precoPorCabeca)}
                        aria-describedby={erros.precoPorCabeca ? "ad-preco-cabeca-error" : undefined}
                        required
                      />
                    </div>
                    {erros.precoPorCabeca && (
                      <span id="ad-preco-cabeca-error" className="form-error">
                        {erros.precoPorCabeca}
                      </span>
                    )}
                  </div>
                )}

                {/* Resumo Financeiro Dinâmico (Boi Gordo) */}
                <div className="ad-pricing-summary" aria-live="polite">
                  <div className="ad-pricing-summary__total">
                    <span>Valor Total da Carga</span>
                    <strong>
                      {valorTotalFinal > 0
                        ? valorTotalFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "—"}
                    </strong>
                  </div>
                  <div className="ad-pricing-summary__breakdown">
                    <div>
                      <span>Preço por Cabeça</span>
                      <strong>
                        {valorCabecaFinal > 0
                          ? valorCabecaFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Preço por Arroba (@)</span>
                      <strong>
                        {valorArrobaFinal > 0
                          ? valorArrobaFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : "—"}
                      </strong>
                    </div>
                  </div>
                  {valorTotalFinal === 0 && (
                    <p className="ad-pricing-summary__hint">
                      Preencha o valor do lote para visualizar as conversões por cabeça e arroba.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <span className="form-label">Como deseja precificar a safra?</span>
                  <div className="ad-pricing-tabs" role="radiogroup" aria-label="Modo de precificação agrícola">
                    <label className={`ad-pricing-tab ${grainPricingMode === "TOTAL" ? "ad-pricing-tab--active" : ""}`}>
                      <input
                        type="radio"
                        name="grainPricingMode"
                        value="TOTAL"
                        checked={grainPricingMode === "TOTAL"}
                        onChange={() => setGrainPricingMode("TOTAL")}
                        className="sr-only"
                      />
                      <span>Preço Total do Lote (R$)</span>
                    </label>
                    <label className={`ad-pricing-tab ${grainPricingMode === "PER_SACK" ? "ad-pricing-tab--active" : ""}`}>
                      <input
                        type="radio"
                        name="grainPricingMode"
                        value="PER_SACK"
                        checked={grainPricingMode === "PER_SACK"}
                        onChange={() => setGrainPricingMode("PER_SACK")}
                        className="sr-only"
                      />
                      <span>Calcular por Saca de 60 kg (R$/sc)</span>
                    </label>
                  </div>
                </div>

                {grainPricingMode === "TOTAL" ? (
                  <div className="form-group">
                    <label htmlFor="ad-preco-total-graos" className="form-label">
                      Valor Total do Lote Agrícola (R$) <span className="required">*</span>
                    </label>
                    <div className="ad-input-with-unit">
                      <span className="ad-input-prefix">R$</span>
                      <input
                        id="ad-preco-total-graos"
                        type="number"
                        min={50}
                        step={100}
                        className={`form-input ${erros.precoTotalGraos ? "form-input--error" : ""}`}
                        placeholder="Ex: 750000"
                        value={precoTotalGraos}
                        onChange={(e) => {
                          setPrecoTotalGraos(e.target.value === "" ? "" : Number(e.target.value));
                          if (erros.precoTotalGraos) {
                            setErros((prev) => ({ ...prev, precoTotalGraos: "" }));
                          }
                        }}
                        aria-invalid={Boolean(erros.precoTotalGraos)}
                        aria-describedby={erros.precoTotalGraos ? "ad-preco-total-graos-error" : undefined}
                        required
                      />
                    </div>
                    {erros.precoTotalGraos && (
                      <span id="ad-preco-total-graos-error" className="form-error">
                        {erros.precoTotalGraos}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="ad-preco-saca" className="form-label">
                      Valor Unitário por Saca de 60 kg (R$/sc) <span className="required">*</span>
                    </label>
                    <div className="ad-input-with-unit">
                      <span className="ad-input-prefix">R$</span>
                      <input
                        id="ad-preco-saca"
                        type="number"
                        min={10}
                        step={5}
                        className={`form-input ${erros.precoPorSaca ? "form-input--error" : ""}`}
                        placeholder="Ex: 1500"
                        value={precoPorSaca}
                        onChange={(e) => {
                          setPrecoPorSaca(e.target.value === "" ? "" : Number(e.target.value));
                          if (erros.precoPorSaca) {
                            setErros((prev) => ({ ...prev, precoPorSaca: "" }));
                          }
                        }}
                        aria-invalid={Boolean(erros.precoPorSaca)}
                        aria-describedby={erros.precoPorSaca ? "ad-preco-saca-error" : undefined}
                        required
                      />
                    </div>
                    {erros.precoPorSaca && (
                      <span id="ad-preco-saca-error" className="form-error">
                        {erros.precoPorSaca}
                      </span>
                    )}
                  </div>
                )}

                {/* Resumo Financeiro Dinâmico (Grãos e Café) */}
                <div className="ad-pricing-summary" aria-live="polite">
                  <div className="ad-pricing-summary__total">
                    <span>Valor Total do Lote</span>
                    <strong>
                      {valorTotalGraosFinal > 0
                        ? valorTotalGraosFinal.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : "—"}
                    </strong>
                  </div>
                  <div className="ad-pricing-summary__breakdown">
                    <div>
                      <span>Preço por Saca (60 kg)</span>
                      <strong>
                        {valorSacaFinal > 0
                          ? valorSacaFinal.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Equivalente por Tonelada</span>
                      <strong>
                        {valorToneladaFinal > 0
                          ? valorToneladaFinal.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "—"}
                      </strong>
                    </div>
                  </div>
                  {valorTotalGraosFinal === 0 && (
                    <p className="ad-pricing-summary__hint">
                      Preencha o volume e o valor para visualizar o cálculo automático por saca e por tonelada.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Localização */}
            <div className="ad-form-grid ad-form-grid--2">
              <div className="form-group">
                <label htmlFor="ad-cidade" className="form-label">
                  {modalidade === "ANIMAL"
                    ? "Município de Retirada"
                    : "Município de Retirada / Armazém"}{" "}
                  <span className="required">*</span>
                </label>
                <input
                  id="ad-cidade"
                  type="text"
                  className={`form-input ${erros.cidade ? "form-input--error" : ""}`}
                  placeholder={
                    modalidade === "ANIMAL"
                      ? "Ex: Uberaba ou Barretos"
                      : "Ex: Patrocínio, Rio Verde ou Sorriso"
                  }
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  aria-invalid={Boolean(erros.cidade)}
                  aria-describedby={erros.cidade ? "ad-cidade-error" : undefined}
                  required
                />
                {erros.cidade && (
                  <span id="ad-cidade-error" className="form-error">
                    {erros.cidade}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="ad-uf" className="form-label">
                  Estado (UF) <span className="required">*</span>
                </label>
                <select
                  id="ad-uf"
                  className={`form-select ${erros.uf ? "form-select--error" : ""}`}
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  aria-invalid={Boolean(erros.uf)}
                  aria-describedby={erros.uf ? "ad-uf-error" : undefined}
                  required
                >
                  <option value="">Selecione o estado</option>
                  {ufs.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
                {erros.uf && (
                  <span id="ad-uf-error" className="form-error">
                    {erros.uf}
                  </span>
                )}
              </div>
            </div>

            {/* Foto de Capa do Lote */}
            <div className="ad-cover-preview-box">
              <div className="ad-cover-preview-box__thumb">
                <img
                  src={fotos.length > 0 ? fotos[0] : modalidade === "ANIMAL" ? defaultFarmImage : harvestSunsetImage}
                  alt={
                    modalidade === "ANIMAL"
                      ? "Fotografia de pastagem rural da fazenda"
                      : "Fotografia de colheita agrícola"
                  }
                />
                <span className="ad-cover-badge">
                  {modalidade === "ANIMAL"
                    ? `Boi Gordo · ${racaFinal || "Nelore"}`
                    : `${grainTag1} · ${grainTag2}`}
                </span>
              </div>
              <div className="ad-cover-preview-box__info">
                <strong>Foto de Capa do Lote</strong>
                <p>
                  {fotos.length > 0
                    ? "Esta é a foto definida como capa na Seção 3. Ela será exibida em destaque nos cards do mercado e na abertura do anúncio."
                    : modalidade === "ANIMAL"
                    ? "Nenhuma foto personalizada foi enviada na Seção 3. O anúncio utilizará a fotografia campestre padrão da fazenda."
                    : "Nenhuma foto personalizada foi enviada na Seção 3. O anúncio utilizará a fotografia de colheita padrão da categoria."}
                </p>
              </div>
            </div>
          </section>

          {Object.keys(erros).length > 0 && (
            <div className="ad-alert ad-alert--error" role="alert" style={{ marginBottom: "1.5rem" }}>
              {erros.geral || "Existem campos obrigatórios não preenchidos ou com valores pendentes. Verifique as pendências destacadas acima."}
            </div>
          )}

          <div className="ad-form-actions">
            <Link
              to={isEditMode && loadedAd ? routes.adDetail(loadedAd.id) : routes.myAds}
              className="button button--outline"
            >
              Cancelar
            </Link>
            <button type="submit" className="button button--primary button--large" disabled={isSubmitting}>
              {isSubmitting
                ? isEditMode
                  ? "Salvando Alterações..."
                  : "Publicando Lote..."
                : isEditMode
                ? "Salvar Alterações"
                : modalidade === "ANIMAL"
                ? "Publicar Lote de Boi Gordo"
                : "Publicar Lote Agrícola"}
            </button>
          </div>
        </form>

        {/* Modal Comemorativo Pós-Criação */}
        {showSuccessModal && (
          <div className="ad-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="ad-modal-card">
              <div className="ad-modal-icon-wrapper" aria-hidden="true">
                <Icon name="leaf" />
              </div>
              <p className="eyebrow">Publicação Concluída</p>
              <h2 id="modal-title" className="ad-modal-title">
                Lote publicado com sucesso!
              </h2>
              <p className="ad-modal-description">
                {modalidade === "ANIMAL" ? (
                  <>
                    Seu lote de <strong>{quantidadeCabecas} {racaFinal || "bois"}</strong> já está ativo e visível no mercado para compradores, frigoríficos e cooperativas.
                  </>
                ) : (
                  <>
                    Seu lote de{" "}
                    <strong>
                      {sacasCalculadas.toLocaleString("pt-BR")} sacas ({toneladasGraosCalculadas} ton) de {grainTag1} ({grainTag2})
                    </strong>{" "}
                    já está ativo e visível no mercado para compradores, cooperativas e cerealistas.
                  </>
                )}
              </p>
              <div className="ad-modal-actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => navigate(routes.market)}
                >
                  Ver no Mercado
                </button>
                <button
                  type="button"
                  className="button button--outline"
                  onClick={() => navigate(routes.myAds)}
                >
                  Ir para Meus Anúncios
                </button>
                {createdAdId && (
                  <button
                    type="button"
                    className="button button--text"
                    onClick={() => navigate(`/anuncios/${createdAdId}`)}
                  >
                    Visualizar Ficha Técnica do Anúncio
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
