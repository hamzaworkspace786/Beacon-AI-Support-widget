import "server-only";
import { ObjectId } from "mongodb";
import { DEFAULT_BOT_COLOR, DEFAULT_GREETING } from "@/lib/constants";
import { db } from "@/lib/mongodb";
import { deleteKnowledgeForBot } from "@/lib/knowledge/store";
import type { BotStatus, BotSummary } from "@/lib/types";
import { generatePublicId } from "./ids";

// The bots collection. Every function takes the signed-in user's id and filters
// by it, so one account can never read or change another account's bot.

interface BotRecord {
  _id: ObjectId;
  userId: string;
  publicId: string;
  name: string;
  businessName: string;
  greeting: string;
  color: string;
  allowedDomains: string[];
  status: BotStatus;
  createdAt: Date;
  updatedAt: Date;
}

const botsCollection = () => db.collection<BotRecord>("bots");

let indexesReady: Promise<unknown> | null = null;

/** Creates the indexes once per server process. */
function ensureIndexes() {
  indexesReady ??= Promise.all([
    botsCollection().createIndex({ userId: 1, createdAt: -1 }),
    botsCollection().createIndex({ publicId: 1 }, { unique: true }),
  ]).catch((error) => {
    // Allow a retry on the next request instead of failing for good.
    indexesReady = null;
    throw error;
  });
  return indexesReady;
}

function toSummary(record: BotRecord): BotSummary {
  return {
    id: record._id.toHexString(),
    publicId: record.publicId,
    name: record.name,
    businessName: record.businessName,
    greeting: record.greeting,
    color: record.color,
    allowedDomains: record.allowedDomains,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null;
}

export async function countBots(userId: string): Promise<number> {
  await ensureIndexes();
  return botsCollection().countDocuments({ userId });
}

export async function listBots(userId: string): Promise<BotSummary[]> {
  await ensureIndexes();
  const records = await botsCollection().find({ userId }).sort({ createdAt: -1 }).toArray();
  return records.map(toSummary);
}

export async function getBot(userId: string, id: string): Promise<BotSummary | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  await ensureIndexes();
  const record = await botsCollection().findOne({ _id, userId });
  return record ? toSummary(record) : null;
}

export async function createBot(userId: string, name: string): Promise<BotSummary> {
  await ensureIndexes();
  const now = new Date();
  const record: BotRecord = {
    _id: new ObjectId(),
    userId,
    publicId: generatePublicId(),
    name,
    businessName: "",
    greeting: DEFAULT_GREETING,
    color: DEFAULT_BOT_COLOR,
    allowedDomains: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await botsCollection().insertOne(record);
  return toSummary(record);
}

export interface BotPatch {
  name?: string;
  businessName?: string;
  greeting?: string;
  color?: string;
  allowedDomains?: string[];
  status?: BotStatus;
}

export async function updateBot(
  userId: string,
  id: string,
  patch: BotPatch,
): Promise<BotSummary | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  await ensureIndexes();

  // Only the fields that were sent are changed.
  const changes: Partial<BotRecord> = { updatedAt: new Date() };
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.businessName !== undefined) changes.businessName = patch.businessName;
  if (patch.greeting !== undefined) changes.greeting = patch.greeting;
  if (patch.color !== undefined) changes.color = patch.color;
  if (patch.allowedDomains !== undefined) changes.allowedDomains = patch.allowedDomains;
  if (patch.status !== undefined) changes.status = patch.status;

  const record = await botsCollection().findOneAndUpdate(
    { _id, userId },
    { $set: changes },
    { returnDocument: "after" },
  );
  return record ? toSummary(record) : null;
}

/**
 * Deletes a bot together with everything it knows (its sources and passages).
 * From Phase 3 this must also delete the bot's conversations.
 */
export async function deleteBot(userId: string, id: string): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;
  await ensureIndexes();

  const owned = await botsCollection().findOne({ _id, userId }, { projection: { _id: 1 } });
  if (!owned) return false;

  await deleteKnowledgeForBot(_id);
  const result = await botsCollection().deleteOne({ _id, userId });
  return result.deletedCount === 1;
}
