import { useState } from "react";
import type { FormEvent } from "react";
import type { MarketplaceAd } from "./ads.types";
import { AD_DOCUMENT_SHORT_LABELS } from "./ads.types";
import { solicitarAcessoDocumentos } from "./adsDocumentStorage";
import { useAuth } from "../../context/authContext";
import { Icon } from "../../components/Icon";

export interface RequestAdAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  anuncio: MarketplaceAd;
  onSuccess: () => void;
}

export function RequestAdAccessModal({
  isOpen,
  onClose,
  anuncio,
  onSuccess,
}: RequestAdAccessModalProps) {
  const { session } = useAuth();
  const [mensagem, setMensagem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) {
      setError("Você precisa estar autenticado para solicitar acesso aos documentos.");
      return;
    }

    const msgTrim = mensagem.trim();
    if (msgTrim.length < 10) {
      setError("Por favor, descreva seu interesse comercial com pelo menos 10 caracteres.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await solicitarAcessoDocumentos(
        anuncio.id,
        {
          id: session.conta.id,
          nome: session.conta.nome,
          cidadeUf:
            session.conta.tipo === "PJ"
              ? "Empresa Compradora"
              : undefined,
          tipo: session.conta.tipo === "PJ" ? "PJ" : "PF",
        },
        msgTrim
      );

      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao enviar solicitação de acesso aos documentos."
      );
    }
  };

  const totalDocs = anuncio.documentos?.length || 0;

  return (
    <div
      className="modal-backdrop ad-doc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-doc-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-card ad-doc-modal-card ad-doc-modal-card--request"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ad-doc-request-header">
          <div className="ad-doc-request-header__icon" aria-hidden="true">
            <Icon name="lock" />
          </div>
          <div>
            <h3 id="request-doc-modal-title" className="ad-doc-modal-title">
              Solicitar Acesso aos Documentos do Lote
            </h3>
            <p className="ad-doc-modal-meta">
              Lote: <strong>{anuncio.titulo}</strong> · Vendedor:{" "}
              <strong>{anuncio.farmName || anuncio.vendedorNome}</strong>
            </p>
          </div>
          <button
            type="button"
            className="button button--secondary button--small ad-doc-modal-close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ad-doc-request-form">
          {error && (
            <div className="ad-alert ad-alert--error" role="alert">
              <Icon name="alert" />
              <span>{error}</span>
            </div>
          )}

          <div className="ad-doc-request-info-box">
            <p className="ad-doc-request-info-box__title">
              <Icon name="shield" /> Data Room Protegido SafraDireta
            </p>
            <p className="ad-doc-request-info-box__text">
              Para resguardar dados sanitários, fiscais e geográficos do produtor, os{" "}
              <strong>{totalDocs} documento(s)</strong> deste lote são disponibilizados sob
              autorização direta.
            </p>

            {anuncio.documentos && anuncio.documentos.length > 0 && (
              <div className="ad-doc-request-pills" aria-label="Documentos disponíveis no lote">
                {anuncio.documentos.map((d) => (
                  <span key={d.id} className="ad-doc-request-pill">
                    <Icon name="file" /> {AD_DOCUMENT_SHORT_LABELS[d.tipo] || d.tipo}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="ad-doc-request-buyer-card">
            <span className="ad-doc-request-buyer-label">Sua identificação de comprador:</span>
            <div className="ad-doc-request-buyer-info">
              <strong>{session?.conta.nome}</strong>
              <span>
                {session?.conta.tipo === "PJ" ? "Pessoa Jurídica (PJ)" : "Pessoa Física (PF)"} ·{" "}
                {session?.conta.email}
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="mensagem-interesse" className="form-label">
              Mensagem sobre seu interesse comercial no lote{" "}
              <span className="form-label-required">*</span>
            </label>
            <textarea
              id="mensagem-interesse"
              className="form-textarea"
              rows={4}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Ex: Olá, represento frigorífico/cooperativa parceira e temos interesse na compra deste lote. Gostaríamos de conferir a GTA e os laudos para formalização de proposta..."
              required
              minLength={10}
              maxLength={600}
            />
            <div className="form-field-footer">
              <span className="form-field-hint">
                Mínimo de 10 caracteres. Explique sua intenção de compra para avaliação do produtor.
              </span>
              <span className="form-field-counter">
                {mensagem.length < 10 ? (
                  <span style={{ color: "#d97706" }}>{mensagem.length}/10 mín.</span>
                ) : (
                  <span>{mensagem.length}/600</span>
                )}
              </span>
            </div>
          </div>

          <div className="ad-doc-request-actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="button button--primary"
              disabled={isSubmitting || mensagem.trim().length < 10}
            >
              {isSubmitting ? "Enviando Solicitação..." : "Enviar Solicitação de Acesso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
