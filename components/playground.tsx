"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, RotateCcw, Send, Square } from "lucide-react";
import { CHAT_MAX_MESSAGE_CHARS, MIN_RELEVANCE } from "@/lib/constants";
import { cleanAnswerText, splitCitations, validSources } from "@/lib/chat/citations";
import { readableTextColor } from "@/lib/color";
import { useBotChat, type ChatTurn } from "@/lib/use-bot-chat";
import type { BotSummary } from "@/lib/types";

const STARTERS = [
  "What does this business offer?",
  "What are your opening hours?",
  "How do returns work?",
];

const percent = (score: number) => `${Math.round(score * 100)}%`;

function Chip({ n, title }: { n: number; title?: string }) {
  return (
    <span
      title={title}
      aria-label={title ? `Source ${n}: ${title}` : `Source ${n}`}
      className="mx-0.5 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-soft px-1 align-baseline text-[11px] font-semibold text-brand"
    >
      {n}
    </span>
  );
}

// The answer, with each [1] marker turned into a small numbered chip. A number
// the model was never shown is dropped: it was made up.
function AnswerText({ turn }: { turn: ChatTurn }) {
  if (!turn.content) {
    return turn.state === "streaming" ? <span className="text-muted">Thinking...</span> : null;
  }

  const allowed = turn.sources.map((source) => source.n);
  const titles = new Map(turn.sources.map((source) => [source.n, source.title]));
  const segments = splitCitations(cleanAnswerText(turn.content), turn.state === "streaming");

  return (
    <p className="whitespace-pre-wrap">
      {segments.map((segment, i) =>
        segment.type === "text" ? (
          <span key={i}>{segment.text}</span>
        ) : (
          validSources(segment.sources, allowed).map((n) => (
            <Chip key={`${i}-${n}`} n={n} title={titles.get(n)} />
          ))
        ),
      )}
    </p>
  );
}

