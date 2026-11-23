import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BotHeader } from "@/components/bot-header";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { InstallPanel } from "@/components/install-panel";
import { getBot } from "@/lib/bots/store";
import { countReadySources } from "@/lib/knowledge/store";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Install" };

// Same ownership rule as the other bot pages: only your own bot is ever shown.
async function InstallContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser({ fresh: true });
  const bot = await getBot(user.id, id);
  if (!bot) notFound();

  const hasKnowledge = (await countReadySources(user.id, bot.id)) > 0;

  // The address this page is served from, so the code you copy points at the right place
  // (localhost while you test, your real address once it's deployed).
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : (process.env.BETTER_AUTH_URL ?? "");

  return (
    <AppShell user={user}>
      <BotHeader bot={bot} active="install" />
      <InstallPanel
        botId={bot.id}
        publicId={bot.publicId}
        origin={origin}
        allowedDomains={bot.allowedDomains}
        status={bot.status}
        hasKnowledge={hasKnowledge}
      />
    </AppShell>
  );
}

export default function InstallPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <InstallContent params={params} />
    </Suspense>
  );
}
