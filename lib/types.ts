// Shapes shared by the API and the UI. Dates travel as ISO strings.

export type BotStatus = "active" | "paused";

export interface BotSummary {
  /** Database id. Used in the dashboard and in the dashboard's API calls. */
  id: string;
  /** Public id (bot_...). This is the one the website embed code will carry. */
  publicId: string;
  name: string;
  /** The business the bot speaks for. Used in the bot's instructions from Phase 3. */
  businessName: string;
  greeting: string;
  /** Header and button color of the chat window, like #4f46e5. */
  color: string;
  /** Websites the widget may load on. Enforced from Phase 4. */
  allowedDomains: string[];
  /** A paused bot stays saved but the widget stops answering. Enforced from Phase 3. */
  status: BotStatus;
  createdAt: string;
  updatedAt: string;
}

// --- Knowledge base (Phase 2) ---------------------------------------------------

export type FileType = "pdf" | "docx" | "txt";
export type SourceKind = "file" | "text";
/** "processing" while search vectors are made, then "ready" or "failed". */
export type SourceStatus = "processing" | "ready" | "failed";

export interface SourceSummary {
  id: string;
  botId: string;
  kind: SourceKind;
  title: string;
  /** Only for uploaded files. */
  fileType?: FileType;
  fileSize?: number;
  status: SourceStatus;
  /** A message that is safe to show, when status is "failed". */
  errorMessage?: string;
  pageCount: number;
  /** Small pieces of text the chat compares questions against. */
  chunkCount: number;
  characterCount: number;
  /** The start of the text, so you can check it was read correctly. */
  excerpt: string;
  createdAt: string;
}
