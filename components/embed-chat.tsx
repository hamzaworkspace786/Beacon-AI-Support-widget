"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Send, Square, X } from "lucide-react";
import { BotAvatar } from "@/components/bot-avatar";
import { AnswerText, Chip, citedSources } from "@/components/chat-answer";
import { CHAT_MAX_MESSAGE_CHARS } from "@/lib/constants";
import { readableTextColor } from "@/lib/color";
import { useBotChat } from "@/lib/use-bot-chat";
import { isValidVisitorId } from "@/lib/widget/rules";

// The chat window a customer sees. It is served by Beacon and shown inside an
// iframe on the customer's website, so nothing here runs inside their page.
//
// The visitor id is made once in this browser and kept in localStorage. It keeps
// a visitor's conversation apart from everyone else's and brings it back after a
// reload. Where the browser blocks storage, the id lasts only until the page closes.

function readOrCreateVisitorId(publicId: string): string {
  if (typeof window === "undefined") return ""; // the server draws the page once, without it
  const key = `beacon_visitor_${publicId}`;
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(key);
  } catch {
    // Storage is blocked.
  }
  if (!isValidVisitorId(id)) {
    id = crypto.randomUUID();
    try {
      window.localStorage.setItem(key, id);
    } catch {
      // Storage is blocked. The id still works for this visit.
    }
  }
  return id;
}

// Tell the widget script on the customer's page to close the window.
function askParentToClose() {
  window.parent.postMessage({ source: "beacon", type: "close" }, "*");
}

export function EmbedChat({
  publicId,
  name,
  greeting,
  color,
}: {
  publicId: string;
  name: string;
  greeting: string;
  color: string;
}) {
  const [visitorId] = useState(() => readOrCreateVisitorId(publicId));
  const { turns, history, busy, load, retryLoad, ask, stop, clear } = useBotChat(
    `/api/widget/${publicId}/chat`,
    visitorId,
  );
  const [draft, setDraft] = useState("");
  const [clearError, setClearError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const textColor = readableTextColor(color);

  // Bring back this visitor's earlier conversation.
  useEffect(() => {
    if (visitorId) void load();
  }, [load, visitorId]);

  // Keep the newest words in view while an answer streams in.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [turns]);

  function submit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!draft.trim() || busy || history !== "loaded") return;
    const text = draft;
    setDraft("");
    setClearError("");
    void ask(text);
  }

  async function startOver() {
    setClearError("");
    const problem = await clear();
    if (problem) setClearError(problem);
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface">
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-3.5"
        style={{ background: color, color: textColor }}
      >
        <BotAvatar color={color} foreground={textColor} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{name}</p>
          <p className="text-xs leading-tight">Answers from our information</p>
        </div>
        <button
          type="button"
          onClick={startOver}
          disabled={busy || turns.length === 0}
          aria-label="Start a new conversation"
          title="Start over"
          className="grid h-9 w-9 place-items-center rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={askParentToClose}
          aria-label="Close chat"
          title="Close"
          className="grid h-9 w-9 place-items-center rounded-lg transition-opacity hover:opacity-80"
        >
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        className="flex-1 space-y-3 overflow-y-auto bg-canvas px-4 py-4"
      >
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
          {greeting}
        </div>

        {history === "failed" && (
          <div className="text-sm">
            <p className="text-danger">Couldn&rsquo;t load your earlier messages.</p>
            <button
              type="button"
              onClick={retryLoad}
              className="mt-1 font-semibold text-brand underline-offset-4 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {turns.map((turn) => {
          if (turn.role === "user") {
            return (
              <div
                key={turn.id}
                className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed"
                style={{ background: color, color: textColor }}
              >
                {turn.content}
              </div>
            );
          }

          const cited = citedSources(turn);
          return (
            <div key={turn.id} className="max-w-[92%] space-y-1.5">
              <div className="rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                <AnswerText turn={turn} />
                {turn.state === "error" && (
                  <p role="alert" className="mt-2 text-danger">
                    {turn.error}
                  </p>
                )}
              </div>
              {cited.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted">
                  <span>Sources:</span>
                  {cited.map((source) => (
                    <span key={source.n} className="inline-flex items-center">
                      <Chip n={source.n} />
                      <span className="ml-0.5">{source.title}</span>
                    </span>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-line bg-surface p-3">
        <div className="flex items-end gap-2">
          <label htmlFor="embed-question" className="sr-only">
            Type your question
          </label>
          <textarea
            id="embed-question"
            rows={1}
            maxLength={CHAT_MAX_MESSAGE_CHARS}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Type your question"
            disabled={history !== "loaded"}
            className="min-h-11 max-h-28 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-sunken disabled:opacity-70"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop answering"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line bg-surface transition-colors hover:bg-sunken"
            >
              <Square size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim() || history !== "loaded"}
              aria-label="Send"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: color, color: textColor }}
            >
              <Send size={17} aria-hidden="true" />
            </button>
          )}
        </div>
        <p role="alert" aria-live="polite" className="min-h-4 text-xs text-danger">
          {clearError}
        </p>
        <p className="text-center text-[11px] text-muted">Powered by Beacon</p>
      </form>
    </div>
  );
}
