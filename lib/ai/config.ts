// gemini-embedding-001 is Google's stable embedding model. 768 is one of the
// sizes Google recommends, and it keeps storage small. If you change either
// value, existing sources stop being searchable until they are re-processed
// (the store saves both values with every source and only searches sources
// whose values match).
export const EMBEDDING_MODEL_ID = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

// The model that writes the chat answers. These are the same two models DocLens
// uses, because they answered quickly on this key (checked on 2026-11-14 with
// scripts/check-models.mjs). Free models change often, so run
//   node --env-file=.env.local scripts/check-models.mjs
// when answers get slow or fail, and switch to whichever answers fastest.
// Changing the model needs no migration.
export const CHAT_MODEL_ID = "gemini-3.5-flash-lite";

// The backup model. If the main one is unavailable, rate limited or silent
// before its first word, the question is answered by this one instead.
// Set to undefined to turn the backup off.
export const CHAT_FALLBACK_MODEL_ID: string | undefined = "gemini-4-hydrogen";
