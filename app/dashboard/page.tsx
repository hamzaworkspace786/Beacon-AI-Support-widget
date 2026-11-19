import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { BotList } from "@/components/bot-list";
import { CreateBotForm } from "@/components/create-bot-form";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { listBots } from "@/lib/bots/store";
import { MAX_BOTS_PER_USER } from "@/lib/constants";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your bots" };

// Reads the signed-in user and their bots, so it must sit inside <Suspense>
// (the Cache Components rule). The skeleton shows while it loads.
async function DashboardContent() {
  const user = await requireUser({ fresh: true });
  const bots = await listBots(user.id);

  return (
    <AppShell user={user}>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Your bots</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
        Each bot is a chat assistant for one website. You can have up to {MAX_BOTS_PER_USER}.
      </p>

      <section
        aria-label="Create a bot"
        className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold">New bot</h2>
        <CreateBotForm atLimit={bots.length >= MAX_BOTS_PER_USER} limit={MAX_BOTS_PER_USER} />
      </section>

      <div className="mt-8">
        <BotList bots={bots} />
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
