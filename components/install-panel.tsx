"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, CheckCircle2, Copy } from "lucide-react";
import type { BotStatus } from "@/lib/types";

// What the widget script puts on window once it is running.
type BeaconGlobal = { BeaconWidget?: { destroy: () => void } };

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked. The code is selectable on screen anyway.
    }
  }

  return (
    <div className="relative">
      <pre
        tabIndex={0}
        aria-label={label}
        className="overflow-x-auto rounded-xl bg-sidebar px-4 py-3.5 pr-14 font-mono text-[13px] leading-relaxed text-white/90"
      >
        {code}
      </pre>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-md border border-white/20 text-white/80 transition-colors hover:bg-white/10"
      >
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      </button>
    </div>
  );
}

function CheckRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px]">
      {ok ? (
        <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-ok" aria-label="Done" />
      ) : (
        <AlertCircle
          size={19}
          className="mt-0.5 shrink-0 text-danger"
          aria-label="Needs attention"
        />
      )}
      <span>{children}</span>
    </li>
  );
}

export function InstallPanel({
  botId,
  publicId,
  origin,
  allowedDomains,
  status,
  hasKnowledge,
}: {
  botId: string;
  publicId: string;
  origin: string;
  allowedDomains: string[];
  status: BotStatus;
  hasKnowledge: boolean;
}) {
  const [previewOn, setPreviewOn] = useState(false);

  const embedCode = `<script src="${origin}/widget.js" data-bot="${publicId}" async></script>`;
  const testPage = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Beacon test</title></head>
  <body>
    <h1>My test shop</h1>
    <p>The chat bubble should appear at the bottom right.</p>
    ${embedCode}
  </body>
</html>`;

  // The live preview adds the real widget script to this very page, the same way a
  // customer's website would. This page is Beacon's own, so it is always allowed.
  useEffect(() => {
    if (!previewOn) return;

    const script = document.createElement("script");
    script.src = "/widget.js";
    script.async = true;
    script.setAttribute("data-bot", publicId);
    document.body.appendChild(script);

    return () => {
      script.remove();
      (window as unknown as BeaconGlobal).BeaconWidget?.destroy();
      document.querySelectorAll("[data-beacon-widget]").forEach((element) => element.remove());
    };
  }, [previewOn, publicId]);

  const ready = status === "active" && hasKnowledge;

  return (
    <div className="mt-8 max-w-3xl space-y-8">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-semibold">Before it shows up</h2>
        <p className="mt-1 text-sm text-muted">
          The chat bubble only appears when all three of these are in place.
        </p>
        <ul className="mt-4 space-y-3">
          <CheckRow ok={status === "active"}>
            {status === "active" ? (
              "The bot is active."
            ) : (
              <>
                The bot is paused.{" "}
                <Link
                  href={`/dashboard/bots/${botId}`}
                  className="font-semibold text-brand underline-offset-4 hover:underline"
                >
                  Make it active in Settings.
                </Link>
              </>
            )}
          </CheckRow>
          <CheckRow ok={hasKnowledge}>
            {hasKnowledge ? (
              "The bot has knowledge it can answer from."
            ) : (
              <>
                The bot has nothing to answer from yet.{" "}
                <Link
                  href={`/dashboard/bots/${botId}/knowledge`}
                  className="font-semibold text-brand underline-offset-4 hover:underline"
                >
                  Add a source in Knowledge.
                </Link>
              </>
            )}
          </CheckRow>
          <CheckRow ok={allowedDomains.length > 0}>
            {allowedDomains.length > 0 ? (
              <>
                It may appear on:{" "}
                <span className="font-mono text-sm">{allowedDomains.join(", ")}</span>
              </>
            ) : (
              <>
                No websites are allowed yet, so the bubble won&rsquo;t show anywhere.{" "}
                <Link
                  href={`/dashboard/bots/${botId}`}
                  className="font-semibold text-brand underline-offset-4 hover:underline"
                >
                  Add your website in Settings.
                </Link>
              </>
            )}
          </CheckRow>
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-semibold">Your embed code</h2>
        <p className="mt-1 text-sm text-muted">
          Paste this on every page of your website where you want the chat, just before the
          closing <code className="rounded bg-sunken px-1 font-mono text-xs">&lt;/body&gt;</code>{" "}
          tag.
        </p>
        <div className="mt-4">
          <CopyBlock label="embed code" code={embedCode} />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-semibold">Try it here</h2>
        <p className="mt-1 text-sm text-muted">
          This adds the real widget to this page, the way it would appear on your website.
          {!ready && " Fix the items above first, or nothing will appear."}
        </p>
        <button
          type="button"
          onClick={() => setPreviewOn((on) => !on)}
          aria-pressed={previewOn}
          className="mt-4 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-strong"
        >
          {previewOn ? "Hide the widget" : "Show the widget on this page"}
        </button>
        {previewOn && (
          <p className="mt-3 text-sm text-muted">
            Look for the round button at the bottom of your screen.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-semibold">Test it on a real page</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
          <li>
            In Settings, add{" "}
            <code className="rounded bg-sunken px-1 font-mono text-xs">localhost</code> to Allowed
            websites and save.
          </li>
          <li>
            Save the page below as{" "}
            <code className="rounded bg-sunken px-1 font-mono text-xs">test.html</code> in an empty
            folder.
          </li>
          <li>
            In that folder, run{" "}
            <code className="rounded bg-sunken px-1 font-mono text-xs">npx serve -l 5000 .</code>{" "}
            and open{" "}
            <code className="rounded bg-sunken px-1 font-mono text-xs">
              http://localhost:5000/test.html
            </code>
            . (A file opened straight from your disk can&rsquo;t be checked, so it needs a local
            server.)
          </li>
        </ol>
        <div className="mt-4">
          <CopyBlock label="test page" code={testPage} />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-sunken/60 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold">How the website check works</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The widget asks Beacon whether it may appear, and the browser tells Beacon which website
          is asking (a web page can&rsquo;t fake that). Websites not on your list get no bubble and
          no chat. This stops other websites from putting your bot on their pages. It can&rsquo;t
          stop a person who calls the chat directly from their own program, which is why every
          visitor, network address and bot also has a daily message limit.
        </p>
      </section>
    </div>
  );
}
