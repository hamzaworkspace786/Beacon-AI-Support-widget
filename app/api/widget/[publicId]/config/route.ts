import { NextResponse } from "next/server";
import { getBotForPublic } from "@/lib/bots/store";
import { countReadySources } from "@/lib/knowledge/store";
import { isOriginAllowed } from "@/lib/widget/rules";
import { requestOrigin } from "@/lib/widget/request";

type RouteContext = { params: Promise<{ publicId: string }> };

// The widget script on a customer's website calls this from the customer's own
// page, so it has to be readable from any origin. What it returns is only what
// the chat bubble needs to draw itself, and only when the page asking is allowed.
// For any other page the answer is just { enabled: false }, so a website that
// isn't on the bot's list learns nothing about the bot.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

function disabled() {
  return NextResponse.json({ enabled: false }, { headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/widget/:publicId/config
export async function GET(request: Request, { params }: RouteContext) {
  const { publicId } = await params;
  const bot = await getBotForPublic(publicId);
  if (!bot || bot.status !== "active") return disabled();

  // The browser fills in Origin and a web page can't change it.
  const allowed = isOriginAllowed(
    request.headers.get("origin"),
    requestOrigin(request),
    bot.allowedDomains,
  );
  if (!allowed) return disabled();

  // With nothing to answer from, a chat bubble would only disappoint people.
  if ((await countReadySources(bot.ownerId, bot.id)) === 0) return disabled();

  return NextResponse.json(
    { enabled: true, name: bot.name, greeting: bot.greeting, color: bot.color },
    { headers: CORS_HEADERS },
  );
}
