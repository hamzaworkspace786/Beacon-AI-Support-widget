import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BotHeader } from "@/components/bot-header";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { Playground } from "@/components/playground";
import { getBot } from "@/lib/bots/store";
import { countReadySources } from "@/lib/knowledge/store";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Playground" };

// Same ownership rule as the other bot pages: only your own bot is ever shown.
async function PlaygroundContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser({ fresh: true });
  const bot = await getBot(user.id, id);
  if (!bot) notFound();

  const hasKnowledge = (await countReadySources(user.id, bot.id)) > 0;

  return (
    <AppShell user={user}>
      <BotHeader bot={bot} active="playground" />
      <Playground bot={bot} hasKnowledge={hasKnowledge} />
    </AppShell>
  );
}

export default function PlaygroundPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <PlaygroundContent params={params} />
    </Suspense>
  );
}
