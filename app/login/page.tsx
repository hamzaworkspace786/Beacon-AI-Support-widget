import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Sign in" };

// Signed-in visitors skip the login page. This reads the session, so it has
// to sit inside <Suspense> (Cache Components rule) and runs on every request.
async function RedirectIfSignedIn() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return null;
}

// One centered card: sign in and sign up share it. No side panel.
export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      {/* A soft indigo glow behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96"
        style={{
          background:
            "radial-gradient(60% 70% at 50% 0%, rgba(79, 70, 229, 0.14), transparent)",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-7 shadow-sm sm:p-8">
          <AuthForm />
        </div>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          Free portfolio project. Please don&rsquo;t upload anything private.
        </p>
      </div>
    </main>
  );
}
