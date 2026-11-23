import { NextResponse } from "next/server";
import { parseMessages } from "@/lib/ai/chat";
import { isEmbeddingConfigured } from "@/lib/ai/embedding-model";
import { getBot } from "@/lib/bots/store";
import { answerQuestion } from "@/lib/chat/respond";
import { clearMessages, getMessages, playgroundKey } from "@/lib/chat/store";
import { countReadySources } from "@/lib/knowledge/store";
import { limitResponse } from "@/lib/limit-response";
import { getUserOrNull } from "@/lib/session";
import { consume } from "@/lib/usage";

// An answer streams for up to CHAT_TOTAL_TIMEOUT_MS, plus the search before it.
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// GET /api/bots/:id/chat: the owner's saved test conversation, oldest first.
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  const { id } = await params;
  const bot = await getBot(user.id, id);
  if (!bot) return errorResponse("Bot not found.", 404);

  const messages = await getMessages(user.id, bot.id, playgroundKey(user.id));
  return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
}

// DELETE /api/bots/:id/chat: forget the saved test conversation.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  const { id } = await params;
  const bot = await getBot(user.id, id);
  if (!bot) return errorResponse("Bot not found.", 404);

  await clearMessages(user.id, bot.id, playgroundKey(user.id));
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/bots/:id/chat: ask the bot a question as its owner (the Playground).
 * The body is { messages: [...] }, the conversation so far ending with the new
 * question. The answer streams back as plain text. The sources it may cite are in
 * the X-Beacon-Sources header. When it is complete, the question and answer are saved.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The question could not be read. Try again.", 400);
  }

  const parsed = parseMessages(body);
  if ("error" in parsed) return errorResponse(parsed.error, 400);

  if (!isEmbeddingConfigured()) {
    return errorResponse(
      "AI features aren't set up on this server yet. Add GOOGLE_GENERATIVE_AI_API_KEY to the environment and restart.",
      503,
    );
  }

  const { id } = await params;
  const bot = await getBot(user.id, id);
  if (!bot) return errorResponse("Bot not found.", 404);

  // Cheap check first: with nothing to search there is nothing to spend AI calls on.
  if ((await countReadySources(user.id, bot.id)) === 0) {
    return errorResponse(
      "This bot has no knowledge yet. Add a source in the Knowledge tab first.",
      409,
    );
  }

  // The question is valid and the bot is the person's. From here on it costs AI
  // calls, so it counts toward their, the bot's and the site's allowance.
  const usage = await consume(user.id, "question", { botId: bot.id });
  if (!usage.ok) return limitResponse(usage);

  return answerQuestion({
    ownerId: user.id,
    bot: { id: bot.id, name: bot.name, businessName: bot.businessName },
    conversationKey: playgroundKey(user.id),
    messages: parsed.messages,
    signal: request.signal,
    audience: "owner",
  });
}
