import { describe, expect, it } from "vitest";
import { checkRateLimit, clientIp, rateLimitForPath } from "./rate-limit.server";

describe("checkRateLimit", () => {
  it("allows calls up to the limit in one window", () => {
    const key = `test-a:${Date.now()}:${Math.random()}`;
    const rule = { limit: 3, windowMs: 1_000 };
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, rule).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(1);
  });

  it("allows again after the window expires", async () => {
    const key = `test-b:${Date.now()}:${Math.random()}`;
    const rule = { limit: 1, windowMs: 60 };
    expect(checkRateLimit(key, rule).allowed).toBe(true);
    expect(checkRateLimit(key, rule).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(checkRateLimit(key, rule).allowed).toBe(true);
  });
});

describe("rateLimitForPath", () => {
  it("blocks the APK proxy beyond 10 downloads per minute", () => {
    const headers = new Headers({ "cf-connecting-ip": "203.0.113.7" });
    const path = "/api/public/apk";
    let blocked = false;
    for (let i = 0; i < 12; i++) {
      if (rateLimitForPath(path, headers)) blocked = true;
    }
    expect(blocked).toBe(true);
  });

  it("leaves the bearer-gated email queue processor untouched", () => {
    expect(rateLimitForPath("/lovable/email/queue/process", new Headers())).toBeNull();
  });

  it("keys limits per client IP, not globally", () => {
    // Exhaust one IP's budget on a normal public read (limit 120) and confirm
    // a different IP is unaffected.
    const busy = new Headers({ "cf-connecting-ip": "203.0.113.8" });
    const fresh = new Headers({ "cf-connecting-ip": "203.0.113.9" });
    const path = "/api/public/build-id";
    for (let i = 0; i < 121; i++) rateLimitForPath(path, busy);
    expect(rateLimitForPath(path, busy)).not.toBeNull();
    expect(rateLimitForPath(path, fresh)).toBeNull();
  });

  it("ignores pages and ordinary routes", () => {
    expect(rateLimitForPath("/", new Headers())).toBeNull();
    expect(rateLimitForPath("/dashboard", new Headers())).toBeNull();
  });
});

describe("clientIp", () => {
  it("prefers the edge client IP header", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to unknown without proxy headers", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("server function throttle (audit H2)", () => {
  it("blocks the 181st server-function call per minute from one IP", async () => {
    const { rateLimitForPath } = await import("./rate-limit.server");
    const h = new Headers({ "cf-connecting-ip": "203.0.113.77" });
    for (let i = 0; i < 180; i++) expect(rateLimitForPath("/_serverFn/abc", h)).toBeNull();
    expect(rateLimitForPath("/_serverFn/xyz", h)?.status).toBe(429);
  });
});
