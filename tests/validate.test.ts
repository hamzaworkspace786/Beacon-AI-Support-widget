import assert from "node:assert/strict";
import test from "node:test";
import { readableTextColor } from "../lib/color";
import {
  createBotSchema,
  normalizeDomain,
  parseDomains,
  updateBotSchema,
} from "../lib/bots/validate";

test("normalizeDomain keeps just the host name", () => {
  assert.equal(normalizeDomain("https://Shop.Example.com/page?x=1#top"), "shop.example.com");
  assert.equal(normalizeDomain("  example.com/  "), "example.com");
  assert.equal(normalizeDomain("shop.example.com:8080"), "shop.example.com");
  assert.equal(normalizeDomain("example.com."), "example.com");
});

test("normalizeDomain allows wildcards and localhost", () => {
  assert.equal(normalizeDomain("*.example.com"), "*.example.com");
  assert.equal(normalizeDomain("localhost"), "localhost");
  assert.equal(normalizeDomain("http://localhost:3000"), "localhost");
});

test("normalizeDomain rejects things that are not website addresses", () => {
  assert.equal(normalizeDomain(""), null);
  assert.equal(normalizeDomain("not a domain"), null);
  assert.equal(normalizeDomain("example"), null);
  assert.equal(normalizeDomain("*example.com"), null);
  assert.equal(normalizeDomain("exa mple.com"), null);
  assert.equal(normalizeDomain("-bad-.com"), null);
});

test("parseDomains skips blanks, removes repeats and reports the bad entry", () => {
  const ok = parseDomains(["Example.com", "", "https://example.com/path", "shop.example.org"]);
  assert.deepEqual(ok, { domains: ["example.com", "shop.example.org"] });

  const bad = parseDomains(["example.com", "nonsense"]);
  assert.ok("error" in bad);
  assert.match((bad as { error: string }).error, /nonsense/);
});

test("parseDomains refuses more than ten domains", () => {
  const many = Array.from({ length: 11 }, (_, i) => `site${i}.example.com`);
  assert.ok("error" in parseDomains(many));
});

test("createBotSchema needs a real name", () => {
  assert.equal(createBotSchema.safeParse({ name: "   " }).success, false);
  assert.equal(createBotSchema.safeParse({ name: "x".repeat(41) }).success, false);
  assert.equal(createBotSchema.safeParse({ name: "ShopBot" }).success, true);
  assert.equal(createBotSchema.safeParse({}).success, false);
});

test("updateBotSchema validates each field and rejects unknown ones", () => {
  assert.equal(updateBotSchema.safeParse({ color: "red" }).success, false);
  assert.equal(updateBotSchema.safeParse({ color: "#F4D35E" }).success, true);
  assert.equal(updateBotSchema.safeParse({ status: "deleted" }).success, false);
  assert.equal(updateBotSchema.safeParse({ greeting: "" }).success, false);
  assert.equal(updateBotSchema.safeParse({ userId: "someone-else" }).success, false);
  assert.equal(updateBotSchema.safeParse({ name: "Bot", status: "paused" }).success, true);
});

test("readableTextColor picks the text color with better contrast", () => {
  assert.equal(readableTextColor("#f4d35e"), "#0f1722"); // yellow gets dark text
  assert.equal(readableTextColor("#ffffff"), "#0f1722");
  assert.equal(readableTextColor("#1d4ed8"), "#ffffff"); // deep blue gets white text
  assert.equal(readableTextColor("#000000"), "#ffffff");
  assert.equal(readableTextColor("nonsense"), "#ffffff"); // invalid falls back safely
});
