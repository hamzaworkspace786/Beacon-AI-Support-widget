import { NextResponse } from "next/server";
import { parseMessages, retrievalQuery, streamAnswer, type ChatExcerpt } from "@/lib/ai/chat";
import { isEmbeddingConfigured } from "@/lib/ai/embedding-model";
import { ChatError, EmbeddingError, chatUserMessage, userMessage } from "@/lib/ai/errors";
import { getBot } from "@/lib/bots/store";
import { NO_MATCH_ANSWER } from "@/lib/chat/fallback";
import { NoKnowledgeError, searchBot } from "@/lib/chat/search";
import { appendChatTurn, clearMessages, getMessages, playgroundKey } from "@/lib/chat/store";
import {
  CHAT_BEST_SCORE_HEADER,
  CHAT_OUTCOME_HEADER,
  CHAT_SOURCES_HEADER,
} from "@/lib/constants";
import { countReadySources } from "@/lib/knowledge/store";
import { limitResponse } from "@/lib/limit-response";
import { getUserOrNull } from "@/lib/session";
import type { ChatOutcome, SourceRef } from "@/lib/types";
import { consume } from "@/lib/usage";

// An answer streams for up to CHAT_TOTAL_TIMEOUT_MS, plus the search before it.
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// The sources an answer may cite travel in a header, as URL-encoded JSON.
function encodeSources(sources: SourceRef[]) {
  return encodeURIComponent(JSON.stringify(sources));
}

function answerHeaders(outcome: ChatOutcome, sources: SourceRef[], bestScore: number) {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    [CHAT_OUTCOME_HEADER]: outcome,
    [CHAT_SOURCES_HEADER]: encodeSources(sources),
    [CHAT_BEST_SCORE_HEADER]: String(Math.round(bestScore * 100) / 100),
  };
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
  const { messages } = parsed;
  const question = messages[messages.length - 1].content;

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
    return errorResponse("This bot has no knowledge yet. Add a source in the Knowledge tab first.", 409);
  }

  // The question is valid and the bot is the person's. From here on it costs AI
  // calls, so it counts toward their, the bot's and the site's allowance.
  const usage = await consume(user.id, "question", { botId: bot.id });
  if (!usage.ok) return limitResponse(usage);

  // 1. Find the passages closest in meaning to the question.
  let selection;
  try {
    selection = await searchBot(user.id, bot.id, retrievalQuery(messages));
  } catch (error) {
    if (error instanceof NoKnowledgeError) return errorResponse(error.message, 409);
    console.error("Finding passages for a question failed:", error);
    if (error instanceof EmbeddingError) return errorResponse(userMessage(error), 503);
    return errorResponse("Something went wrong while answering. Try again.", 500);
  }

  const conversationKey = playgroundKey(user.id);
  const userId = user.id;
  const botId = bot.id;

  // 2. Nothing matched closely enough. Say so, without calling the AI at all.
  if (selection.passages.length === 0) {
    try {
      await appendChatTurn({
        userId,
        botId,
        conversationKey,
        question,
        answer: NO_MATCH_ANSWER,
        outcome: "no_match",
        sources: [],
      });
    } catch (error) {
      console.error("Could not save a chat turn:", error);
    }
    return new Response(NO_MATCH_ANSWER, {
      headers: answerHeaders("no_match", [], selection.bestScore),
    });
  }

  const sourceRefs: SourceRef[] = selection.sources.map((source) => ({
    n: source.n,
    sourceId: source.sourceId,
    title: source.title,
    score: Math.round(source.score * 100) / 100,
  }));
  const excerpts: ChatExcerpt[] = selection.passages.map((passage) => ({
    source: passage.source,
    title: passage.title,
    page: passage.page,
    text: passage.text,
  }));

  // 3. Start the answer. We wait for the first words before replying, so a
  //    total failure can still come back as a clean error with a status code.
  const answer = streamAnswer(
    { botName: bot.name, businessName: bot.businessName, excerpts, messages },
    { signal: request.signal },
  );

  let first: IteratorResult<string>;
  try {
    first = await answer.next();
  } catch (error) {
    console.error("Answering a question failed:", error);
    if (error instanceof ChatError) {
      return errorResponse(chatUserMessage(error), error.kind === "bad_request" ? 400 : 503);
    }
    return errorResponse("Something went wrong while answering. Try again.", 500);
  }
  if (first.done) {
    // The reader went away before anything arrived. Nobody is listening.
    return new Response(null, { status: 204 });
  }

  const encoder = new TextEncoder();
  let answerText = first.value;

  // Save the question and what was answered, once. This runs when the answer
  // finishes, and also when the person presses Stop (the partial answer is kept,
  // the same as on their screen). It does not run when the answer failed.
  let finished = false;
  async function saveTurn() {
    if (finished) return;
    finished = true;
    if (!answerText.trim()) return;
    try {
      await appendChatTurn({
        userId,
        botId,
        conversationKey,
        question,
        answer: answerText,
        outcome: "answered",
        sources: sourceRefs,
      });
    } catch (error) {
      // The answer was shown; failing to save it must not turn it into an error.
      console.error("Could not save a chat turn:", error);
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(answerText));
    },
    async pull(controller) {
      try {
        const next = await answer.next();
        if (next.done) {
          await saveTurn();
          try {
            controller.close();
          } catch {
            // Already cancelled by the reader.
          }
        } else {
          answerText += next.value;
          controller.enqueue(encoder.encode(next.value));
        }
      } catch (error) {
        // Words have already been sent, so all we can do is end the stream with
        // an error. The browser keeps what it has and says the answer was cut off.
        // A failed answer is not saved.
        finished = true;
        console.error("A chat answer was cut off:", error);
        controller.error(error);
      }
    },
    async cancel() {
      await answer.return(undefined);
      await saveTurn();
    },
  });

  return new Response(stream, {
    headers: answerHeaders("answered", sourceRefs, selection.bestScore),
  });
}
