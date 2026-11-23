import "server-only";

/**
 * The network address a request came from. On Vercel the platform sets
 * x-forwarded-for itself, so the first address is the real client. Without it
 * (for example on your own computer) every request shares the "unknown" address.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** The address Beacon itself is served from, like https://beacon.example.com. */
export function requestOrigin(request: Request): string {
  return new URL(request.url).origin;
}

/**
 * True when the request comes from one of Beacon's own pages. A browser sends an
 * Origin header on every cross-origin request and on same-origin POSTs, and a web
 * page cannot change it. So another website's script can't make a visitor's
 * browser call the chat API: the chat only works from inside Beacon's own frame.
 * (Programs outside a browser can still send any header, which is why the rate
 * limits and the bot's daily cap are what actually protect the AI allowance.)
 */
export function isOwnPage(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === requestOrigin(request);
}
