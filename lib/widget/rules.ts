// Pure rules for the public widget: which websites may show a bot, and what a
// valid visitor id looks like. No database and no server code, so they can be tested alone.

/** The host name of a web address, lowercase. Null when it isn't an http(s) address. */
export function hostFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Is this host in the bot's list of allowed websites?
 *   "example.com"    matches example.com and www.example.com
 *   "*.example.com"  matches every subdomain (shop.example.com, a.b.example.com),
 *                    but not example.com itself
 *   "localhost"      matches localhost on any port
 */
export function hostAllowed(host: string, allowed: string[]): boolean {
  const lower = host.toLowerCase();
  const bare = lower.replace(/^www\./, "");

  return allowed.some((entry) => {
    const rule = entry.toLowerCase();
    if (rule.startsWith("*.")) return lower.endsWith(`.${rule.slice(2)}`);
    return bare === rule.replace(/^www\./, "");
  });
}

/**
 * May a page at this address show the bot inside a frame? The browser tells the
 * server which page is framing it (the Referer header, which a web page cannot
 * forge), and the server compares it with the bot's list. Our own pages (the
 * install preview in the dashboard) are always fine. A missing or unreadable
 * referrer is refused: the answer must be a clear yes.
 */
export function isFrameAllowed(
  context: { referer: string | null; secFetchSite: string | null },
  allowed: string[],
): boolean {
  if (context.secFetchSite === "same-origin") return true;
  const host = hostFromUrl(context.referer);
  return host !== null && hostAllowed(host, allowed);
}

/**
 * May a page that sent this Origin header load the widget's settings? A request
 * made by our own pages has no Origin header, or our own origin. "null" (a sandboxed
 * frame or a local file) and anything unreadable is refused.
 */
export function isOriginAllowed(
  origin: string | null,
  appOrigin: string | null,
  allowed: string[],
): boolean {
  if (!origin) return true;
  if (appOrigin && origin === appOrigin) return true;
  const host = hostFromUrl(origin);
  return host !== null && hostAllowed(host, allowed);
}

const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A visitor id is a random UUID the widget makes in the visitor's browser. */
export function isValidVisitorId(value: string | null | undefined): value is string {
  return typeof value === "string" && VISITOR_ID.test(value);
}
