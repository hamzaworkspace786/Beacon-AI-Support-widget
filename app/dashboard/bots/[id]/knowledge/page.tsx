import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BotHeader } from "@/components/bot-header";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { KnowledgeManager } from "@/components/knowledge-manager";
import { getBot } from "@/lib/bots/store";
import { listSources } from "@/lib/knowledge/store";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Knowledge" };

// Same ownership rule as the settings page: only your own bot is ever shown.
async function KnowledgeContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser({ fresh: true });
  const bot = await getBot(user.id, id);
  if (!bot) notFound();

  const sources = await listSources(user.id, bot.id);

  return (
    <AppShell user={user}>
      <BotHeader bot={bot} active="knowledge" />
      <KnowledgeManager botId={bot.id} initialSources={sources} />
    </AppShell>
  );
}

export default function KnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <KnowledgeContent params={params} />
    </Suspense>
  );
}
