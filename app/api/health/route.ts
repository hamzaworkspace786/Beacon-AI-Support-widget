import { NextResponse } from "next/server";
import { db } from "@/lib/mongodb";

// A public check that says whether Beacon and its database are up. It reveals
// nothing private: just ok or not, and whether the AI key is set (never the key).
export async function GET() {
  const started = performance.now();
  let database = false;
  try {
    await db.command({ ping: 1 });
    database = true;
  } catch (error) {
    console.error("Health check: the database did not answer:", error);
  }

  const body = {
    ok: database,
    database,
    ai: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    databaseMs: Math.round(performance.now() - started),
  };
  return NextResponse.json(body, {
    status: database ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
