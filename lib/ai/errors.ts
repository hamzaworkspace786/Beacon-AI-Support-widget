export type AiErrorKind =
  | "rate_limit" // the AI service asked us to slow down
  | "auth" // the API key was rejected
  | "not_configured" // there is no API key
  | "unavailable" // the AI service or the network is down
  | "timeout" // we ran out of time
  | "bad_request"
  | "bad_output" // the AI answered, but not with something we can use
  | "unknown";

/** Base class for every failure of a call to the AI service. */
export class AiError extends Error {
  kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiError";
    this.kind = kind;
  }
}

/** A failure while turning text into search vectors. */
export class EmbeddingError extends AiError {
  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(kind, message, options);
    this.name = "EmbeddingError";
  }
}

/** A failure while answering a question. */
export class ChatError extends AiError {
  constructor(kind: AiErrorKind, message: string, options?: { cause?: unknown }) {
    super(kind, message, options);
    this.name = "ChatError";
  }
}

const EMBEDDING_MESSAGES: Record<AiErrorKind, string> = {
  rate_limit:
    "The AI service is busy right now. Wait a minute, then delete this source and add it again.",
  auth: "Search isn't set up correctly on this server yet.",
  not_configured: "Search isn't set up on this server yet.",
  unavailable: "The AI service isn't responding. Try again in a few minutes.",
  timeout: "Preparing this source took too long. Try again, or add a smaller one.",
  bad_request: "The AI service couldn't process this source. Try a different one.",
  bad_output:
    "The AI service returned something we couldn't use. Delete this source and add it again.",
  unknown:
    "Something went wrong while preparing this source. Delete it and add it again.",
};

const CHAT_MESSAGES: Record<AiErrorKind, string> = {
  rate_limit: "The AI service is busy right now. Wait a minute, then ask again.",
  auth: "Chat isn't set up correctly on this server yet.",
  not_configured: "Chat isn't set up on this server yet.",
  unavailable: "The AI service isn't responding. Try again in a few minutes.",
  timeout: "The answer took too long. Try asking again.",
  bad_request: "The AI service couldn't answer that. Try rephrasing your question.",
  bad_output: "The AI service didn't give an answer. Try asking again.",
  unknown: "Something went wrong while answering. Try again.",
};

/** A message about a source that is safe to show. Never includes keys or raw API errors. */
export function userMessage(error: unknown): string {
  if (error instanceof EmbeddingError) return EMBEDDING_MESSAGES[error.kind];
  return EMBEDDING_MESSAGES.unknown;
}

/** Same idea for chat failures. */
export function chatUserMessage(error: unknown): string {
  if (error instanceof AiError) return CHAT_MESSAGES[error.kind];
  return CHAT_MESSAGES.unknown;
}
