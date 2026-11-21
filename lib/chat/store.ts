import "server-only";
import { ObjectId } from "mongodb";
import { CHAT_MAX_SAVED_MESSAGES } from "@/lib/constants";
import { db } from "@/lib/mongodb";
import type { ChatOutcome, SavedChatMessage, SourceRef } from "@/lib/types";

// The chats collection holds one record per conversation, with its messages inside.
// A conversation is identified by its bot and a key:
//   playground:<owner id>   the owner testing the bot in the dashboard (Phase 3)
//   visitor:<visitor id>    a customer using the widget on a website (Phase 4)
// Messages keep the sources they cited and whether the bot could answer, so
// Phase 5 can show the owner which questions went unanswered.

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  outcome?: ChatOutcome;
  sources: SourceRef[];
  createdAt: Date;
}

interface ConversationRecord {
  _id: ObjectId;
  botId: ObjectId;
  userId: string; // the bot's owner
  conversationKey: string;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const conversations = () => db.collection<ConversationRecord>("chats");

let indexesReady: Promise<unknown> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    conversations().createIndex({ botId: 1, conversationKey: 1 }, { unique: true }),
    conversations().createIndex({ userId: 1 }),
  ]).catch((error) => {
    indexesReady = null;
    throw error;
  });
  return indexesReady;
}

function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null;
}

export function playgroundKey(userId: string) {
  return `playground:${userId}`;
}

interface TurnInput {
  userId: string;
  botId: string;
  conversationKey: string;
  question: string;
  answer: string;
  outcome: ChatOutcome;
  sources: SourceRef[];
}

/** Save a question and its answer together. */
export async function appendChatTurn(input: TurnInput): Promise<void> {
  const botId = toObjectId(input.botId);
  if (!botId) return;
  await ensureIndexes();

  const now = new Date();
  const messages: StoredMessage[] = [
    {
      id: new ObjectId().toHexString(),
      role: "user",
      content: input.question,
      sources: [],
      createdAt: now,
    },
    {
      id: new ObjectId().toHexString(),
      role: "assistant",
      content: input.answer,
      outcome: input.outcome,
      sources: input.sources,
      createdAt: new Date(now.getTime() + 1),
    },
  ];

  // $push with $slice adds both messages and trims the oldest in one step, so
  // two answers finishing together can't overwrite each other.
  const save = () =>
    conversations().updateOne(
      { botId, userId: input.userId, conversationKey: input.conversationKey },
      {
        $push: { messages: { $each: messages, $slice: -CHAT_MAX_SAVED_MESSAGES } },
        $set: { updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

  try {
    await save();
  } catch (error) {
    // Two first answers finishing together can both try to create the record.
    // The unique index lets one win; the other just adds to it.
    if ((error as { code?: number }).code === 11000) await save();
    else throw error;
  }
}

export async function getMessages(
  userId: string,
  botId: string,
  conversationKey: string,
): Promise<SavedChatMessage[]> {
  const _botId = toObjectId(botId);
  if (!_botId) return [];
  await ensureIndexes();

  const record = await conversations().findOne({ botId: _botId, userId, conversationKey });
  return (record?.messages ?? []).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    outcome: message.outcome,
    sources: message.sources ?? [],
    createdAt: message.createdAt.toISOString(),
  }));
}

export async function clearMessages(
  userId: string,
  botId: string,
  conversationKey: string,
): Promise<void> {
  const _botId = toObjectId(botId);
  if (!_botId) return;
  await ensureIndexes();
  await conversations().deleteMany({ botId: _botId, userId, conversationKey });
}

/** Removes every conversation of a bot. Called when the bot itself is deleted. */
export async function deleteConversationsForBot(botId: ObjectId): Promise<void> {
  await ensureIndexes();
  await conversations().deleteMany({ botId });
}
