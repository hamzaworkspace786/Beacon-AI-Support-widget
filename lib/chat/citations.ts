// Turning the model's "[1]" markers into source chips. Pure functions, used by
// the browser, so keep server code out of this file.

export type AnswerSegment =
  | { type: "text"; text: string }
  | { type: "cite"; sources: number[] };

// [1]  [ 2 ]  [1, 2]  [1; 3]  [1 and 3]  [1 & 3]
const CITATION = /\[\s*(\d{1,2}(?:\s*(?:,|;|&|and)\s*\d{1,2})*)\s*\]/gi;

/**
 * Light cleanup for models that ignore "plain text only": removes bold
 * markers and heading marks and turns "* " bullets into "- " bullets.
 */
export function cleanAnswerText(text: string): string {
  return text
    .replace(/\*\*|__/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Splits an answer into plain text and citations. While the answer is still
 * streaming, a half-written marker such as "[1" at the very end is held back
 * so it never flashes on screen.
 */
export function splitCitations(text: string, streaming: boolean): AnswerSegment[] {
  const source = streaming ? text.replace(/\[[^\]\n]{0,12}$/, "") : text;
  const segments: AnswerSegment[] = [];
  let last = 0;

  for (const match of source.matchAll(CITATION)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ type: "text", text: source.slice(last, start) });
    segments.push({ type: "cite", sources: (match[1].match(/\d+/g) ?? []).map(Number) });
    last = start + match[0].length;
  }
  if (last < source.length) segments.push({ type: "text", text: source.slice(last) });
  return segments;
}

/**
 * The source numbers of a citation that the model was actually shown, once
 * each, in order. A number outside `allowed` was made up, so it is dropped.
 */
export function validSources(numbers: number[], allowed: number[]): number[] {
  const ok = new Set(allowed);
  return [...new Set(numbers)].filter((n) => ok.has(n)).sort((a, b) => a - b);
}
