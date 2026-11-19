import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BotHeader } from "@/components/bot-header";
import { BotSettingsForm } from "@/components/bot-settings-form";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { getBot } from "@/lib/bots/store";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Bot settings" };

// getBot filters by the signed-in user's id, so opening another account's bot
// (or a made-up id) gives the same "not found" page. Nothing leaks.
async function BotContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser({ fresh: true });
  const bot = await getBot(user.id, id);
  if (!bot) notFound();

  return (
    <AppShell user={user}>
      <BotHeader bot={bot} active="settings" />
      <BotSettingsForm bot={bot} />
    </AppShell>
  );
}

export default function BotPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <BotContent params={params} />
    </Suspense>
  );
}
