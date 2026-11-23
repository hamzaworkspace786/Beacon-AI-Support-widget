import assert from "node:assert/strict";
import test from "node:test";
import {
  hostAllowed,
  hostFromUrl,
  isFrameAllowed,
  isOriginAllowed,
  isValidVisitorId,
} from "../lib/widget/rules";

test("hostFromUrl returns a lowercase host for web addresses only", () => {
  assert.equal(hostFromUrl("https://Shop.Example.com/page?x=1"), "shop.example.com");
  assert.equal(hostFromUrl("http://localhost:3000/"), "localhost");
  assert.equal(hostFromUrl("ftp://example.com"), null);
  assert.equal(hostFromUrl("not a url"), null);
  assert.equal(hostFromUrl("null"), null); // what a sandboxed frame or a local file sends
  assert.equal(hostFromUrl(null), null);
  assert.equal(hostFromUrl(""), null);
});

test("hostAllowed: exact hosts, with or without www", () => {
  assert.equal(hostAllowed("example.com", ["example.com"]), true);
  assert.equal(hostAllowed("www.example.com", ["example.com"]), true);
  assert.equal(hostAllowed("example.com", ["www.example.com"]), true);
  assert.equal(hostAllowed("EXAMPLE.com", ["example.com"]), true);
  assert.equal(hostAllowed("localhost", ["localhost"]), true);
});

test("hostAllowed: other hosts and look-alikes are refused", () => {
  assert.equal(hostAllowed("shop.example.com", ["example.com"]), false);
  assert.equal(hostAllowed("evilexample.com", ["example.com"]), false);
  assert.equal(hostAllowed("example.com.evil.com", ["example.com"]), false);
  assert.equal(hostAllowed("example.org", ["example.com"]), false);
  assert.equal(hostAllowed("x.com", []), false);
});

test("hostAllowed: a wildcard matches subdomains but not the bare domain or look-alikes", () => {
  assert.equal(hostAllowed("shop.example.com", ["*.example.com"]), true);
  assert.equal(hostAllowed("a.b.example.com", ["*.example.com"]), true);
  assert.equal(hostAllowed("www.example.com", ["*.example.com"]), true);
  assert.equal(hostAllowed("example.com", ["*.example.com"]), false);
  assert.equal(hostAllowed("evilexample.com", ["*.example.com"]), false);
  assert.equal(hostAllowed("shop.example.com.evil.com", ["*.example.com"]), false);
});

test("isFrameAllowed: decided by the framing website's Referer", () => {
  const allowed = ["shop.example.com"];
  assert.equal(
    isFrameAllowed({ referer: "https://shop.example.com/", secFetchSite: "cross-site" }, allowed),
    true,
  );
  assert.equal(
    isFrameAllowed({ referer: "https://other.com/", secFetchSite: "cross-site" }, allowed),
    false,
  );
  // Nobody said who is asking: refuse. This also covers someone opening the chat's address directly.
  assert.equal(isFrameAllowed({ referer: null, secFetchSite: "cross-site" }, allowed), false);
  assert.equal(isFrameAllowed({ referer: null, secFetchSite: "none" }, allowed), false);
  assert.equal(isFrameAllowed({ referer: "garbage", secFetchSite: "cross-site" }, allowed), false);
  assert.equal(
    isFrameAllowed({ referer: "https://shop.example.com/", secFetchSite: "cross-site" }, []),
    false,
  );
});

test("isFrameAllowed: Beacon's own pages are always fine", () => {
  assert.equal(isFrameAllowed({ referer: null, secFetchSite: "same-origin" }, []), true);
});

test("isOriginAllowed: no Origin means one of our own pages; others must be on the list", () => {
  const allowed = ["shop.example.com"];
  const app = "https://beacon.example.app";
  assert.equal(isOriginAllowed(null, app, allowed), true);
  assert.equal(isOriginAllowed(app, app, []), true);
  assert.equal(isOriginAllowed("https://shop.example.com", app, allowed), true);
  assert.equal(isOriginAllowed("https://other.com", app, allowed), false);
  assert.equal(isOriginAllowed("null", app, allowed), false);
  assert.equal(isOriginAllowed("https://shop.example.com", app, []), false);
});

test("isValidVisitorId accepts UUIDs and nothing else", () => {
  assert.equal(isValidVisitorId("3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c"), true);
  assert.equal(isValidVisitorId("3F2B8C1E-9A4D-4E7B-8C21-5D6E7F8A9B0C"), true);
  assert.equal(isValidVisitorId("not-a-uuid"), false);
  assert.equal(isValidVisitorId("3f2b8c1e9a4d4e7b8c215d6e7f8a9b0c"), false);
  assert.equal(isValidVisitorId("3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c; drop"), false);
  assert.equal(isValidVisitorId(""), false);
  assert.equal(isValidVisitorId(null), false);
  assert.equal(isValidVisitorId(undefined), false);
});
