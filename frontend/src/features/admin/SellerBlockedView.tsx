import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { routes } from "../../data/site";
import {
  type ProducerGovernanceRecord,
  obterStatusGovernancaProdutor,
  submeterContestacaoProdutor,
} from "./adminStorage";
import "./admin.css";

interface SellerBlockedViewProps {
  produtorId: string;
  estadoSessao: "SUSPENSO" | "BANIDO";
  nomeProdutor?: string;
}

function formatRemainingDays(suspensoAte?: string | null): string {
  if (!suspensoAte) return "Prazo indeterminado (até deliberação da Governança)";
  const target = new Date(suspensoAte).getTime();
  const diffMs = target - Date.now();
  if (diffMs <= 0) return "Prazo encerrado — aguardando liberação automática";
  const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const dataFormatada = new Date(suspensoAte).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${dias} ${dias === 1 ? "dia restante" : "dias restantes"} (liberação prevista em ${dataFormatada})`;
}

export function SellerBlockedView({
  produtorId,
  estadoSessao,
  nomeProdutor,
}: SellerBlockedViewProps) {
  const [record, setRecord] = useState<ProducerGovernanceRecord | null>(() =>
    obterStatusGovernancaProdutor(produtorId)
  );
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [textoDefesa, setTextoDefesa] = useState("");
  const [anexoNome, setAnexoNome] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  const estadoEfetivo = record?.estado === "BANIDO" || estadoSessao === "BANIDO" ? "BANIDO" : "SUSPENSO";
  const isBanido = estadoEfetivo === "BANIDO";

  const motivo =
    record?.motivoPunicao ||
    (isBanido
      ? "Descumprimento grave dos Termos de Uso e Diretrizes de Segurança Comercial do SafraDireta."
      : "Inconsistência cadastral ou denúncia em apuração pela equipe de Governança.");

  const handleSubmitAppeal = (e: FormEvent) => {
    e.preventDefault();
    if (textoDefesa.trim().length < 15) {
      setErroForm("Por favor, descreva sua justificativa técnica ou defesa com pelo menos 15 caracteres.");
      return;
    }

    const atualizado = submeterContestacaoProdutor(
      produtorId,
      textoDefesa.trim(),
      anexoNome.trim() || undefined
    );
    if (atualizado) {
      setRecord(atualizado);
    }
    setErroForm(null);
    setShowAppealForm(false);
    setSucessoMsg(
      "Sua contestação foi protocolada com sucesso e enviada para análise prioritária da Governança."
    );
  };

  return (
    <main className="page-shell">
      <div className="container" style={{ maxWidth: "780px" }}>
        <section
          className={`seller-blocked-card ${
            isBanido ? "seller-blocked-card--banned" : "seller-blocked-card--suspended"
          }`}
          aria-labelledby="blocked-title"
        >
          <div className="seller-blocked-card__header">
            <span className="seller-blocked-card__icon" aria-hidden="true">
              <Icon name={isBanido ? "ban" : "alert"} />
            </span>
            <div>
              <span className="seller-blocked-card__eyebrow">
                {isBanido ? "Restrição Definitiva de Conta" : "Restrição Temporária de Vendedor"}
              </span>
              <h1 id="blocked-title" className="seller-blocked-card__title">
                {isBanido
                  ? "Sua conta de vendedor foi banida em definitivo"
                  : "Sua conta de vendedor está temporariamente suspensa"}
              </h1>
            </div>
          </div>

          <p className="seller-blocked-card__lead">
            Olá{nomeProdutor ? `, ${nomeProdutor}` : ""}. Durante a vigência desta medida administrativa, a
            publicação de novos lotes e a exibição dos seus anúncios no Mercado público permanecem bloqueadas.
          </p>

          <div className="seller-blocked-card__details">
            <div className="seller-blocked-card__detail-item">
              <strong>Motivo registrado pela Moderação:</strong>
              <p>{motivo}</p>
            </div>

            {!isBanido && (
              <div className="seller-blocked-card__detail-item">
                <strong>Vigência / Prazo da Suspensão:</strong>
                <p>{formatRemainingDays(record?.suspensoAte)}</p>
              </div>
            )}

            {isBanido && (
              <div className="seller-blocked-card__detail-item">
                <strong>Retenção Legal de Registros (Marco Civil da Internet):</strong>
                <p>
                  Os metadados da conta e o histórico de anúncios permanecem arquivados em modo restrito (
                  <em>Soft Delete</em>) exclusivamente para fins de auditoria e conformidade legal.
                </p>
              </div>
            )}
          </div>

          {sucessoMsg && (
            <div className="seller-blocked-card__toast" role="status">
              <Icon name="check" />
              <span>{sucessoMsg}</span>
            </div>
          )}

          {/* Status de Contestação já enviada */}
          {record?.contestacao && (
            <div className="seller-blocked-card__appeal-status">
              <div className="seller-blocked-card__appeal-header">
                <strong>Protocolo de Contestação / Defesa do Produtor</strong>
                <span
                  className={`admin-badge ${
                    record.contestacao.status === "PENDENTE"
                      ? "admin-badge--warning"
                      : record.contestacao.status === "ACEITA"
                      ? "admin-badge--success"
                      : "admin-badge--danger"
                  }`}
                >
                  {record.contestacao.status === "PENDENTE"
                    ? "⚠️ Em Análise pela Governança"
                    : record.contestacao.status === "ACEITA"
                    ? "✅ Deferida"
                    : "❌ Recurso Indeferido"}
                </span>
              </div>
              <p className="seller-blocked-card__appeal-text">"{record.contestacao.textoDefesa}"</p>
              {record.contestacao.documentoAnexoNome && (
                <p className="seller-blocked-card__appeal-attachment">
                  <Icon name="file" /> Anexo comprobatório:{" "}
                  <strong>{record.contestacao.documentoAnexoNome}</strong>
                </p>
              )}
              {record.contestacao.respostaAdmin && (
                <div className="seller-blocked-card__admin-reply">
                  <strong>Parecer da Governança:</strong>
                  <p>{record.contestacao.respostaAdmin}</p>
                </div>
              )}
            </div>
          )}

          {/* Botão e Formulário de Direito de Resposta (Contestação) */}
          {!showAppealForm ? (
            <div className="seller-blocked-card__actions">
              {(!record?.contestacaoPendente || record?.contestacao?.status === "NEGADA") && (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    setShowAppealForm(true);
                    setSucessoMsg(null);
                  }}
                >
                  📝 Contestar Punição / Solicitar Revisão
                </button>
              )}
              <Link to={routes.market} className="button button--secondary">
                Voltar ao Mercado Público
              </Link>
            </div>
          ) : (
            <form className="seller-blocked-card__form" onSubmit={handleSubmitAppeal} noValidate>
              <h3>📝 Direito de Resposta — Contestar Punição</h3>
              <p className="seller-blocked-card__form-hint">
                Apresente sua justificativa técnica e, se necessário, informe o documento comprobatório (ex:
                Guia de Trânsito Animal - GTA atualizada, nota fiscal do lote ou laudo de classificação).
              </p>

              <div className="field">
                <label htmlFor="appeal-defense-text">
                  Justificativa / Defesa Técnica <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="appeal-defense-text"
                  rows={4}
                  value={textoDefesa}
                  onChange={(e) => {
                    setTextoDefesa(e.target.value);
                    if (erroForm) setErroForm(null);
                  }}
                  placeholder="Explique detalhadamente a regularização realizada ou o equívoco ocorrido..."
                />
              </div>

              <div className="field">
                <label htmlFor="appeal-doc-upload">
                  Documento Comprobatório (GTA, Nota Fiscal, Laudo ou Comprovante — Opcional)
                </label>
                <input
                  id="appeal-doc-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setAnexoNome(file ? file.name : "");
                  }}
                />
                {anexoNome && (
                  <small className="seller-blocked-card__file-selected">
                    Arquivo selecionado: <strong>{anexoNome}</strong>
                  </small>
                )}
              </div>

              {erroForm && (
                <p className="field__error" role="alert">
                  {erroForm}
                </p>
              )}

              <div className="seller-blocked-card__form-actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => {
                    setShowAppealForm(false);
                    setErroForm(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button--primary">
                  Enviar Contestação para a Governança
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
