type IconName =
  | "back"
  | "mail"
  | "phone"
  | "lock"
  | "eye"
  | "eyeOff"
  | "arrow"
  | "menu"
  | "close"
  | "leaf"
  | "location"
  | "box"
  | "user"
  | "clock"
  | "chevron";

const paths: Record<IconName, string> = {
  back: "M19 12H5m6-6-6 6 6 6",
  mail: "M3 5h18v14H3ZM3 5l9 7 9-7",
  phone: "M7 3H3v4c0 8 6 14 14 14h4v-4l-5-2-2 2a14 14 0 0 1-7-7l2-2Z",
  lock: "M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  eyeOff: "m3 3 18 18M10 5c7-1 12 7 12 7s-1 3-4 5M6 6c-3 2-4 6-4 6s4 7 10 7c1 0 2 0 3-1M9 9a4 4 0 0 0 6 6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "m6 6 12 12M6 18 18 6",
  leaf: "M20 4C9 2 3 7 5 14c2 7 14 6 15-10ZM4 21 15 10",
  location:
    "M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  box: "m3 7 9-4 9 4v10l-9 4-9-4ZM3 7l9 4 9-4M12 11v10M7 5l10 5",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2",
  chevron: "m6 9 6 6 6-6",
};

export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
