export function Avatar({ name, url, size = 40, className = "" }: {
  name?: string;
  url?: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (url) {
    return <img className={`avatar ${className}`} style={style} src={url} alt={name ? `Foto de ${name}` : ""} />;
  }
  // Silhueta neutra (cabeça e torso) para contas sem foto.
  return (
    <span className={`avatar avatar--neutral ${className}`} style={style} role="img" aria-label={name ? `Avatar de ${name}` : "Avatar"}>
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
        <circle cx="20" cy="15" r="6.5" fill="currentColor" />
        <path d="M7 36c0-7.5 5.8-12 13-12s13 4.5 13 12Z" fill="currentColor" />
      </svg>
    </span>
  );
}
