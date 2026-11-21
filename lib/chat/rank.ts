import { CHAT_EXCERPT_COUNT, MIN_RELEVANCE } from "../constants";
import { dot } from "../ai/vectors";

// Choosing which passages of a bot's knowledge to show the model. Pure code
// with no database, so it can be tested on its own.

export interface CandidateChunk {
  sourceId: string;
  /** The source's title, shown to the model and to the person. */
  title: string;
  fileType?: string;
  page: number;
  text: string;
  /** Unit length, so a dot product is the cosine similarity. */
  embedding: Float32Array;
}

export interface RankedPassage {
  /** The number the answer uses to cite this passage's source, like [1]. */
  source: number;
  sourceId: string;
  title: string;
  /** Only for PDFs, which have real pages. */
  page?: number;
  text: string;
  score: number;
}

export interface RankedSource {
  n: number;
  sourceId: string;
  title: string;
  /** The best score among this source's passages. */
  score: number;
}

export interface Selection {
  /** Passages that matched closely enough, best first. Empty means "nothing matched". */
  passages: RankedPassage[];
  /** The sources those passages come from, numbered 1, 2, 3 in order of relevance. */
  sources: RankedSource[];
  /** The best score of any passage, even when it was too low to use. 0 if there were no passages. */
  bestScore: number;
}

/**
 * Compare a question with every passage of the bot and keep the best few.
 * A passage below `minScore` is dropped: it is better to say "I don't know"
 * than to build an answer on text that only looks vaguely related.
 */
export function selectPassages(
  query: Float32Array,
  chunks: CandidateChunk[],
  options: { limit?: number; minScore?: number } = {},
): Selection {
  const limit = options.limit ?? CHAT_EXCERPT_COUNT;
  const minScore = options.minScore ?? MIN_RELEVANCE;

  const scored = chunks
    .map((chunk) => ({ chunk, score: dot(query, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const bestScore = scored[0]?.score ?? 0;
  const kept = scored.filter((item) => item.score >= minScore);

  const numbers = new Map<string, number>();
  const sources: RankedSource[] = [];
  const passages: RankedPassage[] = [];

  for (const { chunk, score } of kept) {
    let n = numbers.get(chunk.sourceId);
    if (n === undefined) {
      // The first passage of a source is its best one, because the list is sorted.
      n = numbers.size + 1;
      numbers.set(chunk.sourceId, n);
      sources.push({ n, sourceId: chunk.sourceId, title: chunk.title, score });
    }
    passages.push({
      source: n,
      sourceId: chunk.sourceId,
      title: chunk.title,
      page: chunk.fileType === "pdf" ? chunk.page : undefined,
      text: chunk.text,
      score,
    });
  }

  return { passages, sources, bestScore };
}
