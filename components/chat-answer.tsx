import { cleanAnswerText, splitCitations, validSources } from "@/lib/chat/citations";
import type { ChatTurn } from "@/lib/use-bot-chat";
import type { SourceRef } from "@/lib/types";

export function Chip({ n, title }: { n: number; title?: string }) {
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

/**
 * The answer, with each [1] marker turned into a small numbered chip. A number
 * the model was never shown is dropped: it was made up.
 */
export function AnswerText({ turn }: { turn: ChatTurn }) {
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

/** The sources an answer actually cites, in order, without repeats. */
export function citedSources(turn: ChatTurn): SourceRef[] {
  if (turn.state === "streaming" || !turn.content) return [];
  const allowed = turn.sources.map((source) => source.n);
  const cited = new Set<number>();
  for (const segment of splitCitations(cleanAnswerText(turn.content), false)) {
    if (segment.type === "cite") {
      for (const n of validSources(segment.sources, allowed)) cited.add(n);
    }
  }
  return turn.sources.filter((source) => cited.has(source.n));
}
