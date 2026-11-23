// Shared by the browser and the server, so keep this file free of server code.

export const APP_NAME = "Beacon";

// Bots
export const MAX_BOTS_PER_USER = 3;
export const BOT_NAME_MAX = 40;
export const BUSINESS_NAME_MAX = 80;
export const GREETING_MAX = 200;
export const MAX_ALLOWED_DOMAINS = 10;

export const DEFAULT_GREETING = "Hi! How can I help you today?";
// The default chat color: the brand indigo.
export const DEFAULT_BOT_COLOR = "#4f46e5";

// --- Knowledge base (Phase 2) -------------------------------------------------

// Vercel's Hobby plan rejects request bodies over about 4.5 MB, so we stay under it.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_LABEL = "4 MB";

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

// What one bot may hold. Chat (Phase 3) compares a question against every passage
// of the bot, so the passage cap keeps answers fast and storage small.
export const MAX_SOURCES_PER_BOT = 10;
export const MAX_CHUNKS_PER_BOT = 1500;

// Limits on what we are willing to read from one source.
export const MAX_PAGES = 150;
export const MAX_CHARACTERS = 400_000;
export const SOURCE_TITLE_MAX = 80;
export const MIN_TEXT_CHARS = 20;
export const MAX_TEXT_CHARS = 100_000;

// Word, text and pasted content have no fixed pages, so we cut them into pages of about this size.
export const ESTIMATED_PAGE_CHARS = 3000;

// Chunking for search. Chunks never cross a page, so every chunk has one page number.
export const CHUNK_MAX_CHARS = 800;
export const CHUNK_OVERLAP_CHARS = 120;

// Embeddings (turning chunks into vectors so search can match by meaning)
export const EMBED_BATCH_SIZE = 50; // chunks per request, about 10k tokens
export const PROCESSING_BUDGET_MS = 270_000; // stay inside Vercel's 300 second limit
export const STALE_PROCESSING_MS = 10 * 60 * 1000; // "processing" this long means it was interrupted

// --- Chat (Phase 3) ---------------------------------------------------------------

// Passages sent to the model with each question.
export const CHAT_EXCERPT_COUNT = 8;
// A passage must match the question at least this closely (cosine similarity, 0 to 1)
// or it is not used. If nothing matches, the bot says it doesn't know and the AI is not
// called at all. This is a starting guess: watch the match percentages under each answer
// in the Playground and raise or lower it until the bot answers what it should and
// declines what it shouldn't.
export const MIN_RELEVANCE = 0.45;
export const MAX_QUERY_CHARS = 500;

export const CHAT_MAX_MESSAGE_CHARS = 1000;
export const CHAT_MAX_HISTORY_MESSAGES = 10; // earlier messages the model sees
export const CHAT_MAX_OUTPUT_TOKENS = 800;
// If the model says nothing for this long, the backup model takes over.
export const CHAT_FIRST_TOKEN_TIMEOUT_MS = 20_000;
// An answer that is still going after this long is cut off.
export const CHAT_TOTAL_TIMEOUT_MS = 90_000;
// Response headers: the sources an answer may cite, and whether it was answered.
export const CHAT_SOURCES_HEADER = "X-Beacon-Sources";
export const CHAT_OUTCOME_HEADER = "X-Beacon-Outcome";
// The best match score of the question, so the Playground can show it.
export const CHAT_BEST_SCORE_HEADER = "X-Beacon-Best-Score";
// Saved messages kept per conversation (a question and its answer count separately).
export const CHAT_MAX_SAVED_MESSAGES = 100;

// --- Fair use -------------------------------------------------------------------
// Beacon runs on free tiers (Gemini API, MongoDB Atlas, Vercel), so every AI call is
// limited per person and for the whole site. The site limit stops one burst of
// visitors from using up the shared daily quota for everyone. Tune these to about
// 60 to 80 percent of the daily limits your Gemini key shows in Google AI Studio.
// Counting uses UTC.
export const LIMITS = {
  // Per person
  sourcesPerHour: 10,
  sourcesPerDay: 30,
  questionsPerMinute: 8,
  questionsPerDay: 100,
  // Per bot, per day: a cost cap, so one bot can't use up everything
  botQuestionsPerDay: 300,
  // Public widget: per visitor (a random id in their browser) and per IP address.
  // The visitor id can be changed by anyone, so the IP limits and the bot cap are
  // the real protection against abuse.
  visitorQuestionsPerMinute: 5,
  visitorQuestionsPerDay: 40,
  ipQuestionsPerMinute: 15,
  ipQuestionsPerDay: 150,
  // Whole site, per day
  siteSourcesPerDay: 150,
  siteQuestionsPerDay: 800,
} as const;
