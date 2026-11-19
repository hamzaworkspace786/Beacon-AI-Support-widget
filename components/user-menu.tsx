"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : (parts[0]?.slice(0, 2) ?? email.slice(0, 2));
  return letters.toUpperCase();
}

// Always sits on the dark sidebar (and the dark mobile bar), so the colors are light.
// "compact" shows just the avatar and the sign-out button, for small screens.
export function UserMenu({
  name,
  email,
  compact = false,
}: {
  name: string;
  email: string;
  compact?: boolean;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-on-brand"
        aria-hidden="true"
      >
        {initials(name, email)}
      </span>
      {!compact && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight text-white">{name}</p>
          <p className="truncate text-xs leading-tight text-white/60">{email}</p>
        </div>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        aria-label="Sign out"
        title="Sign out"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
