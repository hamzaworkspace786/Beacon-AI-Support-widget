// gemini-embedding-001 is Google's stable embedding model. 768 is one of the
// sizes Google recommends, and it keeps storage small. If you change either
// value, existing sources stop being searchable until they are re-processed
// (the store saves both values with every source so they can be compared).
export const EMBEDDING_MODEL_ID = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

// The model that writes the chat answers is added in Phase 3.
