import assert from "node:assert/strict";
import test from "node:test";
import { APICallError } from "ai";
import { LoadAPIKeyError } from "@ai-sdk/provider";
import { EmbeddingError } from "../lib/ai/errors";
import { classify, withRetry } from "../lib/ai/retry";
import { chunkPages } from "../lib/knowledge/chunk";
import { UploadError } from "../lib/knowledge/errors";
import { paginateText } from "../lib/knowledge/paginate";
import { normalizeText, splitToLimit } from "../lib/knowledge/text";
import { cleanTitle, pastedTextSchema, validateUpload } from "../lib/knowledge/validate";

const bytes = (...values: number[]) => new Uint8Array(values);
const asciiBytes = (text: string) => new TextEncoder().encode(text);

// --- text -----------------------------------------------------------------------

test("normalizeText cleans whitespace without changing words", () => {
  assert.equal(normalizeText("  Hello   world \r\n\r\n\r\n\r\nNext\u00a0line\t here  "), "Hello world\n\nNext line here");
});

test("splitToLimit breaks at spaces and never exceeds the limit", () => {
  const pieces = splitToLimit("one two three four five six seven eight nine ten", 15);
  assert.ok(pieces.length > 1);
  for (const piece of pieces) assert.ok(piece.length <= 15, piece);
  assert.equal(pieces.join(" "), "one two three four five six seven eight nine ten");
});

test("splitToLimit hard-cuts text that has no spaces", () => {
  const pieces = splitToLimit("x".repeat(50), 20);
  assert.deepEqual(pieces.map((p) => p.length), [20, 20, 10]);
});

// --- pages ----------------------------------------------------------------------

test("paginateText groups whole paragraphs into pages", () => {
  const paragraph = "word ".repeat(30).trim(); // 149 characters
  const pages = paginateText([paragraph, paragraph, paragraph, paragraph].join("\n\n"), 320);
  assert.equal(pages.length, 2);
  assert.ok(pages.every((page) => page.length <= 320));
});

test("paginateText returns no pages for empty text", () => {
  assert.deepEqual(paginateText("   \n\n  "), []);
});

// --- chunks ---------------------------------------------------------------------

function sentences(count: number, start = 1) {
  return Array.from({ length: count }, (_, i) => `Sentence number ${start + i} is here.`).join(" ");
}

test("chunkPages keeps every chunk short and numbers them in order", () => {
  const chunks = chunkPages([sentences(40)], { maxChars: 100, overlapChars: 60 });
  assert.ok(chunks.length > 3);
  chunks.forEach((chunk, i) => {
    assert.equal(chunk.index, i);
    assert.equal(chunk.page, 1);
    assert.ok(chunk.text.length <= 100, chunk.text);
  });
});

test("chunkPages overlaps neighbouring chunks", () => {
  const chunks = chunkPages([sentences(40)], { maxChars: 100, overlapChars: 60 });
  const lastSentence = chunks[0].text.split(/(?<=\.)\s/).pop() as string;
  assert.ok(chunks[1].text.includes(lastSentence));
});

test("chunkPages never lets a chunk cross a page", () => {
  const chunks = chunkPages(["Alpha one. Alpha two.", "Beta one. Beta two."], {
    maxChars: 200,
    overlapChars: 40,
  });
  assert.deepEqual(chunks.map((c) => c.page), [1, 2]);
  assert.ok(!chunks[0].text.includes("Beta"));
  assert.ok(!chunks[1].text.includes("Alpha"));
});

test("chunkPages skips empty pages", () => {
  const chunks = chunkPages(["", "Only real page."]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].page, 2);
});

// --- upload checks --------------------------------------------------------------

test("validateUpload recognises real PDF, DOCX and text content", () => {
  assert.equal(validateUpload("Menu.PDF", bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31)), "pdf");
  assert.equal(validateUpload("policy.docx", bytes(0x50, 0x4b, 0x03, 0x04, 0)), "docx");
  assert.equal(validateUpload("faq.txt", asciiBytes("Hello there")), "txt");
});

