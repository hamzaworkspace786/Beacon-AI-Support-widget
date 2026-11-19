import Link from "next/link";
import { Bot } from "lucide-react";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";

// The frame around every dashboard page: a dark sidebar on large screens and a
// dark top bar on small ones, with the content on a light canvas.
export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <header className="flex h-14 items-center justify-between gap-3 bg-sidebar px-4 lg:hidden">
        <Link href="/dashboard" aria-label="Beacon home">
          <Logo variant="light" />
        </Link>
        <UserMenu name={user.name} email={user.email} compact />
      </header>

      <aside className="hidden bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-5 pb-6 pt-6">
          <Link href="/dashboard" aria-label="Beacon home">
            <Logo variant="light" />
          </Link>
        </div>

        <nav aria-label="Main" className="flex-1 px-3">
          <Link
            href="/dashboard"
            aria-current="page"
            className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium text-white"
          >
            <Bot size={18} aria-hidden="true" />
            Bots
          </Link>
        </nav>

        <div className="border-t border-white/10 p-4">
          <UserMenu name={user.name} email={user.email} />
        </div>
      </aside>

      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
