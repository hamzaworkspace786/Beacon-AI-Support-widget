import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmbedChat } from "@/components/embed-chat";
import { getBotForPublic } from "@/lib/bots/store";
import { countReadySources } from "@/lib/knowledge/store";
import { isFrameAllowed } from "@/lib/widget/rules";

// This page is the chat window. The widget script on a customer's website shows it
// inside an iframe. It must not be indexed by search engines.
export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <main className="grid h-dvh place-items-center bg-surface px-6">
      <div className="max-w-xs text-center">
        <p className="font-display text-lg font-semibold">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
      </div>
    </main>
  );
}

// Reads the request headers, so it must sit inside <Suspense> (Cache Components rule).
// It runs for every request: who may see the chat depends on which website asks.
async function EmbedContent({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  await connection();
  const requestHeaders = await headers();

  const bot = await getBotForPublic(publicId);
  if (!bot || bot.status !== "active") {
    return (
      <Notice
        title="Chat unavailable"
        text="This assistant isn't available right now. Please try again later."
      />
    );
  }

  // The browser tells us which website is framing this page (the Referer header),
  // and a web page can't forge it. Websites that aren't on the bot's list get a
  // notice instead of the chat. The chat's code and the bot's details are never sent.
  const allowed = isFrameAllowed(
    {
      referer: requestHeaders.get("referer"),
      secFetchSite: requestHeaders.get("sec-fetch-site"),
    },
    bot.allowedDomains,
  );
  if (!allowed) {
    return <Notice title="Chat unavailable" text="This chat isn't enabled for this website." />;
  }

  if ((await countReadySources(bot.ownerId, bot.id)) === 0) {
    return <Notice title="Chat unavailable" text="This assistant isn't ready yet." />;
  }

  return (
    <EmbedChat
      publicId={bot.publicId}
      name={bot.name}
      greeting={bot.greeting}
      color={bot.color}
    />
  );
}

export default function EmbedPage({ params }: { params: Promise<{ publicId: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh bg-surface" />}>
      <EmbedContent params={params} />
    </Suspense>
  );
}
