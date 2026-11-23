"use client";

import { useCallback, useRef, useState } from "react";
import {
  CHAT_BEST_SCORE_HEADER,
  CHAT_MAX_MESSAGE_CHARS,
  CHAT_OUTCOME_HEADER,
  CHAT_SOURCES_HEADER,
} from "./constants";
import type { ChatOutcome, SavedChatMessage, SourceRef } from "./types";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  // "streaming": words are still arriving. "done": finished (or stopped by the
  // person). "error": it failed; `content` holds whatever arrived before that.
  state: "streaming" | "done" | "error";
  error?: string;
  /** The sources this answer was allowed to cite. A citation of any other number is made up. */
  sources: SourceRef[];
  outcome?: ChatOutcome;
  /** How closely the best passage matched the question. Only known for answers from this session. */
  bestScore?: number;
}

export type HistoryState = "loading" | "loaded" | "failed";

const NETWORK_ERROR = "Couldn't reach Beacon. Check your connection and try again.";
const CUT_OFF_ERROR = "The answer was cut off. Ask again to get the whole thing.";

function parseSources(header: string | null): SourceRef[] {
  if (!header) return [];
  try {
    const value: unknown = JSON.parse(decodeURIComponent(header));
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is SourceRef =>
        typeof item?.n === "number" &&
        typeof item?.title === "string" &&
        typeof item?.score === "number",
    );
  } catch {
    return [];
  }
}

/**
 * A test or visitor conversation with one bot. Each finished answer is saved on
 * the server, and the saved conversation is loaded when the chat opens, so it
 * survives a refresh. Only one answer streams at a time.
 *
 * `endpoint` is the chat route: the owner's Playground uses /api/bots/:id/chat, and
 * the public widget uses /api/widget/:publicId/chat together with a visitor id.
 */
export function useBotChat(endpoint: string, visitorId?: string) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [history, setHistory] = useState<HistoryState>("loading");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const counter = useRef(0);

  /** Load the saved conversation. */
  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        headers: visitorId ? { "X-Beacon-Visitor": visitorId } : {},
      });
      const body = (await response.json().catch(() => null)) as {
        messages?: SavedChatMessage[];
      } | null;
      if (!response.ok || !body?.messages) throw new Error("Could not load the conversation.");

      const saved: ChatTurn[] = body.messages.map((message) => ({
        id: `saved-${message.id}`,
        role: message.role,
        content: message.content,
        state: "done",
        sources: message.sources,
        outcome: message.outcome,
      }));
      // If a conversation was already started here, keep that one.
      setTurns((current) => (current.length > 0 ? current : saved));
      setHistory("loaded");
    } catch {
      setHistory("failed");
    }
  }, [endpoint, visitorId]);

  function retryLoad() {
    setHistory("loading");
    void load();
  }

  function patch(turnId: string, change: Partial<ChatTurn>) {
    setTurns((current) =>
      current.map((turn) => (turn.id === turnId ? { ...turn, ...change } : turn)),
    );
  }

  async function ask(text: string) {
    const question = text.trim().slice(0, CHAT_MAX_MESSAGE_CHARS);
    if (!question || busy || history !== "loaded") return;

    const userTurn: ChatTurn = {
      id: `t${++counter.current}`,
      role: "user",
      content: question,
      state: "done",
      sources: [],
    };
    const answerTurn: ChatTurn = {
      id: `t${++counter.current}`,
      role: "assistant",
      content: "",
      state: "streaming",
      sources: [],
    };

    // The model sees every question that has a finished answer, with that
    // answer. A question whose answer failed is left out with it, so a half
    // answer never becomes part of the history.
    const earlier: { role: "user" | "assistant"; content: string }[] = [];
    for (let i = 0; i < turns.length - 1; i++) {
      const asked = turns[i];
      const answered = turns[i + 1];
      if (
        asked.role === "user" &&
        answered.role === "assistant" &&
        answered.state === "done" &&
        answered.content
      ) {
        earlier.push(
          { role: "user", content: asked.content },
          { role: "assistant", content: answered.content },
        );
      }
    }

    setTurns((current) => [...current, userTurn, answerTurn]);
    setBusy(true);

    const abort = new AbortController();
    controller.current = abort;
    let received = "";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(visitorId ? { "X-Beacon-Visitor": visitorId } : {}),
        },
        body: JSON.stringify({ messages: [...earlier, { role: "user", content: question }] }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        patch(answerTurn.id, {
          state: "error",
          error: body?.error ?? "Couldn't get an answer. Try again.",
        });
        return;
      }

      const best = Number(response.headers.get(CHAT_BEST_SCORE_HEADER));
      patch(answerTurn.id, {
        sources: parseSources(response.headers.get(CHAT_SOURCES_HEADER)),
        outcome:
          response.headers.get(CHAT_OUTCOME_HEADER) === "no_match" ? "no_match" : "answered",
        bestScore: Number.isFinite(best) ? best : undefined,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
        patch(answerTurn.id, { content: received });
      }
      received += decoder.decode();
      patch(answerTurn.id, { content: received, state: "done" });
    } catch {
      if (abort.signal.aborted) {
        // The person pressed Stop. What has arrived is a fine (shorter) answer.
        patch(answerTurn.id, { content: received, state: "done" });
      } else {
        patch(answerTurn.id, {
          content: received,
          state: "error",
          error: received ? CUT_OFF_ERROR : NETWORK_ERROR,
        });
      }
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }

  function stop() {
    controller.current?.abort();
  }

  /** Delete the conversation here and on the server. Resolves with null when it worked, or a message to show. */
  async function clear(): Promise<string | null> {
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: visitorId ? { "X-Beacon-Visitor": visitorId } : {},
      });
      if (!response.ok) return "Couldn't clear this conversation. Try again.";
    } catch {
      return "Couldn't clear this conversation. Check your connection and try again.";
    }
    setTurns([]);
    return null;
  }

  return { turns, history, busy, load, retryLoad, ask, stop, clear };
}

export type BotChat = ReturnType<typeof useBotChat>;
