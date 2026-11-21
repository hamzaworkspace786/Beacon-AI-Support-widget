import "server-only";
import { Binary, ObjectId } from "mongodb";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_ID } from "@/lib/ai/config";
import { STALE_PROCESSING_MS } from "@/lib/constants";
import { db } from "@/lib/mongodb";
import type { FileType, SourceKind, SourceStatus, SourceSummary } from "@/lib/types";
import type { Chunk } from "./chunk";

// Collections
//   sources  one record per knowledge source (a file or pasted text): title, status, counts
//   chunks   small overlapping pieces of text, each with its embedding vector
// Every record carries userId and botId. Every query below filters on the user,
// so one account can never read or change another account's knowledge.

interface SourceRecord {
  _id: ObjectId;
  userId: string;
  botId: ObjectId;
  kind: SourceKind;
  title: string;
  fileType?: FileType;
  fileSize?: number;
  status: SourceStatus;
  errorMessage?: string;
  pageCount: number;
  chunkCount: number;
  characterCount: number;
  excerpt: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  createdAt: Date;
}

interface ChunkRecord {
  sourceId: ObjectId;
  botId: ObjectId;
  userId: string;
  index: number;
  page: number;
  text: string;
  // Stored as a BSON float32 vector: 768 numbers in about 3 KB.
  embedding: Binary;
}

const sourcesCollection = () => db.collection<SourceRecord>("sources");
const chunksCollection = () => db.collection<ChunkRecord>("chunks");

let indexesReady: Promise<unknown> | null = null;

/** Creates the indexes once per server process. */
function ensureIndexes() {
  indexesReady ??= Promise.all([
    sourcesCollection().createIndex({ botId: 1, createdAt: -1 }),
    sourcesCollection().createIndex({ userId: 1 }),
    chunksCollection().createIndex({ sourceId: 1, index: 1 }, { unique: true }),
    chunksCollection().createIndex({ botId: 1 }),
    chunksCollection().createIndex({ userId: 1 }),
  ]).catch((error) => {
    // Allow a retry on the next request instead of failing for good.
    indexesReady = null;
    throw error;
  });
  return indexesReady;
}

function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null;
}

function toSummary(record: SourceRecord): SourceSummary {
  return {
    id: record._id.toHexString(),
    botId: record.botId.toHexString(),
    kind: record.kind,
    title: record.title,
    fileType: record.fileType,
    fileSize: record.fileSize,
    status: record.status,
    errorMessage: record.errorMessage,
    pageCount: record.pageCount,
    chunkCount: record.chunkCount,
    characterCount: record.characterCount,
    excerpt: record.excerpt,
    createdAt: record.createdAt.toISOString(),
  };
}

const INTERRUPTED_MESSAGE =
  "Preparing this source was interrupted. Delete it and add it again.";

// A background job that never finished (for example, the server restarted)
// would leave a source "processing" forever. Mark those as failed.
async function failInterruptedSources(userId: string, botId: ObjectId) {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  await sourcesCollection().updateMany(
    { userId, botId, status: "processing", createdAt: { $lt: cutoff } },
    { $set: { status: "failed", errorMessage: INTERRUPTED_MESSAGE } },
  );
}

export async function countSources(botId: string): Promise<number> {
  const _botId = toObjectId(botId);
  if (!_botId) return 0;
  await ensureIndexes();
  return sourcesCollection().countDocuments({ botId: _botId });
}

/** How many passages the bot holds or is about to hold (sources still being prepared count). */
export async function countChunks(botId: string): Promise<number> {
  const _botId = toObjectId(botId);
  if (!_botId) return 0;
  await ensureIndexes();
  const [total] = await sourcesCollection()
    .aggregate<{ total: number }>([
      { $match: { botId: _botId, status: { $in: ["processing", "ready"] } } },
      { $group: { _id: null, total: { $sum: "$chunkCount" } } },
    ])
    .toArray();
  return total?.total ?? 0;
}

export async function listSources(userId: string, botId: string): Promise<SourceSummary[]> {
  const _botId = toObjectId(botId);
  if (!_botId) return [];
  await ensureIndexes();
  await failInterruptedSources(userId, _botId);
  const records = await sourcesCollection()
    .find({ userId, botId: _botId })
    .sort({ createdAt: -1 })
    .toArray();
  return records.map(toSummary);
}

interface CreateInput {
  userId: string;
  botId: string;
  kind: SourceKind;
  title: string;
  fileType?: FileType;
  fileSize?: number;
  pages: string[];
  chunkCount: number;
}

/**
 * Save a source straight away as "processing", so the person sees it in the
 * list while its vectors are made in the background.
 */
export async function createProcessingSource(input: CreateInput): Promise<SourceSummary> {
  const botId = toObjectId(input.botId);
  if (!botId) throw new Error("Invalid bot id.");
  await ensureIndexes();

  const record: SourceRecord = {
    _id: new ObjectId(),
    userId: input.userId,
    botId,
    kind: input.kind,
    title: input.title,
    fileType: input.fileType,
    fileSize: input.fileSize,
    status: "processing",
    pageCount: input.pages.length,
    chunkCount: input.chunkCount,
    characterCount: input.pages.reduce((sum, page) => sum + page.length, 0),
    excerpt: (input.pages[0] ?? "").replace(/\s+/g, " ").slice(0, 160),
    createdAt: new Date(),
  };

  await sourcesCollection().insertOne(record);
  return toSummary(record);
}

