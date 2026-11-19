import { ESTIMATED_PAGE_CHARS } from "../constants";
import { normalizeText, splitToLimit } from "./text";

/**
 * Word files, text files and pasted text have no fixed pages. We group whole
 * paragraphs into pages of roughly `targetChars`, so every passage still has a
 * page number the chat can point to.
 */
export function paginateText(
  text: string,
  targetChars = ESTIMATED_PAGE_CHARS,
): string[] {
  const paragraphs = normalizeText(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const pages: string[] = [];
  let current = "";

  const closePage = () => {
    if (current) {
      pages.push(current);
      current = "";
    }
  };

  for (const paragraph of paragraphs) {
    const pieces =
      paragraph.length > targetChars
        ? splitToLimit(paragraph, targetChars)
        : [paragraph];

    for (const piece of pieces) {
      if (current && current.length + 2 + piece.length > targetChars) {
        closePage();
      }
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }

  closePage();
  return pages;
}
