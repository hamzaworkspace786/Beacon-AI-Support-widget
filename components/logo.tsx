import { APP_NAME } from "@/lib/constants";

/** variant "dark" is for light backgrounds, "light" for the dark sidebar. */
export function Logo({
  variant = "dark",
  className = "",
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand shadow-sm"
        aria-hidden="true"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v8a2.5 2.5 0 0 1-2.5 2.5h-6.2L8 21.5v-4H5A2.5 2.5 0 0 1 2.5 15V7A2.5 2.5 0 0 1 5 4.5Z"
            fill="#ffffff"
          />
          <circle cx="8" cy="11" r="1.3" fill="#4f46e5" />
          <circle cx="12" cy="11" r="1.3" fill="#4f46e5" />
          <circle cx="16" cy="11" r="1.3" fill="#4f46e5" />
        </svg>
      </span>
      <span
        className={`font-display text-lg font-semibold tracking-tight ${
          variant === "light" ? "text-white" : "text-ink"
        }`}
      >
        {APP_NAME}
      </span>
    </span>
  );
}
