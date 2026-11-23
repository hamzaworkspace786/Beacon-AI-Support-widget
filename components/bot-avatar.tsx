export function BotAvatar({
  color,
  foreground,
}: {
  color: string;
  foreground: string;
}) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
      style={{ background: foreground, color }}
      aria-hidden="true"
    >
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 7V5m-2.5 0h5M5 11a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5Zm0 2H3m16 0h2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9.5" cy="12.5" r="1" fill="currentColor" />
        <circle cx="14.5" cy="12.5" r="1" fill="currentColor" />
        <path d="M9 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="3.5" r="1.2" fill="currentColor" />
      </svg>
    </span>
  );
}
