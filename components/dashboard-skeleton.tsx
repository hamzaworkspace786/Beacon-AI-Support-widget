import { Logo } from "@/components/logo";

// Shown while the signed-in dashboard data loads, so the page never looks blank.
export function DashboardSkeleton() {
  return (
    <div
      className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]"
      aria-busy="true"
      aria-label="Loading"
    >
      <header className="flex h-14 items-center bg-sidebar px-4 lg:hidden">
        <Logo variant="light" />
      </header>
      <aside className="hidden bg-sidebar lg:block">
        <div className="px-5 pt-6">
          <Logo variant="light" />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-5xl">
          <div className="h-9 w-44 animate-pulse rounded-lg bg-sunken" />
          <div className="mt-6 h-28 animate-pulse rounded-2xl bg-sunken" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-36 animate-pulse rounded-2xl bg-sunken" />
            <div className="h-36 animate-pulse rounded-2xl bg-sunken" />
          </div>
        </div>
      </main>
    </div>
  );
}
