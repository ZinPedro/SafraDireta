import { useState } from "react";
import type { FormEvent } from "react";
import type {
  EncerramentoAnuncioPayload,
  MarketplaceAd,
} from "./ads.types";
import {
  MOTIVOS_ENCERRAMENTO_CANCELADO,
  MOTIVOS_ENCERRAMENTO_VENDIDO,
} from "./ads.types";
import { Icon } from "../../components/Icon";

export interface CloseAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  anuncio: MarketplaceAd;
  onConfirm: (payload: EncerramentoAnuncioPayload) => Promise<void>;
}

export function CloseAdModal({
  isOpen,
  onClose,
  anuncio,
  onConfirm,
}: CloseAdModalProps) {
  const [tipo, setTipo] = useState<"VENDIDO" | "CANCELADO">("VENDIDO");
  const [motivo, setMotivo] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [desvincularDocumentos, setDesvincularDocumentos] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTipoChange = (novoTipo: "VENDIDO" | "CANCELADO") => {
    setTipo(novoTipo);
    setMotivo(""); // Reseta o motivo ao alternar a finalidade
    setError(null);
  };

  const motivosDisponiveis =
    tipo === "VENDIDO"
      ? MOTIVOS_ENCERRAMENTO_VENDIDO
      : MOTIVOS_ENCERRAMENTO_CANCELADO;

  const totalDocumentos = anuncio.documentos?.length || 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!motivo) {
      setError("Por favor, selecione o motivo do encerramento.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await onConfirm({
        tipo,
        motivo,
        observacoes: observacoes.trim() || undefined,
        desvincularDocumentos: totalDocumentos > 0 ? desvincularDocumentos : false,
      });

      setIsSubmitting(false);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao encerrar a disponibilidade do anúncio."
      );
    }
  };

  return (
    <div
      className="modal-backdrop ad-close-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-ad-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-card ad-close-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ad-close-header">
          <div className="ad-close-header__icon" aria-hidden="true">
            <Icon name="box" />
          </div>
          <div className="ad-close-header__info">
            <h3 id="close-ad-modal-title" className="ad-close-modal-title">
              Encerrar Disponibilidade do Lote
            </h3>
            <p className="ad-close-modal-meta">
              Lote: <strong>{anuncio.titulo}</strong>
              {anuncio.farmName ? ` · ${anuncio.farmName}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="ad-close-modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
            disabled={isSubmitting}
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="ad-close-form">
          {error && (
            <div className="ad-close-error" role="alert">
              <Icon name="alert" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Finalidade do encerramento */}
          <div className="ad-close-section">
            <label className="ad-close-label">
              1. Qual é a finalidade deste encerramento? <span className="ad-close-required">*</span>
            </label>
            <div className="ad-close-type-grid" role="radiogroup" aria-label="Finalidade do encerramento">
              <label
                className={`ad-close-type-card ${
                  tipo === "VENDIDO" ? "ad-close-type-card--selected" : ""
                }`}
              >
                <div className="ad-close-type-card__header">
                  <input
                    type="radio"
                    name="tipoEncerramento"
                    value="VENDIDO"
                    checked={tipo === "VENDIDO"}
                    onChange={() => handleTipoChange("VENDIDO")}
                    disabled={isSubmitting}
                  />
                  <div className="ad-close-type-card__icon ad-close-type-card__icon--sold">
                    <Icon name="check" />
                  </div>
                  <strong>Lote Comercializado / Vendido</strong>
                </div>
                <p className="ad-close-type-card__desc">
                  O lote foi negociado com sucesso (via SafraDireta ou por canal externo).
                </p>
              </label>

              <label
                className={`ad-close-type-card ${
                  tipo === "CANCELADO" ? "ad-close-type-card--selected" : ""
                }`}
              >
                <div className="ad-close-type-card__header">
                  <input
                    type="radio"
                    name="tipoEncerramento"
                    value="CANCELADO"
                    checked={tipo === "CANCELADO"}
                    onChange={() => handleTipoChange("CANCELADO")}
                    disabled={isSubmitting}
                  />
                  <div className="ad-close-type-card__icon ad-close-type-card__icon--cancel">
                    <Icon name="close" />
                  </div>
                  <strong>Lote Cancelado / Retirado</strong>
                </div>
                <p className="ad-close-type-card__desc">
                  O lote não foi vendido (retenção na propriedade, perda física ou desistência).
                </p>
              </label>
            </div>
          </div>

          {/* 2. Motivo */}
          <div className="ad-close-section">
            <label htmlFor="motivo-select" className="ad-close-label">
              2. Motivo do Encerramento <span className="ad-close-required">*</span>
            </label>
            <select
              id="motivo-select"
              className="ad-close-select"
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setError(null);
              }}
              disabled={isSubmitting}
              required
            >
              <option value="">Selecione o motivo detalhado...</option>
              {motivosDisponiveis.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Observações internas */}
          <div className="ad-close-section">
            <label htmlFor="observacoes-input" className="ad-close-label">
              3. Observações Internas (Opcional)
            </label>
            <textarea
              id="observacoes-input"
              className="ad-close-textarea"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder={
                tipo === "VENDIDO"
                  ? "Ex: Vendido para frigorífico parceiro a R$ 298/@ com entrega em 15 dias..."
                  : "Ex: Retido no confinamento devido à alta no preço / Consumido na fazenda..."
              }
              disabled={isSubmitting}
            />
            <span className="ad-close-hint">
              Visível apenas para a gestão da sua fazenda na aba &quot;Encerrados&quot; do painel.
            </span>
          </div>

          {/* 4. Proteção de Dados e Documentos (LGPD) */}
          <div className="ad-close-lgpd-box">
            <div className="ad-close-lgpd-box__header">
              <Icon name="shield" />
              <strong>Proteção de Dados e Data Room Agro (LGPD)</strong>
            </div>
            <ul className="ad-close-lgpd-list">
              <li>
                Todos os acessos de terceiros aos documentos (GTA, laudos e notas) serão <strong>revogados imediatamente</strong>.
              </li>
              <li>
                Solicitações de documentos aguardando análise serão finalizadas automaticamente com aviso ao comprador.
              </li>
            </ul>

            {totalDocumentos > 0 && (
              <label className="ad-close-checkbox-label">
                <input
                  type="checkbox"
                  checked={desvincularDocumentos}
                  onChange={(e) => setDesvincularDocumentos(e.target.checked)}
                  disabled={isSubmitting}
                />
                <div>
                  <strong>Desvincular e remover arquivos anexados do painel ({totalDocumentos} {totalDocumentos === 1 ? "arquivo" : "arquivos"})</strong>
                  <p>
                    Elimina a visualização dos PDFs do lote no painel, resguardando os registros de auditoria legal.
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Aviso de Terminalidade */}
          <div className="ad-close-warning-box">
            <Icon name="alert" />
            <span>
              <strong>Atenção:</strong> O encerramento é definitivo. Este lote sairá imediatamente do mercado público e não poderá ser reativado nem ter preços/quantidades alterados. Você ainda poderá duplicá-lo como modelo.
            </span>
          </div>

          {/* Footer actions */}
          <div className="ad-close-actions">
            <button
              type="button"
              className="button button--outline ad-close-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ad-close-btn-confirm"
              disabled={isSubmitting || !motivo}
            >
              {isSubmitting ? (
                <>
                  <Icon name="clock" className="ad-loading-spinner" />
                  <span>Encerrando Lote...</span>
                </>
              ) : (
                <>
                  <Icon name="box" />
                  <span>Confirmar Encerramento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
