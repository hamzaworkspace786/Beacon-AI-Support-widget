import { z } from "zod";
import {
  BOT_NAME_MAX,
  BUSINESS_NAME_MAX,
  GREETING_MAX,
  MAX_ALLOWED_DOMAINS,
} from "../constants";

// Everything the browser sends is untrusted. These schemas and helpers decide
// what we accept, and their messages are written to be shown to the person.

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const HOST_PATTERN =
  /^(?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const botName = z
  .string()
  .trim()
  .min(1, "Enter a name for the bot.")
  .max(BOT_NAME_MAX, `Use ${BOT_NAME_MAX} characters or fewer for the name.`);

export const createBotSchema = z.strictObject({ name: botName });

export const updateBotSchema = z.strictObject({
  name: botName.optional(),
  businessName: z
    .string()
    .trim()
    .max(BUSINESS_NAME_MAX, `Use ${BUSINESS_NAME_MAX} characters or fewer for the business name.`)
    .optional(),
  greeting: z
    .string()
    .trim()
    .min(1, "Enter a greeting.")
    .max(GREETING_MAX, `Use ${GREETING_MAX} characters or fewer for the greeting.`)
    .optional(),
  color: z.string().regex(COLOR_PATTERN, "Pick a color like #4f46e5.").optional(),
  allowedDomains: z
    .array(z.string().max(255, "That domain is too long."))
    .max(MAX_ALLOWED_DOMAINS, `Add up to ${MAX_ALLOWED_DOMAINS} domains.`)
    .optional(),
  status: z.enum(["active", "paused"], "Choose active or paused.").optional(),
});

export type UpdateBotInput = z.infer<typeof updateBotSchema>;

/** The first problem found, as a sentence that is safe to show. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Something in the form isn't valid.";
}

/**
 * Turns what a person typed into a bare host name: "https://Shop.Example.com/page"
 * becomes "shop.example.com". Returns null when it can't be a website address.
 * "*.example.com" (every subdomain) and "localhost" (for testing) are allowed.
 */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""); // protocol
  value = value.split(/[/?#]/)[0] ?? ""; // path, query and hash
  value = value.replace(/:\d+$/, ""); // port
  value = value.replace(/\.$/, ""); // trailing dot

  if (value === "localhost") return value;
  return HOST_PATTERN.test(value) ? value : null;
}

/** Cleans a list of typed domains. Blank lines are skipped and repeats removed. */
export function parseDomains(list: string[]): { domains: string[] } | { error: string } {
  const domains: string[] = [];
  for (const raw of list) {
    if (!raw.trim()) continue;
    const domain = normalizeDomain(raw);
    if (!domain) {
      return {
        error: `"${raw.trim().slice(0, 60)}" isn't a valid domain. Use something like shop.example.com.`,
      };
    }
    if (!domains.includes(domain)) domains.push(domain);
  }
  if (domains.length > MAX_ALLOWED_DOMAINS) {
    return { error: `Add up to ${MAX_ALLOWED_DOMAINS} domains.` };
  }
  return { domains };
}
