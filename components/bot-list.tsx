import Link from "next/link";
import { Bot, Globe } from "lucide-react";
import type { BotSummary } from "@/lib/types";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function BotList({ bots }: { bots: BotSummary[] }) {
  if (bots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
          <Bot size={22} aria-hidden="true" />
        </span>
        <p className="mt-4 font-display text-lg font-semibold">No bots yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-relaxed text-muted">
          A bot is the chat assistant for one website. Name your first one above to get started.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bots.map((bot) => {
        const sites = bot.allowedDomains.length;
        return (
          <li key={bot.id}>
            <Link
              href={`/dashboard/bots/${bot.id}`}
              className="group block overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
            >
              <div className="h-1.5" style={{ background: bot.color }} aria-hidden="true" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold">{bot.name}</p>
                    <p className="truncate text-sm text-muted">
                      {bot.businessName || "No business name yet"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      bot.status === "active"
                        ? "bg-ok-soft text-ok"
                        : "bg-sunken text-muted"
                    }`}
                  >
                    {bot.status === "active" ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Globe size={14} aria-hidden="true" />
                    {sites === 0 ? "No sites added" : `${sites} ${sites === 1 ? "site" : "sites"}`}
                  </span>
                  <span>Created {dateFormat.format(new Date(bot.createdAt))}</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
