import { after, NextResponse } from "next/server";
import { isEmbeddingConfigured } from "@/lib/ai/embedding-model";
import { getBot } from "@/lib/bots/store";
import { firstIssue } from "@/lib/bots/validate";
import {
  MAX_CHARACTERS,
  MAX_CHUNKS_PER_BOT,
  MAX_FILE_BYTES,
  MAX_PAGES,
  MAX_SOURCES_PER_BOT,
  MIN_TEXT_CHARS,
} from "@/lib/constants";
import { chunkPages } from "@/lib/knowledge/chunk";
import { UploadError } from "@/lib/knowledge/errors";
import { paginateText } from "@/lib/knowledge/paginate";
import { parseDocument } from "@/lib/knowledge/parse";
import { embedAndStoreChunks } from "@/lib/knowledge/process";
import {
  countChunks,
  countSources,
  createProcessingSource,
  listSources,
} from "@/lib/knowledge/store";
import { cleanTitle, pastedTextSchema, validateUpload } from "@/lib/knowledge/validate";
import { limitResponse } from "@/lib/limit-response";
import { getUserOrNull } from "@/lib/session";
import { consume } from "@/lib/usage";
import type { FileType, SourceKind } from "@/lib/types";

// Vectors are made in the background after the response is sent. This is the
// longest a single invocation may run on any Vercel plan.
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// What a request turns into once it has been checked and read.
interface Prepared {
  kind: SourceKind;
  title: string;
  fileType?: FileType;
  fileSize?: number;
  pages: string[];
}

async function prepareFile(request: Request): Promise<Prepared> {
  // Refuse oversized uploads before reading them. The extra room covers the
  // multipart envelope around the file.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_FILE_BYTES + 100_000) {
    throw new UploadError("This file is too large. Try a smaller one.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new UploadError("The upload could not be read. Try again.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) throw new UploadError("No file was received.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileType = validateUpload(file.name, bytes);
  const { pages } = await parseDocument(bytes, fileType);

  return { kind: "file", title: cleanTitle(file.name), fileType, fileSize: bytes.length, pages };
}

async function prepareText(request: Request): Promise<Prepared> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new UploadError("The request could not be read.", 400);
  }

  const parsed = pastedTextSchema.safeParse(body);
  if (!parsed.success) throw new UploadError(firstIssue(parsed.error), 400);

  const pages = paginateText(parsed.data.text);
  const characters = pages.reduce((sum, page) => sum + page.length, 0);
  if (characters < MIN_TEXT_CHARS) {
    throw new UploadError("Paste at least a couple of sentences.", 400);
  }
  if (characters > MAX_CHARACTERS || pages.length > MAX_PAGES) {
    throw new UploadError("That text is too long to add in one piece. Split it up.", 400);
  }

  return { kind: "text", title: parsed.data.title, pages };
}

// GET /api/bots/:id/sources
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  const { id } = await params;
  const bot = await getBot(user.id, id);
  if (!bot) return errorResponse("Bot not found.", 404);

  const sources = await listSources(user.id, bot.id);
  return NextResponse.json({ sources }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/bots/:id/sources
//   multipart form with a "file"  -> adds an uploaded file
//   JSON { title, text }          -> adds pasted text
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  const { id } = await params;
  const bot = await getBot(user.id, id);
  if (!bot) return errorResponse("Bot not found.", 404);

  if (!isEmbeddingConfigured()) {
    return errorResponse(
      "AI features aren't set up on this server yet. Add GOOGLE_GENERATIVE_AI_API_KEY to the environment and restart.",
      503,
    );
  }

  if ((await countSources(bot.id)) >= MAX_SOURCES_PER_BOT) {
    return errorResponse(
      `A bot can hold up to ${MAX_SOURCES_PER_BOT} sources. Delete one to add another.`,
      403,
    );
  }

  try {
    const isUpload = (request.headers.get("content-type") ?? "").includes("multipart/form-data");
    const prepared = isUpload ? await prepareFile(request) : await prepareText(request);
    const chunks = chunkPages(prepared.pages);

    // The chat compares every question against all of a bot's passages, so a bot
    // can only hold so many. Sources still being prepared count too.
    if ((await countChunks(bot.id)) + chunks.length > MAX_CHUNKS_PER_BOT) {
      return errorResponse(
        `This bot can hold about ${MAX_CHUNKS_PER_BOT} passages and this would go over. Delete a source or add a shorter one.`,
        403,
      );
    }

    // The source is valid. From here on it costs AI calls, so it counts toward the
    // person's and the site's allowance.
    const usage = await consume(user.id, "source");
    if (!usage.ok) return limitResponse(usage);

    const source = await createProcessingSource({
      userId: user.id,
      botId: bot.id,
      kind: prepared.kind,
      title: prepared.title,
      fileType: prepared.fileType,
      fileSize: prepared.fileSize,
      pages: prepared.pages,
      chunkCount: chunks.length,
    });

    // Answer now, make the vectors after. The source shows "Preparing" until it is
    // ready. This never throws: a failure is shown on the source itself.
    after(() => embedAndStoreChunks({ userId: user.id, sourceId: source.id, chunks }));

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) return errorResponse(error.message, error.status);
    console.error("Adding a source failed:", error);
    return errorResponse("Something went wrong while reading your content. Try again.", 500);
  }
}