// Shows the owner what the bot based its answer on, and how closely each source
// matched. This is how you tune the match threshold and spot weak knowledge.
function HowItAnswered({ turn }: { turn: ChatTurn }) {
  const used = turn.sources;
  const summary =
    turn.outcome === "no_match"
      ? "nothing matched"
      : `${used.length} ${used.length === 1 ? "source" : "sources"} used`;

  return (
    <details className="group rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-muted [&::-webkit-details-marker]:hidden">
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="transition-transform group-open:rotate-180"
        />
        How it answered · {summary}
      </summary>

      <div className="mt-2 space-y-2">
        {turn.outcome === "no_match" ? (
          <p className="text-muted">
            No passage matched closely enough
            {turn.bestScore !== undefined
              ? ` (best match ${percent(turn.bestScore)}, ${percent(MIN_RELEVANCE)} needed)`
              : ""}
            . The AI was not called, so nothing could be made up.
          </p>
        ) : used.length === 0 ? (
          <p className="text-muted">No source details were saved for this answer.</p>
        ) : (
          <ul className="space-y-1.5">
            {used.map((source) => (
              <li key={source.n} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center">
                  <Chip n={source.n} />
                  <span className="ml-1.5 truncate">{source.title}</span>
                </span>
                <span className="shrink-0 text-muted">{percent(source.score)} match</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          A passage must match at least {percent(MIN_RELEVANCE)} to be used.
        </p>
      </div>
    </details>
  );
}

export function Playground({ bot, hasKnowledge }: { bot: BotSummary; hasKnowledge: boolean }) {
  const router = useRouter();
  const { turns, history, busy, load, retryLoad, ask, stop, clear } = useBotChat(bot.id);
  const [draft, setDraft] = useState("");
  const [clearError, setClearError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const textColor = readableTextColor(bot.color);

  // Load the saved test conversation when this page is shown.
  useEffect(() => {
    void load();
  }, [load]);

  // Keep the newest words in view while an answer streams in.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [turns]);

  if (!hasKnowledge) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold">This bot doesn&rsquo;t know anything yet</p>
        <p className="mx-auto mt-1.5 max-w-md text-[15px] leading-relaxed text-muted">
          Add a file or some text in the Knowledge tab and wait for it to say Ready. Then you can
          test the bot here.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/dashboard/bots/${bot.id}/knowledge`}
            className="inline-flex rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-strong"
          >
            Go to Knowledge
          </Link>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-sunken"
          >
            Check again
          </button>
        </div>
      </div>
    );
  }

  function submit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!draft.trim() || busy || history !== "loaded") return;
    const text = draft;
    setDraft("");
    setClearError("");
    void ask(text);
  }

  async function handleClear() {
    setClearError("");
    const problem = await clear();
    if (problem) setClearError(problem);
  }

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      {bot.status === "paused" && (
        <p className="mb-4 rounded-xl border border-line bg-sunken px-4 py-3 text-sm text-muted">
          This bot is paused, so visitors won&rsquo;t get answers. You can still test it here.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ background: bot.color, color: textColor }}
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold"
            style={{ background: textColor, color: bot.color }}
            aria-hidden="true"
          >
            {bot.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{bot.name}</p>
            <p className="text-xs leading-tight">Test chat, only you can see it</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={busy || turns.length === 0}
            aria-label="Clear this conversation"
            title="Clear this conversation"
            className="grid h-9 w-9 place-items-center rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            <RotateCcw size={17} aria-hidden="true" />
          </button>
        </div>

        <div
          ref={scroller}
          role="log"
          aria-live="polite"
          className="h-[28rem] space-y-3 overflow-y-auto bg-canvas px-4 py-4"
        >
          {history === "loading" && <p className="text-sm text-muted">Loading...</p>}

          {history === "failed" && (
            <div className="text-sm">
              <p className="text-danger">Couldn&rsquo;t load your earlier test chat.</p>
              <button
                type="button"
                onClick={retryLoad}
                className="mt-1 font-semibold text-brand underline-offset-4 hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {history === "loaded" && turns.length === 0 && (
            <>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                {bot.greeting}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => void ask(starter)}
                    disabled={busy}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm transition-colors hover:border-brand/40 hover:bg-brand-soft disabled:opacity-60"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </>
          )}

          {turns.map((turn) =>
            turn.role === "user" ? (
              <div
                key={turn.id}
                className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed"
                style={{ background: bot.color, color: textColor }}
              >
                {turn.content}
              </div>
            ) : (
              <div key={turn.id} className="max-w-[92%] space-y-2">
                <div className="rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                  <AnswerText turn={turn} />
                  {turn.state === "error" && (
                    <p role="alert" className="mt-2 text-danger">
                      {turn.error}
                    </p>
                  )}
                </div>
                {turn.state !== "streaming" && turn.content && <HowItAnswered turn={turn} />}
              </div>
            ),
          )}
        </div>

        <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
          <label htmlFor="playground-question" className="sr-only">
            Ask a question
          </label>
          <textarea
            id="playground-question"
            rows={2}
            maxLength={CHAT_MAX_MESSAGE_CHARS}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask a question"
            disabled={history !== "loaded"}
            className="min-h-11 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-sunken disabled:opacity-70"
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
              style={{ background: bot.color, color: textColor }}
            >
              <Send size={17} aria-hidden="true" />
            </button>
          )}
        </form>
        <p className="pb-2.5 text-center text-[11px] text-muted">Powered by Beacon</p>
      </div>

      <p role="alert" aria-live="polite" className="mt-2 min-h-5 text-sm text-danger">
        {clearError}
      </p>
      <p className="text-sm leading-relaxed text-muted">
        This is a private test chat. Open &ldquo;How it answered&rdquo; under a reply to see which
        sources were used and how closely they matched. If the bot declines questions it should
        answer, lower the match threshold; if it answers things it shouldn&rsquo;t, raise it. It
        is <code className="rounded bg-sunken px-1 font-mono text-xs">MIN_RELEVANCE</code> in{" "}
        <code className="rounded bg-sunken px-1 font-mono text-xs">lib/constants.ts</code>.
      </p>
    </div>
  );
}
