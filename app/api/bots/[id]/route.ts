import { NextResponse } from "next/server";
import { deleteBot, getBot, updateBot, type BotPatch } from "@/lib/bots/store";
import { firstIssue, parseDomains, updateBotSchema } from "@/lib/bots/validate";
import { getUserOrNull } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// GET /api/bots/:id
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  const { id } = await params;
  const bot = await getBot(user.id, id);
  if (!bot) return errorResponse("Bot not found.", 404);

  return NextResponse.json({ bot }, { headers: { "Cache-Control": "no-store" } });
}

// PATCH /api/bots/:id: changes only the fields that are sent.
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("The request could not be read.", 400);
  }

  const parsed = updateBotSchema.safeParse(body);
  if (!parsed.success) return errorResponse(firstIssue(parsed.error), 400);

  const { allowedDomains, color, ...rest } = parsed.data;
  const patch: BotPatch = { ...rest };

  if (color !== undefined) patch.color = color.toLowerCase();

  if (allowedDomains !== undefined) {
    const cleaned = parseDomains(allowedDomains);
    if ("error" in cleaned) return errorResponse(cleaned.error, 400);
    patch.allowedDomains = cleaned.domains;
  }

  if (Object.keys(patch).length === 0) return errorResponse("There is nothing to update.", 400);

  const { id } = await params;
  const bot = await updateBot(user.id, id, patch);
  if (!bot) return errorResponse("Bot not found.", 404);

  return NextResponse.json({ bot });
}

// DELETE /api/bots/:id
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getUserOrNull();
  if (!user) return errorResponse("Sign in to continue.", 401);

  const { id } = await params;
  const deleted = await deleteBot(user.id, id);
  if (!deleted) return errorResponse("Bot not found.", 404);

  return NextResponse.json({ ok: true });
}
