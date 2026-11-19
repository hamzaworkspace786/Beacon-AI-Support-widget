import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-sm text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-8 font-display text-2xl font-semibold tracking-tight">
          This page doesn&rsquo;t exist
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          The link may be old, or the address may have a typo.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-strong"
        >
          Go to your bots
        </Link>
      </div>
    </main>
  );
}
