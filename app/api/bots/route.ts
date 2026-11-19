import { NextResponse } from "next/server";
import { MAX_BOTS_PER_USER } from "@/lib/constants";
import { countBots, createBot, listBots } from "@/lib/bots/store";
import { createBotSchema, firstIssue } from "@/lib/bots/validate";
import { getUserOrNull } from "@/lib/session";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// GET /api/bots: the signed-in user's bots, newest first.
export async function GET() {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  const bots = await listBots(user.id);
  return NextResponse.json({ bots }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/bots { name }: creates a bot with default settings.
export async function POST(request: Request) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The request could not be read.", 400);
  }

  const parsed = createBotSchema.safeParse(body);
  if (!parsed.success) return errorResponse(firstIssue(parsed.error), 400);

  if ((await countBots(user.id)) >= MAX_BOTS_PER_USER) {
    return errorResponse(
      `You can have up to ${MAX_BOTS_PER_USER} bots. Delete one to add another.`,
      403,
    );
  }

  const bot = await createBot(user.id, parsed.data.name);
  return NextResponse.json({ bot }, { status: 201 });
}
