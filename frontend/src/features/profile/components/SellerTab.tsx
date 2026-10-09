import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { formatPhone, phoneDigits, sellerCategories, SELLER_BIO_LIMIT, toPhoneApi, ufs, validateSellerProfile } from "../profile";
import type { ProfileUpdateResult, SellerCategory, UpdateUserProfile, UserProfileData } from "../profile";

type Seller = NonNullable<UserProfileData["seller"]>;

export function SellerTab({ seller, onSave, onSaved }: {
  seller: Seller;
  onSave: UpdateUserProfile;
  onSaved: (profile: UserProfileData) => void;
}) {
  const [values, setValues] = useState(() => ({
    farmName: seller.farmName, bio: seller.bio, city: seller.city, state: seller.state,
    publicPhone: formatPhone(phoneDigits(seller.publicPhone)),
    categories: seller.categories as SellerCategory[],
    transport: seller.hasOwnTransport ? "own" : "buyer",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const pendingRef = useRef(false);

  function clear(name: string) {
    setErrors((c) => {
      if (!c[name]) return c;
      const { [name]: _removed, ...rest } = c;
      return rest;
    });
    setFeedback(null);
  }

  function update<K extends keyof typeof values>(name: K, value: (typeof values)[K]) {
    setValues((c) => ({ ...c, [name]: value }));
    clear(name === "transport" ? "transport" : name);
  }

  function toggle(category: SellerCategory) {
    update("categories", values.categories.includes(category)
      ? values.categories.filter((c) => c !== category)
      : [...values.categories, category]);
  }

  function focusFirst(next: Record<string, string>) {
    const key = Object.keys(next)[0];
    requestAnimationFrame(() => {
      const el = key === "categories"
        ? document.querySelector<HTMLElement>("input[name='categories']")
        : document.getElementById(`seller-profile-${key}`);
      el?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const next = validateSellerProfile({ ...values, state: values.state });
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
        seller: {
          isHabilitado: true,
          farmName: values.farmName.trim().replace(/\s+/g, " "),
          bio: values.bio.trim(),
          city: values.city.trim(),
          state: values.state,
          publicPhone: toPhoneApi(values.publicPhone),
          categories: values.categories,
          hasOwnTransport: values.transport === "own",
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
    id: `seller-profile-${name}`, name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `seller-profile-${name}-error` : undefined,
  });
  const err = (name: string) => errors[name] && <p className="registration-field__error" id={`seller-profile-${name}-error`}>{errors[name]}</p>;

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={saving} className="profile__form">
      <fieldset className="registration__fields" disabled={saving}>
        <legend className="sr-only">Vitrine pública do produtor. Campos com asterisco são obrigatórios.</legend>
        <p className="corporate__hint">Estas informações aparecem publicamente para os compradores. O endereço físico exato e o telefone privado da conta não são exibidos.</p>

        <div className="registration-field">
          <label htmlFor="seller-profile-farmName">Nome da propriedade / fazenda <span aria-hidden="true">*</span></label>
          <input {...ctl("farmName")} type="text" maxLength={150} autoComplete="off" value={values.farmName} onChange={(e) => update("farmName", e.target.value)} />
          {err("farmName")}
        </div>
        <div className="registration-field">
          <label htmlFor="seller-profile-bio">Sobre o produtor</label>
          <textarea {...ctl("bio")} rows={5} maxLength={SELLER_BIO_LIMIT} value={values.bio}
            placeholder="Conte sobre a tradição da colheita, manejo, certificações e histórico da produção."
            onChange={(e) => update("bio", e.target.value)} />
          <p className="corporate__hint" aria-live="polite">{values.bio.length}/{SELLER_BIO_LIMIT} caracteres</p>
          {err("bio")}
        </div>
        <div className="corporate__row">
          <div className="registration-field">
            <label htmlFor="seller-profile-city">Cidade <span aria-hidden="true">*</span></label>
            <input {...ctl("city")} type="text" maxLength={80} autoComplete="off" value={values.city} onChange={(e) => update("city", e.target.value)} />
            {err("city")}
          </div>
          <div className="registration-field">
            <label htmlFor="seller-profile-state">UF <span aria-hidden="true">*</span></label>
            <select {...ctl("state")} value={values.state} onChange={(e) => update("state", e.target.value)}>
              <option value="">UF</option>
              {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {err("state")}
          </div>
        </div>
        <div className="registration-field">
          <label htmlFor="seller-profile-publicPhone">Telefone comercial público (WhatsApp)</label>
          <input {...ctl("publicPhone")} type="tel" maxLength={15} autoComplete="off" placeholder="(19) 99999-9999"
            value={values.publicPhone} onChange={(e) => update("publicPhone", formatPhone(e.target.value))} aria-describedby={errors.publicPhone ? "seller-profile-publicPhone-error" : "seller-profile-publicPhone-hint"} />
          <p className="corporate__hint" id="seller-profile-publicPhone-hint">Separado do telefone privado de recuperação da conta.</p>
          {err("publicPhone")}
        </div>

        <fieldset className="seller-upgrade__group" aria-describedby={errors.categories ? "seller-profile-categories-error" : undefined}>
          <legend className="seller-upgrade__section">Culturas atendidas</legend>
          <div className="seller-upgrade__chips">
            {sellerCategories.map((c) => (
              <label key={c.value} className="seller-upgrade__chip">
                <input type="checkbox" name="categories" value={c.value} checked={values.categories.includes(c.value)}
                  aria-invalid={Boolean(errors.categories)} onChange={() => toggle(c.value)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          {err("categories")}
        </fieldset>

        <fieldset className="seller-upgrade__group">
          <legend className="seller-upgrade__section">Logística operacional</legend>
          {([["own", "Possuo transporte próprio para entrega da carga"], ["buyer", "Frete por conta do comprador / transportadora terceirizada"]] as const).map(([value, label]) => (
            <label key={value} className="seller-upgrade__radio">
              <input type="radio" name="transport" value={value} checked={values.transport === value} onChange={() => update("transport", value)} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <button className="button registration__submit" type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar vitrine"}
        </button>
      </fieldset>
      <div aria-live="polite" aria-atomic="true">
        {feedback && <p className={`registration__feedback ${feedback.kind === "error" ? "registration__feedback--error" : ""}`}>{feedback.text}</p>}
      </div>
    </form>
  );
}
