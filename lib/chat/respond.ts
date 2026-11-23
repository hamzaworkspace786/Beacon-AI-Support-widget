import "server-only";
import { NextResponse } from "next/server";
import { retrievalQuery, streamAnswer, type ChatExcerpt } from "@/lib/ai/chat";
import { AiError, ChatError, chatUserMessage } from "@/lib/ai/errors";
import {
  CHAT_BEST_SCORE_HEADER,
  CHAT_OUTCOME_HEADER,
  CHAT_SOURCES_HEADER,
} from "@/lib/constants";
import type { ChatMessage, ChatOutcome, SourceRef } from "@/lib/types";
import { NO_MATCH_ANSWER } from "./fallback";
import { NoKnowledgeError, searchBot } from "./search";
import { appendChatTurn } from "./store";

// Answering one question: find the passages, decide whether anything matched,
// stream the answer, save the turn. The owner's Playground and the public widget
// both call this, so there is one place to improve answers.
//
// The caller has already checked who is asking, that the bot may answer, and the
// fair-use limits. This only does the answering.

export interface AnswerInput {
  /** The bot's owner. The bot's knowledge is looked up under this id. */
  ownerId: string;
  bot: { id: string; name: string; businessName: string };
  /** Which conversation the turn is saved in, like "visitor:<id>". */
  conversationKey: string;
  /** The conversation so far, ending with the new question (already checked). */
  messages: ChatMessage[];
  signal: AbortSignal;
  /** Decides how some messages are worded: an owner can be told what to fix. */
  audience: "owner" | "visitor";
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// The sources an answer may cite travel in a header, as URL-encoded JSON.
function answerHeaders(outcome: ChatOutcome, sources: SourceRef[], bestScore: number) {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    [CHAT_OUTCOME_HEADER]: outcome,
    [CHAT_SOURCES_HEADER]: encodeURIComponent(JSON.stringify(sources)),
    [CHAT_BEST_SCORE_HEADER]: String(Math.round(bestScore * 100) / 100),
  };
}

export async function answerQuestion(input: AnswerInput): Promise<Response> {
  const { ownerId, bot, conversationKey, messages, signal, audience } = input;
  const question = messages[messages.length - 1].content;

  // 1. Find the passages closest in meaning to the question.
  let selection;
  try {
    selection = await searchBot(ownerId, bot.id, retrievalQuery(messages));
  } catch (error) {
    if (error instanceof NoKnowledgeError) {
      return errorResponse(
        audience === "owner" ? error.message : "This assistant isn't ready yet.",
        409,
      );
    }
    console.error("Finding passages for a question failed:", error);
    if (error instanceof AiError) return errorResponse(chatUserMessage(error), 503);
    return errorResponse("Something went wrong while answering. Try again.", 500);
  }

  // 2. Nothing matched closely enough. Say so, without calling the AI at all.
  if (selection.passages.length === 0) {
    try {
      await appendChatTurn({
        userId: ownerId,
        botId: bot.id,
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
    { signal },
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
        userId: ownerId,
        botId: bot.id,
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
