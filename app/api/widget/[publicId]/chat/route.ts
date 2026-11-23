import { NextResponse } from "next/server";
import { parseMessages } from "@/lib/ai/chat";
import { isEmbeddingConfigured } from "@/lib/ai/embedding-model";
import { getBotForPublic } from "@/lib/bots/store";
import { answerQuestion } from "@/lib/chat/respond";
import { clearMessages, getMessages } from "@/lib/chat/store";
import { countReadySources } from "@/lib/knowledge/store";
import { limitResponse } from "@/lib/limit-response";
import { consume } from "@/lib/usage";
import { getClientIp, isOwnPage } from "@/lib/widget/request";
import { isValidVisitorId } from "@/lib/widget/rules";

// An answer streams for up to CHAT_TOTAL_TIMEOUT_MS, plus the search before it.
export const maxDuration = 120;

type RouteContext = { params: Promise<{ publicId: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

const visitorKey = (visitorId: string) => `visitor:${visitorId}`;

// These routes are called by the chat window (/embed/...) that Beacon itself serves
// inside a customer's page, so every call is same-origin. A visitor is identified by
// a random id the chat window makes in their browser and sends in X-Beacon-Visitor.
// Anyone can pick any id, so it only keeps one visitor's conversation apart from
// another's. It is not a login. What protects the AI allowance is the per-IP limits
// and the bot's daily cap in lib/usage.ts.

function checkRequest(request: Request) {
  if (!isOwnPage(request)) return errorResponse("This request isn't allowed.", 403);
  const visitorId = request.headers.get("x-beacon-visitor");
  if (!isValidVisitorId(visitorId)) {
    return errorResponse("Reload the chat and try again.", 400);
  }
  return visitorId;
}

// GET /api/widget/:publicId/chat: this visitor's saved conversation.
export async function GET(request: Request, { params }: RouteContext) {
  const visitorId = checkRequest(request);
  if (typeof visitorId !== "string") return visitorId;

  const { publicId } = await params;
  const bot = await getBotForPublic(publicId);
  if (!bot) return errorResponse("This chat isn't available.", 404);

  const messages = await getMessages(bot.ownerId, bot.id, visitorKey(visitorId));
  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

// DELETE /api/widget/:publicId/chat: the visitor starts over.
export async function DELETE(request: Request, { params }: RouteContext) {
  const visitorId = checkRequest(request);
  if (typeof visitorId !== "string") return visitorId;

  const { publicId } = await params;
  const bot = await getBotForPublic(publicId);
  if (!bot) return errorResponse("This chat isn't available.", 404);

  await clearMessages(bot.ownerId, bot.id, visitorKey(visitorId));
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/widget/:publicId/chat: a visitor asks the bot a question.
 * Same body and streaming answer as the owner's Playground.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const visitorId = checkRequest(request);
  if (typeof visitorId !== "string") return visitorId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Your message could not be read. Try again.", 400);
  }

  const parsed = parseMessages(body);
  if ("error" in parsed) return errorResponse(parsed.error, 400);

  const { publicId } = await params;
  const bot = await getBotForPublic(publicId);
  if (!bot) return errorResponse("This chat isn't available.", 404);
  if (bot.status !== "active") {
    return errorResponse("This assistant is currently unavailable.", 403);
  }

  // Visitors are told nothing about how Beacon is set up.
  if (!isEmbeddingConfigured()) {
    return errorResponse("This assistant isn't available right now.", 503);
  }
  if ((await countReadySources(bot.ownerId, bot.id)) === 0) {
    return errorResponse("This assistant isn't ready yet.", 409);
  }

  // From here on it costs AI calls, so it counts against this visitor, this
  // network address, the bot's daily cap and the whole site.
  const usage = await consume(bot.ownerId, "widget", {
    botId: bot.id,
    visitorId,
    ip: getClientIp(request),
  });
  if (!usage.ok) return limitResponse(usage);

  return answerQuestion({
    ownerId: bot.ownerId,
    bot: { id: bot.id, name: bot.name, businessName: bot.businessName },
    conversationKey: visitorKey(visitorId),
    messages: parsed.messages,
    signal: request.signal,
    audience: "visitor",
  });
}
