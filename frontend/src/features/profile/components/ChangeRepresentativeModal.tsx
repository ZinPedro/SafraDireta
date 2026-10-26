import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Icon } from "../../../components/Icon";
import { formatCpf, isValidCpf } from "../profile";
import { formatFileSize, validateFile } from "../../seller-upgrade/sellerUpgrade";
import { salvarTrocaRepresentanteDocsNoIndexedDB } from "../../corporate-registration/corporateDocsStorage";
import { solicitarTrocaRepresentanteEmpresa } from "../../admin/adminStorage";

export interface ChangeRepresentativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: string;
  cnpjClean: string;
  currentRepresentativeName: string;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3;

export function ChangeRepresentativeModal({
  isOpen,
  onClose,
  empresaId,
  cnpjClean,
  currentRepresentativeName,
  onSuccess,
}: ChangeRepresentativeModalProps) {
  const [step, setStep] = useState<Step>(1);

  // Etapa 1: Dados
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [vinculo, setVinculo] = useState("Sócio-Administrador");

  // Etapa 2: CNH / RG
  const [docFrente, setDocFrente] = useState<File | null>(null);
  const [docVerso, setDocVerso] = useState<File | null>(null);

  // Etapa 3: Poderes
  const [tipoComprovacao, setTipoComprovacao] = useState<
    "ATA_ELEICAO" | "ALTERACAO_CONTRATUAL" | "PROCURACAO_PUBLICA"
  >("ALTERACAO_CONTRATUAL");
  const [comprovacaoPoderes, setComprovacaoPoderes] = useState<File | null>(null);
  const [termoAceito, setTermoAceito] = useState(false);

  // Erros e status
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Validação Etapa 1
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!nome.trim() || nome.trim().length < 3) {
      errs.nome = "Informe o nome completo do novo representante legal.";
    }
    const cleanCpf = cpf.replace(/\D/g, "");
    if (!cleanCpf || !isValidCpf(cleanCpf)) {
      errs.cpf = "CPF inválido. Digite os 11 dígitos do CPF.";
    }
    if (!vinculo.trim()) {
      errs.vinculo = "Selecione o vínculo societário do representante.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Validação Etapa 2
  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!docFrente) {
      errs.docFrente = "Anexe a frente do documento de identificação (CNH ou RG).";
    }
    if (!docVerso) {
      errs.docVerso = "Anexe o verso do documento de identificação (CNH ou RG).";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Validação Etapa 3
  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!comprovacaoPoderes) {
      errs.comprovacaoPoderes =
        "Anexe o documento que comprove os poderes de representação da pessoa jurídica.";
    }
    if (!termoAceito) {
      errs.termoAceito =
        "É obrigatório declarar a veracidade das informações sob as penas da lei.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  };

  const handleBack = () => {
    setErrors({});
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  const handleFileUpload = (
    e: ChangeEvent<HTMLInputElement>,
    setter: (f: File | null) => void,
    fieldKey: string
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const problem = validateFile(file);
    if (problem) {
      setErrors((prev) => ({ ...prev, [fieldKey]: problem }));
      setter(null);
      return;
    }

    setErrors((prev) => {
      const { [fieldKey]: _removed, ...rest } = prev;
      return rest;
    });
    setter(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep3() || !docFrente || !docVerso || !comprovacaoPoderes) return;

    setIsSubmitting(true);
    try {
      // 1. Salva os binários no IndexedDB
      await salvarTrocaRepresentanteDocsNoIndexedDB(cnpjClean, {
        repFrente: docFrente,
        repVerso: docVerso,
        comprovacaoPoderes,
        tipoComprovacao,
      });

      // 2. Registra o pedido de troca no adminStorage
      solicitarTrocaRepresentanteEmpresa(empresaId, {
        novoRepresentante: {
          nome: nome.trim(),
          cpf: cpf.trim(),
          vinculo: vinculo.trim(),
        },
        docFrenteNome: docFrente.name,
        docVersoNome: docVerso.name,
        comprovacaoPoderesNome: comprovacaoPoderes.name,
        tipoComprovacao,
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Erro ao solicitar troca de representante:", err);
      setErrors({ form: "Ocorreu um erro ao registrar a solicitação. Tente novamente." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-card profile-change-rep-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "640px" }}
      >
        <div className="modal-card__header">
          <div>
            <span className="admin-tag">Governança Corporativa</span>
            <h3>Troca de Representante Legal</h3>
            <p className="corporate__hint" style={{ marginTop: "0.25rem" }}>
              Representante atual: <strong>{currentRepresentativeName}</strong>
            </p>
          </div>
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Wizard Progress Stepper */}
        <div className="profile-wizard-steps" role="tablist">
          <div className={`profile-wizard-step ${step >= 1 ? "is-active" : ""}`}>
            <span className="profile-wizard-step__number">1</span>
            <span className="profile-wizard-step__label">Novos Dados</span>
          </div>
          <div className="profile-wizard-step__line" />
          <div className={`profile-wizard-step ${step >= 2 ? "is-active" : ""}`}>
            <span className="profile-wizard-step__number">2</span>
            <span className="profile-wizard-step__label">Identificação</span>
          </div>
          <div className="profile-wizard-step__line" />
          <div className={`profile-wizard-step ${step >= 3 ? "is-active" : ""}`}>
            <span className="profile-wizard-step__number">3</span>
            <span className="profile-wizard-step__label">Poderes & Termo</span>
          </div>
        </div>

        <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
          {/* =============================================================== */}
          {/* ETAPA 1: DADOS DO NOVO REPRESENTANTE                             */}
          {/* =============================================================== */}
          {step === 1 && (
            <div className="profile-wizard-body">
              <h4 style={{ marginBottom: "1rem" }}>Etapa 1: Dados do Novo Representante</h4>

              <div className="registration-field">
                <label htmlFor="rep-nome">
                  Nome Completo do Novo Representante <span aria-hidden="true">*</span>
                </label>
                <input
                  id="rep-nome"
                  type="text"
                  maxLength={150}
                  placeholder="Nome civil conforme documento"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (errors.nome) setErrors((prev) => ({ ...prev, nome: "" }));
                  }}
                  autoFocus
                />
                {errors.nome && <p className="registration-field__error">{errors.nome}</p>}
              </div>

              <div className="registration-field">
                <label htmlFor="rep-cpf">
                  CPF do Novo Representante <span aria-hidden="true">*</span>
                </label>
                <input
                  id="rep-cpf"
                  type="text"
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => {
                    setCpf(formatCpf(e.target.value));
                    if (errors.cpf) setErrors((prev) => ({ ...prev, cpf: "" }));
                  }}
                />
                {errors.cpf && <p className="registration-field__error">{errors.cpf}</p>}
              </div>

              <div className="registration-field">
                <label htmlFor="rep-vinculo">
                  Vínculo com a Empresa <span aria-hidden="true">*</span>
                </label>
                <select
                  id="rep-vinculo"
                  value={vinculo}
                  onChange={(e) => {
                    setVinculo(e.target.value);
                    if (errors.vinculo) setErrors((prev) => ({ ...prev, vinculo: "" }));
                  }}
                >
                  <option value="Sócio-Administrador">Sócio-Administrador</option>
                  <option value="Diretor Estatutário / Eleito">Diretor Estatutário / Eleito</option>
                  <option value="Procurador Legal com Poderes">Procurador Legal com Poderes</option>
                  <option value="Presidente / Cooperado Responsável">Presidente / Cooperado Responsável</option>
                  <option value="Administrador Judicial / Outro">Administrador Judicial / Outro</option>
                </select>
                {errors.vinculo && <p className="registration-field__error">{errors.vinculo}</p>}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* ETAPA 2: IDENTIFICAÇÃO (CNH / RG FRENTE E VERSO)                 */}
          {/* =============================================================== */}
          {step === 2 && (
            <div className="profile-wizard-body">
              <h4 style={{ marginBottom: "0.5rem" }}>
                Etapa 2: Documento de Identidade do Novo Representante
              </h4>
              <p className="corporate__hint" style={{ marginBottom: "1.25rem" }}>
                Envie fotos legíveis ou arquivo digitalizado da CNH ou RG (Frente e Verso). Formatos
                aceitos: PDF, JPG ou PNG (máx. 10 MB cada).
              </p>

              <div className="profile-file-slot">
                <label htmlFor="rep-doc-frente">
                  <strong>Documento de Identidade — Frente (Foto e Assinatura) *</strong>
                </label>
                <div className="profile-file-slot__row">
                  <input
                    type="file"
                    id="rep-doc-frente"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(e, setDocFrente, "docFrente")}
                  />
                  {docFrente ? (
                    <div className="profile-file-slot__info">
                      <Icon name="check" />
                      <span>{docFrente.name} ({formatFileSize(docFrente.size)})</span>
                      <label htmlFor="rep-doc-frente" className="button button--outline button--small">
                        Substituir
                      </label>
                    </div>
                  ) : (
                    <label htmlFor="rep-doc-frente" className="button button--secondary button--small">
                      📁 Selecionar Frente do Documento
                    </label>
                  )}
                </div>
                {errors.docFrente && (
                  <p className="registration-field__error">{errors.docFrente}</p>
                )}
              </div>

              <div className="profile-file-slot" style={{ marginTop: "1rem" }}>
                <label htmlFor="rep-doc-verso">
                  <strong>Documento de Identidade — Verso (Filiação e Registro) *</strong>
                </label>
                <div className="profile-file-slot__row">
                  <input
                    type="file"
                    id="rep-doc-verso"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileUpload(e, setDocVerso, "docVerso")}
                  />
                  {docVerso ? (
                    <div className="profile-file-slot__info">
                      <Icon name="check" />
                      <span>{docVerso.name} ({formatFileSize(docVerso.size)})</span>
                      <label htmlFor="rep-doc-verso" className="button button--outline button--small">
                        Substituir
                      </label>
                    </div>
                  ) : (
                    <label htmlFor="rep-doc-verso" className="button button--secondary button--small">
                      📁 Selecionar Verso do Documento
                    </label>
                  )}
                </div>
                {errors.docVerso && (
                  <p className="registration-field__error">{errors.docVerso}</p>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* ETAPA 3: COMPROVAÇÃO DE PODERES E TERMO                          */}
          {/* =============================================================== */}
          {step === 3 && (
            <div className="profile-wizard-body">
              <h4 style={{ marginBottom: "0.5rem" }}>
                Etapa 3: Comprovação de Poderes e Termo de Fé Pública
              </h4>
              <p className="corporate__hint" style={{ marginBottom: "1.25rem" }}>
                Para segurança da empresa e prevenção a fraudes mercantis, anexe o documento
                jurídico que legitima a representação.
              </p>

              <div className="registration-field">
                <label htmlFor="rep-tipo-comprovacao">
                  Instrumento de Poderes <span aria-hidden="true">*</span>
                </label>
                <select
                  id="rep-tipo-comprovacao"
                  value={tipoComprovacao}
                  onChange={(e) =>
                    setTipoComprovacao(
                      e.target.value as "ATA_ELEICAO" | "ALTERACAO_CONTRATUAL" | "PROCURACAO_PUBLICA"
                    )
                  }
                >
                  <option value="ALTERACAO_CONTRATUAL">
                    📜 Última Alteração Contratual Consolidada (Junta Comercial)
                  </option>
                  <option value="ATA_ELEICAO">
                    📜 Ata de Eleição e Posse da Diretoria (Cooperativas/Associações)
                  </option>
                  <option value="PROCURACAO_PUBLICA">
                    📜 Procuração Pública de Gestão Mercantil (em Cartório)
                  </option>
                </select>
              </div>

              <div className="profile-file-slot" style={{ marginTop: "1rem" }}>
                <label htmlFor="rep-comprovacao-arquivo">
                  <strong>Upload do Documento Comprobatório *</strong>
                </label>
                <div className="profile-file-slot__row">
                  <input
                    type="file"
                    id="rep-comprovacao-arquivo"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) =>
                      handleFileUpload(e, setComprovacaoPoderes, "comprovacaoPoderes")
                    }
                  />
                  {comprovacaoPoderes ? (
                    <div className="profile-file-slot__info">
                      <Icon name="check" />
                      <span>
                        {comprovacaoPoderes.name} ({formatFileSize(comprovacaoPoderes.size)})
                      </span>
                      <label
                        htmlFor="rep-comprovacao-arquivo"
                        className="button button--outline button--small"
                      >
                        Substituir
                      </label>
                    </div>
                  ) : (
                    <label
                      htmlFor="rep-comprovacao-arquivo"
                      className="button button--secondary button--small"
                    >
                      📁 Selecionar Ata / Contrato / Procuração (PDF ou Imagem até 10 MB)
                    </label>
                  )}
                </div>
                {errors.comprovacaoPoderes && (
                  <p className="registration-field__error">{errors.comprovacaoPoderes}</p>
                )}
              </div>

              <div className="registration-field profile-terms-box" style={{ marginTop: "1.25rem" }}>
                <label className="profile-checkbox-label">
                  <input
                    type="checkbox"
                    checked={termoAceito}
                    onChange={(e) => {
                      setTermoAceito(e.target.checked);
                      if (errors.termoAceito) {
                        setErrors((prev) => {
                          const { termoAceito: _removed, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                  />
                  <span>
                    <strong>Declaração de Veracidade e Fé Pública:</strong> Declaro sob as penas da
                    lei que as informações prestadas e os documentos anexados são autênticos,
                    verídicos e representam a administração atual da pessoa jurídica perante o
                    mercado SafraDireta.
                  </span>
                </label>
                {errors.termoAceito && (
                  <p className="registration-field__error">{errors.termoAceito}</p>
                )}
              </div>

              {errors.form && (
                <p className="registration-field__error" role="alert" style={{ marginTop: "0.5rem" }}>
                  {errors.form}
                </p>
              )}
            </div>
          )}

          {/* Navegação entre etapas */}
          <div className="modal-card__actions" style={{ marginTop: "1.5rem" }}>
            {step > 1 ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Voltar
              </button>
            ) : (
              <button
                type="button"
                className="button button--secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                className="button button--primary"
                onClick={handleNext}
              >
                Avançar para Etapa {step + 1}
              </button>
            ) : (
              <button
                type="submit"
                className="button button--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Enviando solicitação…" : "Confirmar Solicitação de Troca"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
