import Link from "next/link";

export type BotTab = "settings" | "knowledge" | "playground" | "install";

// The section tabs on a bot's page. Settings, Knowledge, Playground and Install work
// now. Conversations is shown as "Soon" so the layout is ready for Phase 5.
const UPCOMING = ["Conversations"];

export function BotTabs({ botId, active }: { botId: string; active: BotTab }) {
  const tabs: { key: BotTab; label: string; href: string }[] = [
    { key: "settings", label: "Settings", href: `/dashboard/bots/${botId}` },
    { key: "knowledge", label: "Knowledge", href: `/dashboard/bots/${botId}/knowledge` },
    { key: "playground", label: "Playground", href: `/dashboard/bots/${botId}/playground` },
    { key: "install", label: "Install", href: `/dashboard/bots/${botId}/install` },
  ];

  return (
    <nav
      aria-label="Bot sections"
      className="mt-6 flex gap-1 overflow-x-auto border-b border-line"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 pb-3 text-sm transition-colors ${
            active === tab.key
              ? "border-brand font-semibold text-ink"
              : "border-transparent font-medium text-muted hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
      {UPCOMING.map((label) => (
        <span
          key={label}
          aria-disabled="true"
          className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap px-3 pb-3 text-sm text-muted/70"
        >
          {label}
          <span className="rounded-full bg-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Soon
          </span>
        </span>
      ))}
    </nav>
  );
}
