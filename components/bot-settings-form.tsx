"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Trash2 } from "lucide-react";
import { BotPreview } from "@/components/bot-preview";
import {
  BOT_NAME_MAX,
  BUSINESS_NAME_MAX,
  DEFAULT_BOT_COLOR,
  GREETING_MAX,
  MAX_ALLOWED_DOMAINS,
} from "@/lib/constants";
import type { BotStatus, BotSummary } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-sunken disabled:opacity-70";
const labelClass = "mb-1.5 block text-sm font-medium";
const hintClass = "mt-1.5 text-sm text-muted";

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export function BotSettingsForm({ bot }: { bot: BotSummary }) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [name, setName] = useState(bot.name);
  const [businessName, setBusinessName] = useState(bot.businessName);
  const [greeting, setGreeting] = useState(bot.greeting);
  const [color, setColor] = useState(bot.color);
  const [domains, setDomains] = useState(bot.allowedDomains.join("\n"));
  const [status, setStatus] = useState<BotStatus>(bot.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const busy = saving || deleting || navigating;
  // The picker and the preview only use a color once it is a complete, valid hex value.
  const colorForPicker = COLOR_PATTERN.test(color) ? color : DEFAULT_BOT_COLOR;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch(`/api/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          businessName,
          greeting,
          color,
          status,
          allowedDomains: domains
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "Your changes could not be saved. Try again.");
        return;
      }

      // Show the cleaned-up values the server stored (for example, bare domains).
      const saved = data.bot as BotSummary;
      setName(saved.name);
      setBusinessName(saved.businessName);
      setGreeting(saved.greeting);
      setColor(saved.color);
      setDomains(saved.allowedDomains.join("\n"));
      setStatus(saved.status);
      setMessage("Saved.");
      router.refresh();
    } catch {
      setError("Your changes could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    const confirmed = window.confirm(`Delete "${bot.name}"? This can't be undone.`);
    if (!confirmed) return;

    setError("");
    setMessage("");
    setDeleting(true);

    try {
      const response = await fetch(`/api/bots/${bot.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "The bot could not be deleted. Try again.");
        setDeleting(false);
        return;
      }
      // Reset before navigating so nothing stays stuck if this page is kept alive.
      setDeleting(false);
      startNavigation(() => {
        router.replace("/dashboard");
        router.refresh();
      });
    } catch {
      setError("The bot could not be deleted. Check your connection and try again.");
      setDeleting(false);
    }
  }

  async function copyPublicId() {
    try {
      await navigator.clipboard.writeText(bot.publicId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked. The id is selectable on screen anyway.
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
      <div className="space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          <Section title="Identity" description="Who the bot is and who it speaks for.">
            <div>
              <label htmlFor="bot-name" className={labelClass}>
                Bot name
              </label>
              <input
                id="bot-name"
                type="text"
                required
                maxLength={BOT_NAME_MAX}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
                className={inputClass}
              />
              <p className={hintClass}>Shown at the top of the chat window.</p>
            </div>
            <div>
              <label htmlFor="business-name" className={labelClass}>
                Business name
              </label>
              <input
                id="business-name"
                type="text"
                maxLength={BUSINESS_NAME_MAX}
                placeholder="For example Okara Fresh Foods"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                disabled={busy}
                className={inputClass}
              />
              <p className={hintClass}>The bot speaks on behalf of this business.</p>
            </div>
          </Section>

          <Section title="Chat window" description="What visitors see when they open the chat.">
            <div>
              <label htmlFor="greeting" className={labelClass}>
                Greeting
              </label>
              <textarea
                id="greeting"
                required
                rows={2}
                maxLength={GREETING_MAX}
                value={greeting}
                onChange={(event) => setGreeting(event.target.value)}
                disabled={busy}
                className={`${inputClass} resize-y`}
              />
              <p className={hintClass}>The first message visitors see.</p>
            </div>
            <div>
              <label htmlFor="color-hex" className={labelClass}>
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Pick a color"
                  value={colorForPicker}
                  onChange={(event) => setColor(event.target.value)}
                  disabled={busy}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-surface p-1 disabled:opacity-60"
                />
                <input
                  id="color-hex"
                  type="text"
                  maxLength={7}
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  disabled={busy}
                  spellCheck={false}
                  className={`${inputClass} max-w-40 font-mono`}
                />
              </div>
              <p className={hintClass}>
                Used for the chat header and buttons. The text color adjusts so it stays
                readable.
              </p>
            </div>
          </Section>

          <Section title="Where it runs" description="Control where the bot appears and whether it answers.">
            <div>
              <label htmlFor="domains" className={labelClass}>
                Allowed websites
              </label>
              <textarea
                id="domains"
                rows={4}
                value={domains}
                onChange={(event) => setDomains(event.target.value)}
                disabled={busy}
                placeholder={"shop.example.com\n*.example.org"}
                spellCheck={false}
                className={`${inputClass} resize-y font-mono text-sm`}
              />
              <p className={hintClass}>
                One per line, up to {MAX_ALLOWED_DOMAINS}. Use *.example.com to allow every
                subdomain, and add localhost while testing. The chat bubble only appears on
                these sites.
              </p>
            </div>
            <fieldset>
              <legend className={labelClass}>Status</legend>
              <div className="inline-flex rounded-lg bg-sunken p-1">
                {(["active", "paused"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(option)}
                    aria-pressed={status === option}
                    disabled={busy}
                    className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                      status === option
                        ? "bg-surface text-ink shadow-sm"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {option === "active" ? "Active" : "Paused"}
                  </button>
                ))}
              </div>
              <p className={hintClass}>A paused bot keeps its settings but stops answering.</p>
            </fieldset>
          </Section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand px-5 py-2.5 text-[15px] font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-strong disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <p role="status" aria-live="polite" className="text-sm font-medium text-ok">
              {message}
            </p>
          </div>
          <p role="alert" aria-live="polite" className="min-h-5 text-sm text-danger">
            {error}
          </p>
        </form>

        <section className="rounded-2xl border border-danger/30 bg-danger-soft/50 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-danger">Delete this bot</h2>
          <p className="mt-1 text-sm text-muted">
            Removes the bot and its settings for good. This can&rsquo;t be undone.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-surface px-3.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
          >
            <Trash2 size={15} aria-hidden="true" />
            {deleting || navigating ? "Deleting..." : "Delete bot"}
          </button>
        </section>
      </div>

      <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
        <div>
          <p className="mb-2 text-sm font-medium">Live preview</p>
          <BotPreview name={name} greeting={greeting} color={colorForPicker} />
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-sm font-medium">Bot ID</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-sunken px-2.5 py-1.5 font-mono text-xs">
              {bot.publicId}
            </code>
            <button
              type="button"
              onClick={copyPublicId}
              aria-label="Copy bot ID"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line transition-colors hover:bg-sunken"
            >
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">
            This is the public ID your website&rsquo;s embed code uses. You&rsquo;ll find the
            ready-made embed code in the Install tab.
          </p>
        </div>
      </aside>
    </div>
  );
}
