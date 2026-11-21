import "server-only";
import { embedQuery, type EmbedOptions } from "@/lib/ai/embed";
import { CHAT_EXCERPT_COUNT, MIN_RELEVANCE } from "@/lib/constants";
import { getSearchableChunks } from "@/lib/knowledge/store";
import { selectPassages, type Selection } from "./rank";

/** The bot has nothing it can search yet. The message is safe to show. */
export class NoKnowledgeError extends Error {
  constructor() {
    super("This bot has no knowledge yet. Add a source in the Knowledge tab first.");
    this.name = "NoKnowledgeError";
  }
}

/**
 * Find the passages of one bot's knowledge closest in meaning to a question.
 *
 * The caller must already have checked that this person may use this bot. The
 * search only ever looks at that bot's own passages, so one business can never
 * get another business's information in an answer.
 */
export async function searchBot(
  userId: string,
  botId: string,
  query: string,
  embedOptions: EmbedOptions = {},
  limit: number = CHAT_EXCERPT_COUNT,
  minScore: number = MIN_RELEVANCE,
): Promise<Selection> {
  // Load the passages first: with nothing to search, there is no reason to call the AI.
  const chunks = await getSearchableChunks(userId, botId);
  if (chunks.length === 0) throw new NoKnowledgeError();

  const queryVector = await embedQuery(query, embedOptions);
  return selectPassages(queryVector, chunks, { limit, minScore });
}
