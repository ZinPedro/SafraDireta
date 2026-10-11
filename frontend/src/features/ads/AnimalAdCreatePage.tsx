import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { routes } from "../../data/site";
import type { OpenDevelopmentDialog } from "../../data/site";
import { ufs } from "../corporate-registration/corporateRegistration";
import { AccessRestricted } from "../../components/AccessRestricted";
import { Icon } from "../../components/Icon";
import {
  BEEF_CATTLE_BREEDS,
  BEEF_CATTLE_PURPOSES,
} from "./ads.types";
import type {
  AnimalPurpose,
  CreateAnimalAdInput,
  PricingMode,
} from "./ads.types";
import { criarAnuncioAnimal } from "./adsStorage";
import defaultFarmImage from "../../assets/images/farm-landscape.jpeg";
import "./ads.css";

interface AnimalAdCreatePageProps {
  onOpenDialog?: OpenDevelopmentDialog;
}

export function AnimalAdCreatePage({ onOpenDialog }: AnimalAdCreatePageProps) {
  const { session } = useAuth();
  const navigate = useNavigate();

  // Estados do formulário limpos (sem valores pré-moldados)
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [racaSelect, setRacaSelect] = useState("");
  const [racaCustom, setRacaCustom] = useState("");
  const [quantidadeCabecas, setQuantidadeCabecas] = useState<number | "">("");
  const [finalidade, setFinalidade] = useState<AnimalPurpose>("ENGORDA_ABATE");
  const [idadeMeses, setIdadeMeses] = useState<number | "">("");

  // Mecanismo Bi-direcional de Peso (Kg <-> @)
  const [pesoUnitMode, setPesoUnitMode] = useState<"KG" | "ARROBA">("KG");
  const [pesoInputValue, setPesoInputValue] = useState<number | "">("");

  // Precificação
  const [pricingMode, setPricingMode] = useState<PricingMode>("TOTAL");
  const [precoTotal, setPrecoTotal] = useState<number | "">("");
  const [precoPorCabeca, setPrecoPorCabeca] = useState<number | "">("");

  // Localização
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  // Estados de controle
  const [erros, setErros] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAdId, setCreatedAdId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Guarda de rota (Abordagem B): Vendedor precisa estar habilitado
  if (!session || session.vendedorEstado !== "HABILITADO") {
    return (
      <AccessRestricted
        title="Área de publicação exclusiva para produtores habilitados"
        description="Para anunciar lotes de animais e comercializar com compradores de todo o país, complete sua habilitação de vendedor na sua conta."
        onOpenLogin={() => onOpenDialog?.("login")}
        onOpenRegister={() => onOpenDialog?.("registration")}
      />
    );
  }

  // Alternador bi-direcional de unidade de peso (Kg <-> @)
  function handleTogglePesoUnit(modo: "KG" | "ARROBA") {
    if (modo === pesoUnitMode) return;
    if (typeof pesoInputValue === "number" && pesoInputValue > 0) {
      if (modo === "ARROBA") {
        // Converte Kg para @: peso / 30
        setPesoInputValue(Number((pesoInputValue / 30).toFixed(2)));
      } else {
        // Converte @ para Kg: peso * 30
        setPesoInputValue(Number((pesoInputValue * 30).toFixed(1)));
      }
    }
    setPesoUnitMode(modo);
  }

  // Cálculos reativos zootécnicos e conversões
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

  // Cálculo de preço resultante
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

  function validar(): boolean {
    const novosErros: Record<string, string> = {};

    if (!titulo.trim() || titulo.trim().length < 5) {
      novosErros.titulo = "Informe um título descritivo de pelo menos 5 caracteres.";
    }
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
    if (!cidade.trim()) {
      novosErros.cidade = "Informe o município da fazenda.";
    }
    if (!uf.trim()) {
      novosErros.uf = "Selecione o estado (UF).";
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validar() || !session) return;

    setIsSubmitting(true);
    try {
      const input: CreateAnimalAdInput = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        especie: "BOVINO",
        raca: racaFinal.slice(0, 30),
        quantidadeCabecas: Number(quantidadeCabecas),
        finalidade,
        idadeMeses: idadeMeses ? Number(idadeMeses) : undefined,
        pesoMedioKg: pesoKgNum,
        pricingMode,
        precoTotal: pricingMode === "TOTAL" ? Number(precoTotal) : valorTotalFinal,
        precoPorCabeca: pricingMode === "PER_HEAD" ? Number(precoPorCabeca) : valorCabecaFinal,
        cidade: cidade.trim(),
        uf,
      };

      const criado = await criarAnuncioAnimal(input, session);
      setCreatedAdId(criado.id);
      setShowSuccessModal(true);
    } catch {
      setErros({ geral: "Ocorreu um erro ao publicar o lote. Tente novamente." });
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
          <span aria-current="page">Novo Lote de Boi Gordo</span>
        </nav>

        <header className="ad-create-header">
          <p className="eyebrow">Pecuária de Corte · Boi Gordo</p>
          <h1 className="ad-create-title">Cadastro de Lote de Boi Gordo</h1>
          <p className="ad-create-subtitle">
            Publique as especificações zootécnicas e comerciais da sua boiada. O lote ficará ativo imediatamente no mercado.
          </p>
        </header>

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
                placeholder="Ex: Lote de 80 Bois Nelore prontos para abate"
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
                Descrição Detalhada do Manejo <span className="form-label__optional">(opcional)</span>
              </label>
              <textarea
                id="ad-descricao"
                className="form-textarea"
                rows={4}
                placeholder="Informe detalhes da pastagem, confinamento, suplementação mineral, histórico sanitário e facilidade de embarque..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={800}
              />
              <span className="form-hint">Destaque os diferenciais de qualidade, acabamento de carcaça e rastreabilidade.</span>
            </div>
          </section>

          {/* BLOCO 2: Especificações Zootécnicas */}
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
                  className={`form-select ${erros.raca ? "form-select--error" : ""}`}
                  value={racaSelect}
                  onChange={(e) => {
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
                <span id="ad-raca-hint" className="form-hint">
                  Informe apenas a raça ou linhagem zootécnica. Detalhes de nutrição, cocho e manejo devem ser descritos no campo Descrição.
                </span>

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
                      className={`form-input ${erros.racaCustom ? "form-input--error" : ""}`}
                      placeholder="Ex: Senepol x Nelore F2"
                      value={racaCustom}
                      onChange={(e) => {
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

          {/* BLOCO 3: Precificação e Localização */}
          <section className="ad-form-section" aria-labelledby="section-preco">
            <h2 id="section-preco" className="ad-form-section__title">
              <Icon name="location" /> 3. Precificação Comercial e Localização
            </h2>

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

            {/* Resumo Financeiro Dinâmico */}
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

            {/* Localização */}
            <div className="ad-form-grid ad-form-grid--2">
              <div className="form-group">
                <label htmlFor="ad-cidade" className="form-label">
                  Município de Retirada <span className="required">*</span>
                </label>
                <input
                  id="ad-cidade"
                  type="text"
                  className={`form-input ${erros.cidade ? "form-input--error" : ""}`}
                  placeholder="Ex: Uberaba ou Barretos"
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

            {/* Imagem de Capa (Placeholder estruturado para US-012) */}
            <div className="ad-cover-preview-box">
              <div className="ad-cover-preview-box__thumb">
                <img src={defaultFarmImage} alt="Fotografia de pastagem rural da fazenda" />
                <span className="ad-cover-badge">Boi Gordo · {racaFinal || "Nelore"}</span>
              </div>
              <div className="ad-cover-preview-box__info">
                <strong>Foto da Propriedade / Lote</strong>
                <p>
                  O lote será anunciado com a fotografia campestre padrão da fazenda. Na US-012, será liberado o envio de fotos e vídeos específicos da boiada.
                </p>
              </div>
            </div>
          </section>

          <div className="ad-form-actions">
            <Link to={routes.myAds} className="button button--outline">
              Cancelar
            </Link>
            <button type="submit" className="button button--primary button--large" disabled={isSubmitting}>
              {isSubmitting ? "Publicando Lote..." : "Publicar Lote de Boi Gordo"}
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
                Seu lote de <strong>{quantidadeCabecas} {racaFinal || "bois"}</strong> já está ativo e visível no mercado para compradores, frigoríficos e cooperativas.
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
                    Ver Ficha Técnica Completa
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
