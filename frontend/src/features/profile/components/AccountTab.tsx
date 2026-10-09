import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Avatar } from "../../../components/Avatar";
import { Icon } from "../../../components/Icon";
import { routes } from "../../../data/site";
import { useAuth } from "../../../context/authContext";
import { validateFile } from "../../seller-upgrade/sellerUpgrade";
import {
  formatCep, formatCpf, formatDocument, formatPhone, phoneDigits, toPhoneApi, ufs, validateAccount,
} from "../profile";
import type { ProfileUpdateResult, UpdateUserProfile, UserProfileData } from "../profile";

export function AccountTab({ profile, onSave, onSaved }: {
  profile: UserProfileData;
  onSave: UpdateUserProfile;
  onSaved: (profile: UserProfileData) => void;
}) {
  const { session, setAvatar } = useAuth();
  const isPj = profile.account.tipo === "PJ";
  const [values, setValues] = useState(() => ({
    nome: profile.account.nome,
    telefone: formatPhone(phoneDigits(profile.account.telefone)),
    cpf: !isPj && profile.account.cpfCnpj ? formatCpf(profile.account.cpfCnpj) : "",
    cep: formatCep(profile.address.cep), logradouro: profile.address.logradouro, numero: profile.address.numero,
    complemento: profile.address.complemento ?? "", bairro: profile.address.bairro,
    cidade: profile.address.cidade, uf: profile.address.uf,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [photoMessage, setPhotoMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef(false);
  const vendedorEstado = session?.vendedorEstado ?? null;

  function update(name: keyof typeof values, value: string) {
    setValues((c) => ({ ...c, [name]: value }));
    setErrors((c) => {
      if (!c[name]) return c;
      const { [name]: _removed, ...rest } = c;
      return rest;
    });
    setFeedback(null);
  }

  function focusFirst(next: Record<string, string>) {
    const key = Object.keys(next)[0];
    requestAnimationFrame(() => document.getElementById(`profile-${key}`)?.focus());
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validateFile(file);
    if (problem || !file.type.startsWith("image/")) {
      setPhotoMessage(problem ?? "Escolha uma imagem JPG ou PNG.");
      return;
    }
    setPhotoMessage("");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const next = validateAccount(values);
    setErrors(next);
    if (Object.keys(next).length) {
      setFeedback(null);
      focusFirst(next);
      return;
    }
    pendingRef.current = true;
    setSaving(true);
    setFeedback(null);
    let result: ProfileUpdateResult;
    try {
      result = await onSave({
        account: {
          ...profile.account,
          nome: values.nome.trim().replace(/\s+/g, " "),
          telefone: toPhoneApi(values.telefone),
          cpfCnpj: isPj || profile.account.cpfCnpj ? profile.account.cpfCnpj : values.cpf.replace(/\D/g, ""),
          avatarUrl: session?.avatarUrl ?? profile.account.avatarUrl,
        },
        address: {
          cep: values.cep.replace(/\D/g, ""), logradouro: values.logradouro.trim(), numero: values.numero.trim(),
          complemento: values.complemento.trim(), bairro: values.bairro.trim(), cidade: values.cidade.trim(), uf: values.uf,
        },
      });
    } catch {
      result = { ok: false, reason: "unavailable", message: "Não foi possível concluir a solicitação. Tente novamente." };
    }
    pendingRef.current = false;
    setSaving(false);
    if (result.ok) {
      setFeedback({ kind: "ok", text: result.message });
      onSaved(result.updatedProfile);
    } else {
      setFeedback({ kind: "error", text: result.message });
      if (result.errors && Object.keys(result.errors).length) {
        setErrors(result.errors);
        focusFirst(result.errors);
      }
    }
  }

  const ctl = (name: string) => ({
    id: `profile-${name}`, name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `profile-${name}-error` : undefined,
  });
  const err = (name: string) => errors[name] && <p className="registration-field__error" id={`profile-${name}-error`}>{errors[name]}</p>;

  return (
    <>
    <form ref={formRef} noValidate onSubmit={handleSubmit} aria-busy={saving} className="profile__form">
      <fieldset className="registration__fields" disabled={saving}>
        <legend className="sr-only">Dados da conta. Campos com asterisco são obrigatórios.</legend>

        <div className="profile__photo">
          <Avatar url={session?.avatarUrl} name={profile.account.nome} size={72} />
          <div>
            <label className="profile__photo-button" htmlFor="profile-photo">Alterar foto</label>
            <input id="profile-photo" className="sr-only" type="file" accept=".jpg,.jpeg,.png" onChange={handlePhoto} aria-describedby="profile-photo-hint" />
            <p className="corporate__hint" id="profile-photo-hint">JPG ou PNG, até 10 MB. Foto visível no seu perfil e cabeçalho.</p>
            {photoMessage && <p className="registration-field__error" role="alert">{photoMessage}</p>}
          </div>
        </div>

        <h2 className="seller-upgrade__section">Dados pessoais</h2>
        <div className="registration-field">
          <label htmlFor="profile-nome">{isPj ? "Razão social / nome" : "Nome completo"} <span aria-hidden="true">*</span></label>
          <input {...ctl("nome")} type="text" maxLength={150} autoComplete="name" value={values.nome} onChange={(e) => update("nome", e.target.value)} />
          {err("nome")}
        </div>
        <div className="registration-field">
          <label htmlFor="profile-telefone">Telefone de contato <span aria-hidden="true">*</span></label>
          <input {...ctl("telefone")} type="tel" maxLength={15} autoComplete="tel-national" placeholder="(19) 99999-9999"
            value={values.telefone} onChange={(e) => update("telefone", formatPhone(e.target.value))} />
          {err("telefone")}
        </div>
        <div className="registration-field profile__locked">
          <label htmlFor="profile-email"><Icon name="lock" /> E-mail de acesso</label>
          <input id="profile-email" type="email" value={profile.account.email} readOnly aria-readonly="true" aria-describedby="profile-email-hint" />
          <p className="corporate__hint" id="profile-email-hint">O e-mail de acesso é a chave única da sua conta e não pode ser alterado diretamente.</p>
        </div>
        {isPj ? (
          <div className="registration-field profile__locked">
            <label htmlFor="profile-document"><Icon name="lock" /> CNPJ</label>
            <input id="profile-document" type="text" value={profile.account.cpfCnpj ? formatDocument(profile.account.cpfCnpj) : "Não informado"} readOnly aria-readonly="true" aria-describedby="profile-document-hint" />
            <p className="corporate__hint" id="profile-document-hint">
              {profile.account.cpfCnpj
                ? "Documento fiscal verificado. Alterações exigem solicitação ao suporte."
                : "CNPJ em análise documental."}
            </p>
          </div>
        ) : profile.account.cpfCnpj ? (
          <div className="registration-field profile__locked">
            <label htmlFor="profile-document"><Icon name="lock" /> CPF</label>
            <input
              id="profile-document"
              type="text"
              value={formatCpf(profile.account.cpfCnpj)}
              readOnly
              aria-readonly="true"
              aria-describedby="profile-document-hint"
            />
            <p className="corporate__hint" id="profile-document-hint">
              {vendedorEstado === "HABILITADO"
                ? "CPF de produtor habilitado. Alterações exigem solicitação ao suporte."
                : "CPF vinculado à sua conta como dado protegido. Alterações exigem solicitação ao suporte."}
            </p>
          </div>
        ) : (
          <div className="registration-field">
            <label htmlFor="profile-cpf">CPF <small>(opcional)</small></label>
            <input
              {...ctl("cpf")}
              type="text"
              inputMode="numeric"
              maxLength={14}
              placeholder="000.000.000-00"
              value={values.cpf}
              onChange={(e) => update("cpf", formatCpf(e.target.value))}
            />
            {err("cpf")}
            <p className="corporate__hint" id="profile-cpf-hint">
              Opcional para compras. Uma vez informado e salvo, o CPF fica vinculado permanentemente como dado protegido.
            </p>
          </div>
        )}

        <h2 className="seller-upgrade__section">Endereço principal</h2>
        <div className="registration-field">
          <label htmlFor="profile-cep">CEP</label>
          <input {...ctl("cep")} type="text" inputMode="numeric" maxLength={9} autoComplete="postal-code" placeholder="00000-000"
            value={values.cep} onChange={(e) => update("cep", formatCep(e.target.value))} />
          {err("cep")}
        </div>
        <div className="registration-field">
          <label htmlFor="profile-logradouro">Logradouro</label>
          <input {...ctl("logradouro")} type="text" maxLength={150} autoComplete="address-line1" value={values.logradouro} onChange={(e) => update("logradouro", e.target.value)} />
          {err("logradouro")}
        </div>
        <div className="corporate__row">
          <div className="registration-field">
            <label htmlFor="profile-numero">Número</label>
            <input {...ctl("numero")} type="text" maxLength={10} value={values.numero} onChange={(e) => update("numero", e.target.value)} />
            {err("numero")}
          </div>
          <div className="registration-field">
            <label htmlFor="profile-complemento">Complemento</label>
            <input {...ctl("complemento")} type="text" maxLength={60} autoComplete="address-line2" value={values.complemento} onChange={(e) => update("complemento", e.target.value)} />
          </div>
        </div>
        <div className="registration-field">
          <label htmlFor="profile-bairro">Bairro</label>
          <input {...ctl("bairro")} type="text" maxLength={80} value={values.bairro} onChange={(e) => update("bairro", e.target.value)} />
          {err("bairro")}
        </div>
        <div className="corporate__row">
          <div className="registration-field">
            <label htmlFor="profile-cidade">Cidade</label>
            <input {...ctl("cidade")} type="text" maxLength={80} autoComplete="address-level2" value={values.cidade} onChange={(e) => update("cidade", e.target.value)} />
            {err("cidade")}
          </div>
          <div className="registration-field">
            <label htmlFor="profile-uf">UF</label>
            <select {...ctl("uf")} value={values.uf} onChange={(e) => update("uf", e.target.value)}>
              <option value="">UF</option>
              {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {err("uf")}
          </div>
        </div>

        <button className="button registration__submit" type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </fieldset>
      <div aria-live="polite" aria-atomic="true">
        {feedback && <p className={`registration__feedback ${feedback.kind === "error" ? "registration__feedback--error" : ""}`}>{feedback.text}</p>}
      </div>
    </form>

      {!isPj && vendedorEstado !== "HABILITADO" && (
        <aside className="profile__seller-cta" aria-labelledby="profile-seller-cta-title">
          <h2 id="profile-seller-cta-title">Vender no SafraDireta</h2>
          {vendedorEstado === "PENDENTE" ? (
            <p>Sua solicitação de habilitação para vender está em análise. Você continua com acesso completo às compras.</p>
          ) : (
            <>
              <p>Deseja comercializar lotes no SafraDireta? Habilite as funcionalidades de venda na sua conta.</p>
              <Link className="button profile__secondary-button" to={routes.sellerUpgrade}>Habilitar Vendas</Link>
            </>
          )}
        </aside>
      )}
    </>
  );
}
