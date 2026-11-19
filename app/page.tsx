import { redirect } from "next/navigation";

export default function Home() {
  // Phase 1 has no marketing page yet. The dashboard sends people to /login if needed.
  redirect("/dashboard");
}
