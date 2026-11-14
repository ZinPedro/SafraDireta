import { Link } from "react-router-dom";
import farmImage from "../../../assets/images/farm-landscape.jpeg";
import { Avatar } from "../../../components/Avatar";
import { Icon } from "../../../components/Icon";
import { useAuth } from "../../../context/authContext";
import { routes } from "../../../data/site";
import { formatPhone, phoneDigits, sellerCategories } from "../profile";
import type { UserProfileData } from "../profile";

export function PublicPreviewTab({ profile }: { profile: UserProfileData }) {
  const { session } = useAuth();
  const seller = profile.seller;
  if (!seller) return null;
  const labels = sellerCategories.filter((c) => seller.categories.includes(c.value));
  const formattedPhone = seller.publicPhone ? formatPhone(phoneDigits(seller.publicPhone)) : null;

  return (
    <article className="profile-preview" aria-label="Prévia da vitrine pública">
      <p className="corporate__hint">É assim que os compradores veem seu cartão de produtor no mercado. As alterações aparecem aqui depois de salvas.</p>
      <Link
        to={routes.producerProfile(profile.account.id)}
        className="profile-preview__card"
        aria-label="Ver meu perfil público completo"
      >
        <img className="profile-preview__banner" src={seller.bannerUrl || farmImage} alt="" width="1200" height="320" />
        <div className="profile-preview__body">
          <div className="profile-preview__head">
            <Avatar url={session?.avatarUrl} name={profile.account.nome} size={72} className="profile-preview__avatar" />
            <div>
              <span className="profile-preview__badge"><Icon name="leaf" /> Produtor Habilitado</span>
              <h2>{seller.farmName || "Nome da propriedade"}</h2>
              <div className="profile-preview__meta">
                <p className="profile-preview__location"><Icon name="location" /> {seller.city && seller.state ? `${seller.city} — ${seller.state}` : "Localização não informada"}</p>
                {formattedPhone && (
                  <p className="profile-preview__location"><Icon name="phone" /> {formattedPhone}</p>
                )}
              </div>
            </div>
          </div>
          <h3>Sobre a fazenda</h3>
          <p>{seller.bio || "O produtor ainda não adicionou uma descrição."}</p>
          {labels.length > 0 && (
            <ul className="profile-preview__tags" aria-label="Culturas comercializadas">
              {labels.map((c) => <li key={c.value}>{c.label}</li>)}
            </ul>
          )}
          <span className="button registration__submit profile-preview__contact" aria-hidden="true">
            {formattedPhone ? `Falar com o produtor (${formattedPhone})` : "Falar com o produtor (simulado)"}
          </span>
        </div>
      </Link>
    </article>
  );
}