test("validateUpload rejects wrong extensions, fake files and empty files", () => {
  assert.throws(() => validateUpload("photo.png", asciiBytes("x")), UploadError);
  assert.throws(() => validateUpload("fake.pdf", asciiBytes("not a pdf at all")), UploadError);
  assert.throws(() => validateUpload("fake.docx", asciiBytes("not a zip")), UploadError);
  assert.throws(() => validateUpload("binary.txt", bytes(65, 66, 0, 67)), UploadError);
  assert.throws(() => validateUpload("empty.txt", new Uint8Array(0)), UploadError);
});

test("validateUpload rejects files over the size limit", () => {
  const big = new Uint8Array(4 * 1024 * 1024 + 1).fill(65);
  assert.throws(() => validateUpload("big.txt", big), /larger than/);
});

test("cleanTitle strips folders and control characters", () => {
  assert.equal(cleanTitle("C:\\Users\\me\\Shipping Policy.pdf"), "Shipping Policy.pdf");
  assert.equal(cleanTitle("a\u0000b.txt"), "ab.txt");
  assert.equal(cleanTitle("   "), "Untitled source");
});

test("pastedTextSchema needs a title and some real text", () => {
  assert.equal(pastedTextSchema.safeParse({ title: "Returns", text: "Items can be returned within 14 days." }).success, true);
  assert.equal(pastedTextSchema.safeParse({ title: "  ", text: "Items can be returned within 14 days." }).success, false);
  assert.equal(pastedTextSchema.safeParse({ title: "Returns", text: "short" }).success, false);
  assert.equal(pastedTextSchema.safeParse({ title: "Returns", text: "x".repeat(100_001) }).success, false);
  assert.equal(pastedTextSchema.safeParse({ title: "Returns", text: "Long enough text here.", extra: 1 }).success, false);
});

// --- retry ----------------------------------------------------------------------

function apiError(statusCode: number, responseHeaders?: Record<string, string>) {
  return new APICallError({
    message: `status ${statusCode}`,
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
    responseHeaders,
  });
}

const makeError = (kind: ConstructorParameters<typeof EmbeddingError>[0], message: string, cause: unknown) =>
  new EmbeddingError(kind, message, { cause });

test("classify sorts AI failures into kinds", () => {
  assert.equal(classify(apiError(429)).kind, "rate_limit");
  assert.equal(classify(apiError(429, { "retry-after": "7" })).retryAfterMs, 7000);
  assert.equal(classify(apiError(401)).kind, "auth");
  assert.equal(classify(apiError(503)).kind, "unavailable");
  assert.equal(classify(apiError(400)).kind, "bad_request");
  assert.equal(classify(new LoadAPIKeyError({ message: "no key" })).kind, "not_configured");
  assert.equal(classify(new TypeError("fetch failed")).kind, "unavailable");
  assert.equal(classify(new Error("something else")).kind, "unknown");
});

test("withRetry waits and tries again when rate limited", async () => {
  const waits: number[] = [];
  let calls = 0;

  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw apiError(429);
      return "done";
    },
    { sleep: async (ms) => void waits.push(ms) },
    makeError,
  );

  assert.equal(result, "done");
  assert.equal(calls, 3);
  assert.deepEqual(waits, [15_000, 30_000]);
});

test("withRetry does not retry a rejected key", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw apiError(401);
      },
      { sleep: async () => {} },
      makeError,
    ),
    (error: unknown) => error instanceof EmbeddingError && error.kind === "auth",
  );
  assert.equal(calls, 1);
});

test("withRetry stops with a timeout when the next wait would pass the deadline", async () => {
  await assert.rejects(
    withRetry(
      async () => {
        throw apiError(429);
      },
      { deadline: 1000, now: () => 0, sleep: async () => {} },
      makeError,
    ),
    (error: unknown) => error instanceof EmbeddingError && error.kind === "timeout",
  );
});
