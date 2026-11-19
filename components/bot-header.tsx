import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BotTabs, type BotTab } from "@/components/bot-tabs";
import type { BotSummary } from "@/lib/types";

// The top of every page about one bot: breadcrumb, name, status and the tabs.
export function BotHeader({ bot, active }: { bot: BotSummary; active: BotTab }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/dashboard" className="transition-colors hover:text-ink">
          Bots
        </Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span className="truncate text-ink">{bot.name}</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{bot.name}</h1>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            bot.status === "active" ? "bg-ok-soft text-ok" : "bg-sunken text-muted"
          }`}
        >
          {bot.status === "active" ? "Active" : "Paused"}
        </span>
      </div>

      <BotTabs botId={bot.id} active={active} />
    </>
  );
}
