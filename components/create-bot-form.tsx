"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { BOT_NAME_MAX } from "@/lib/constants";

export function CreateBotForm({ atLimit, limit }: { atLimit: boolean; limit: number }) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // "pending" covers the request. "navigating" covers the move to the new bot's page.
  // Both reset on their own. Next.js keeps this page alive in the background when you
  // leave it, so a flag that is never reset would still be stuck when you come back.
  const busy = pending || navigating;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "The bot could not be created. Try again.");
        setPending(false);
        return;
      }

      // Reset first, then navigate, so this form is clean if you return to it.
      const botId = data.bot.id as string;
      setPending(false);
      setName("");
      startNavigation(() => {
        router.push(`/dashboard/bots/${botId}`);
        router.refresh();
      });
    } catch {
      setError("The bot could not be created. Check your connection and try again.");
      setPending(false);
    }
  }

  if (atLimit) {
    return (
      <p className="rounded-xl border border-line bg-sunken px-4 py-3 text-sm text-muted">
        You&rsquo;re using all {limit} bots. Delete one to create another.
      </p>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="new-bot-name" className="sr-only">
            Bot name
          </label>
          <input
            id="new-bot-name"
            type="text"
            required
            maxLength={BOT_NAME_MAX}
            placeholder="Name your bot, for example ShopBot"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-sunken disabled:opacity-70"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[15px] font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-strong disabled:opacity-60"
        >
          <Plus size={17} aria-hidden="true" />
          {busy ? "Creating..." : "Create bot"}
        </button>
      </form>
      <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-sm text-danger">
        {error}
      </p>
    </div>
  );
}