interface FinishInput {
  userId: string;
  sourceId: string;
  chunks: Chunk[];
  vectors: Float32Array[];
  model: string;
  dimensions: number;
}

/**
 * Save the chunks with their vectors and mark the source ready.
 * Returns false (and saves nothing) if the source was deleted while the
 * vectors were being made.
 */
export async function finishProcessing(input: FinishInput): Promise<boolean> {
  const _id = toObjectId(input.sourceId);
  if (!_id) throw new Error("Invalid source id.");
  if (input.chunks.length !== input.vectors.length) {
    throw new Error("Every chunk needs exactly one vector.");
  }

  const source = await sourcesCollection().findOne(
    { _id, userId: input.userId, status: "processing" },
    { projection: { _id: 1, botId: 1 } },
  );
  if (!source) return false;

  if (input.chunks.length > 0) {
    await chunksCollection().insertMany(
      input.chunks.map((chunk, i) => ({
        sourceId: _id,
        botId: source.botId,
        userId: input.userId,
        index: chunk.index,
        page: chunk.page,
        text: chunk.text,
        embedding: Binary.fromFloat32Array(input.vectors[i]),
      })),
    );
  }

  const result = await sourcesCollection().updateOne(
    { _id, userId: input.userId, status: "processing" },
    {
      $set: {
        status: "ready",
        embeddingModel: input.model,
        embeddingDimensions: input.dimensions,
      },
      $unset: { errorMessage: "" },
    },
  );

  if (result.matchedCount === 0) {
    // Deleted between the check above and now. Don't leave orphaned chunks.
    await chunksCollection().deleteMany({ sourceId: _id });
    return false;
  }
  return true;
}

/** Mark a source as failed, with a message that is safe to show. */
export async function failProcessing(userId: string, sourceId: string, message: string) {
  const _id = toObjectId(sourceId);
  if (!_id) return;
  await sourcesCollection().updateOne(
    { _id, userId, status: "processing" },
    { $set: { status: "failed", errorMessage: message } },
  );
  await chunksCollection().deleteMany({ sourceId: _id });
}

/** Returns false when the source doesn't exist, isn't in this bot, or belongs to someone else. */
export async function deleteSource(
  userId: string,
  botId: string,
  sourceId: string,
): Promise<boolean> {
  const _id = toObjectId(sourceId);
  const _botId = toObjectId(botId);
  if (!_id || !_botId) return false;
  await ensureIndexes();

  const owned = await sourcesCollection().findOne(
    { _id, userId, botId: _botId },
    { projection: { _id: 1 } },
  );
  if (!owned) return false;

  await chunksCollection().deleteMany({ sourceId: _id });
  await sourcesCollection().deleteOne({ _id, userId });
  return true;
}

/** Removes everything a bot knows. Called when the bot itself is deleted. */
export async function deleteKnowledgeForBot(botId: ObjectId): Promise<void> {
  await ensureIndexes();
  await chunksCollection().deleteMany({ botId });
  await sourcesCollection().deleteMany({ botId });
}

// --- Reading knowledge for chat (Phase 3) -----------------------------------------

// Only sources that are ready AND were embedded with today's model and size can
// be searched. Mixing vectors from different models would give meaningless scores.
const searchableSourceFilter = (userId: string, botId: ObjectId) => ({
  userId,
  botId,
  status: "ready" as const,
  embeddingModel: EMBEDDING_MODEL_ID,
  embeddingDimensions: EMBEDDING_DIMENSIONS,
});

/** How many sources of this bot can be searched right now. */
export async function countReadySources(userId: string, botId: string): Promise<number> {
  const _botId = toObjectId(botId);
  if (!_botId) return 0;
  await ensureIndexes();
  return sourcesCollection().countDocuments(searchableSourceFilter(userId, _botId));
}

export interface SearchableChunk {
  sourceId: string;
  title: string;
  fileType?: FileType;
  page: number;
  text: string;
  embedding: Float32Array;
}

/**
 * Every searchable passage of a bot, with its vector. The caller must already
 * know that this person may use this bot: this checks the user id, but it is
 * not a substitute for checking access.
 *
 * A bot holds at most MAX_CHUNKS_PER_BOT passages (1,500 vectors of 768 numbers,
 * about 4.6 MB), so comparing a question with all of them in memory takes a few
 * milliseconds. Many bots at once, or much bigger bots, is where a database vector
 * index (like Atlas Vector Search) starts to pay off.
 */
export async function getSearchableChunks(
  userId: string,
  botId: string,
): Promise<SearchableChunk[]> {
  const _botId = toObjectId(botId);
  if (!_botId) return [];
  await ensureIndexes();

  const sources = await sourcesCollection()
    .find(searchableSourceFilter(userId, _botId), {
      projection: { _id: 1, title: 1, fileType: 1 },
    })
    .toArray();
  if (sources.length === 0) return [];

  const byId = new Map(sources.map((source) => [source._id.toHexString(), source]));
  const records = await chunksCollection()
    .find(
      { userId, botId: _botId, sourceId: { $in: sources.map((source) => source._id) } },
      { projection: { sourceId: 1, page: 1, text: 1, embedding: 1 } },
    )
    .toArray();

  const chunks: SearchableChunk[] = [];
  for (const record of records) {
    const source = byId.get(record.sourceId.toHexString());
    if (!source) continue;
    chunks.push({
      sourceId: record.sourceId.toHexString(),
      title: source.title,
      fileType: source.fileType,
      page: record.page,
      text: record.text,
      embedding: record.embedding.toFloat32Array(),
    });
  }
  return chunks;
}
