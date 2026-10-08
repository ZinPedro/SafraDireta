import farmImage from "../../../assets/images/farm-landscape.jpeg";
import { Avatar } from "../../../components/Avatar";
import { Icon } from "../../../components/Icon";
import { useAuth } from "../../../context/authContext";
import { sellerCategories } from "../profile";
import type { UserProfileData } from "../profile";

export function PublicPreviewTab({ profile }: { profile: UserProfileData }) {
  const { session } = useAuth();
  const seller = profile.seller;
  if (!seller) return null;
  const labels = sellerCategories.filter((c) => seller.categories.includes(c.value));

  return (
    <article className="profile-preview" aria-label="Prévia da vitrine pública">
      <p className="corporate__hint">É assim que os compradores veem seu cartão de produtor no mercado. As alterações aparecem aqui depois de salvas.</p>
      <div className="profile-preview__card">
        <img className="profile-preview__banner" src={farmImage} alt="" width="1200" height="320" />
        <div className="profile-preview__body">
          <div className="profile-preview__head">
            <Avatar url={session?.avatarUrl} name={profile.account.nome} size={72} className="profile-preview__avatar" />
            <div>
              <span className="profile-preview__badge"><Icon name="leaf" /> Produtor Habilitado</span>
              <h2>{seller.farmName || "Nome da propriedade"}</h2>
              <p className="profile-preview__location"><Icon name="location" /> {seller.city && seller.state ? `${seller.city} — ${seller.state}` : "Localização não informada"}</p>
            </div>
          </div>
          <h3>Sobre a fazenda</h3>
          <p>{seller.bio || "O produtor ainda não adicionou uma descrição."}</p>
          {labels.length > 0 && (
            <ul className="profile-preview__tags" aria-label="Culturas comercializadas">
              {labels.map((c) => <li key={c.value}>{c.label}</li>)}
            </ul>
          )}
          <button type="button" className="button registration__submit profile-preview__contact" disabled aria-disabled="true">
            Falar com o produtor (simulado)
          </button>
        </div>
      </div>
    </article>
  );
}
