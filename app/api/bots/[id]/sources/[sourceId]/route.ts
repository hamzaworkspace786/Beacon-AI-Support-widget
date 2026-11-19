import { NextResponse } from "next/server";
import { getBot } from "@/lib/bots/store";
import { deleteSource } from "@/lib/knowledge/store";
import { getUserOrNull } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string; sourceId: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// DELETE /api/bots/:id/sources/:sourceId
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  const { id, sourceId } = await params;
  const bot = await getBot(user.id, id);
  if (!bot) return errorResponse("Bot not found.", 404);

  const deleted = await deleteSource(user.id, bot.id, sourceId);
  if (!deleted) return errorResponse("Source not found.", 404);

  return NextResponse.json({ ok: true });
}
