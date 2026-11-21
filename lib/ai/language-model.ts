import { google } from "@ai-sdk/google";
import { CHAT_FALLBACK_MODEL_ID, CHAT_MODEL_ID } from "./config";

/** The model that writes chat answers. Uses the same GOOGLE_GENERATIVE_AI_API_KEY as embeddings. */
export function getLanguageModel() {
  return google(CHAT_MODEL_ID);
}

/** The backup model, or null when no backup is configured. */
export function getFallbackLanguageModel() {
  return CHAT_FALLBACK_MODEL_ID ? google(CHAT_FALLBACK_MODEL_ID) : null;
}
