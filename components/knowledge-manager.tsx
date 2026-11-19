"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  File as FileIcon,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
  MAX_SOURCES_PER_BOT,
  MAX_TEXT_CHARS,
  SOURCE_TITLE_MAX,
} from "@/lib/constants";
import type { SourceSummary } from "@/lib/types";

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-sunken disabled:opacity-70";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describe(source: SourceSummary) {
  const parts: string[] = [];
  parts.push(source.kind === "text" ? "Pasted text" : (source.fileType ?? "file").toUpperCase());
  // Only PDFs have real pages. Other sources are cut into estimated pages.
  if (source.fileType === "pdf") {
    parts.push(`${source.pageCount} ${source.pageCount === 1 ? "page" : "pages"}`);
  }
  if (source.fileSize) parts.push(formatSize(source.fileSize));
  parts.push(`${source.chunkCount} ${source.chunkCount === 1 ? "passage" : "passages"}`);
  return parts.join(" · ");
}

function StatusPill({ status }: { status: SourceSummary["status"] }) {
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        Preparing
      </span>
    );
  }
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">
        <CheckCircle2 size={12} aria-hidden="true" />
        Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
      <AlertCircle size={12} aria-hidden="true" />
      Failed
    </span>
  );
}

export function KnowledgeManager({
  botId,
  initialSources,
}: {
  botId: string;
  initialSources: SourceSummary[];
}) {
  const [sources, setSources] = useState(initialSources);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const hasProcessing = sources.some((source) => source.status === "processing");
  const atLimit = sources.length >= MAX_SOURCES_PER_BOT;
  const busy = uploading || adding;

  const loadSources = useCallback(async () => {
    try {
      const response = await fetch(`/api/bots/${botId}/sources`, { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      return data.sources as SourceSummary[];
    } catch {
      // A failed refresh is not worth bothering anyone about. The next one will try again.
      return null;
    }
  }, [botId]);

  const refreshSources = useCallback(async () => {
    const nextSources = await loadSources();
    if (nextSources) setSources(nextSources);
  }, [loadSources]);

  // Make sure the list is current whenever this page is shown. Next.js keeps pages
  // alive in the background, so what was loaded earlier may be out of date.
  useEffect(() => {
    let active = true;
    async function loadInitialSources() {
      const nextSources = await loadSources();
      if (active && nextSources) setSources(nextSources);
    }

    void loadInitialSources();
    return () => {
      active = false;
    };
  }, [loadSources]);

  // While anything is being prepared, check every few seconds.
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = window.setInterval(() => {
      void refreshSources();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasProcessing, refreshSources]);

  function addToList(source: SourceSummary) {
    setSources((previous) => [source, ...previous.filter((item) => item.id !== source.id)]);
  }

  async function uploadFile(file: File) {
    setError("");

    // Quick checks here save a trip. The server checks everything again.
    const lower = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
      setError("Beacon reads PDF, Word (.docx), and text (.txt) files.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(`This file is larger than ${MAX_FILE_LABEL}. Try a smaller one.`);
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/bots/${botId}/sources`, { method: "POST", body: form });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "The upload failed. Try again.");
        return;
      }
      addToList(data.source as SourceSummary);
    } catch {
      setError("The upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function addText(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || atLimit) return;
    setError("");
    setAdding(true);

    try {
      const response = await fetch(`/api/bots/${botId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? "The text could not be added. Try again.");
        return;
      }
      addToList(data.source as SourceSummary);
      setTitle("");
      setText("");
    } catch {
      setError("The text could not be added. Check your connection and try again.");
    } finally {
      setAdding(false);
    }
  }

  async function deleteSource(source: SourceSummary) {
    if (deletingId) return;
    const confirmed = window.confirm(
      `Delete "${source.title}"? The bot will no longer know what it says.`,
    );
    if (!confirmed) return;

    setError("");
    setDeletingId(source.id);
    try {
      const response = await fetch(`/api/bots/${botId}/sources/${source.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "The source could not be deleted. Try again.");
        return;
      }
      setSources((previous) => previous.filter((item) => item.id !== source.id));
    } catch {
      setError("The source could not be deleted. Check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Knowledge</h2>
          <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-muted">
            Add what your customers ask about: shipping, returns, prices, opening hours. The bot
            will answer only from this material.
          </p>
        </div>
        <p className="text-sm text-muted">
          {sources.length} of {MAX_SOURCES_PER_BOT} sources
        </p>
      </div>

      {atLimit && (
        <p className="rounded-xl border border-line bg-sunken px-4 py-3 text-sm text-muted">
          This bot has reached {MAX_SOURCES_PER_BOT} sources. Delete one to add another.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <h3 className="font-display text-lg font-semibold">Upload a file</h3>
          <p className="mt-1 text-sm text-muted">
            PDF, Word (.docx) or text (.txt), up to {MAX_FILE_LABEL}.
          </p>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy && !atLimit) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files?.[0];
              if (file && !busy && !atLimit) void uploadFile(file);
            }}
            className={`mt-4 grid place-items-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragging ? "border-brand bg-brand-soft" : "border-line bg-canvas"
            }`}
          >
            <Upload size={22} className="text-brand" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">Drop a file here</p>
            <p className="text-sm text-muted">or</p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy || atLimit}
              className="mt-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-strong disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Choose a file"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              tabIndex={-1}
              aria-label="Choose a file to upload"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <h3 className="font-display text-lg font-semibold">Paste text</h3>
          <p className="mt-1 text-sm text-muted">
            For FAQs or policies you don&rsquo;t have as a file.
          </p>

          <form onSubmit={addText} className="mt-4 space-y-3">
            <div>
              <label htmlFor="source-title" className="sr-only">
                Title
              </label>
              <input
                id="source-title"
                type="text"
                required
                maxLength={SOURCE_TITLE_MAX}
                placeholder="Title, for example Returns policy"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={busy || atLimit}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="source-text" className="sr-only">
                Text
              </label>
              <textarea
                id="source-text"
                required
                rows={5}
                maxLength={MAX_TEXT_CHARS}
                placeholder="Paste the text here"
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={busy || atLimit}
                className={`${inputClass} resize-y`}
              />
            </div>
            <button
              type="submit"
              disabled={busy || atLimit}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-strong disabled:opacity-60"
            >
              {adding ? "Adding..." : "Add text"}
            </button>
          </form>
        </section>
      </div>

      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-danger">
        {error}
      </p>

      {sources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold">Nothing here yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-relaxed text-muted">
            Upload a file or paste some text above. Once a source says Ready, the bot knows it.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sources.map((source) => (
            <li
              key={source.id}
              className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                {source.kind === "text" ? (
                  <FileText size={19} aria-hidden="true" />
                ) : (
                  <FileIcon size={19} aria-hidden="true" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{source.title}</p>
                  <StatusPill status={source.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted">{describe(source)}</p>
                {source.status === "failed" && source.errorMessage && (
                  <p className="mt-1 text-sm text-danger">{source.errorMessage}</p>
                )}
                {source.excerpt && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                    {source.excerpt}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => deleteSource(source)}
                disabled={deletingId === source.id}
                aria-label={`Delete ${source.title}`}
                title="Delete"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-60"
              >
                {deletingId === source.id ? (
                  <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 size={17} aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
