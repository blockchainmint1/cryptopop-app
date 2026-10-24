/**
 * Simple per-instance sliding-window rate limiter for public endpoints.
 *
 * Why in-memory: the app runs on edge workers with no shared state service
 * configured. A per-instance window is not a global guarantee against a
 * distributed attacker, but it stops the abusive bursts (scrapers, loops,
 * hammering the APK proxy or the link relay) that the audit flagged, at zero
 * extra latency for normal users. Keys are client IP + route scope.
 */

export type RateLimitRule = { limit: number; windowMs: number };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

/** Best-effort caller identity: edge client IP, falling back to proxy hops. */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf;
  const real = headers.get("x-real-ip");
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

export function checkRateLimit(
  key: string,
  { limit, windowMs }: RateLimitRule,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Periodically drop expired buckets so the map cannot grow unbounded.
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(k);
    if (buckets.size > 50_000) buckets.clear(); // safety valve under flood
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Central rules for the unauthenticated endpoints the audit called out. */
export function rateLimitForPath(pathname: string, headers: Headers): Response | null {
  let rule: RateLimitRule | null = null;
  let scope = pathname;

  if (pathname === "/api/public/apk") {
    // Streams a multi-megabyte file from IPFS — keep this tight.
    rule = { limit: 10, windowMs: 60_000 };
  } else if (pathname.startsWith("/api/nectar.link")) {
    // Proxies external fetches — stricter than ordinary reads.
    rule = { limit: 30, windowMs: 60_000 };
  } else if (pathname.startsWith("/api/public/")) {
    rule = { limit: 120, windowMs: 60_000 };
  } else if (pathname.startsWith("/lovable/email/")) {
    // The cron-driven queue processor is already bearer-gated to the service
    // key and fires from a datacenter IP, so it is exempt from IP limiting.
    if (pathname === "/lovable/email/queue/process") return null;
    rule = { limit: 120, windowMs: 60_000 };
  }
  if (!rule) return null;

  const ip = clientIp(headers);
  const { allowed, retryAfterSeconds } = checkRateLimit(`${scope}:${ip}`, rule);
  if (allowed) return null;
  return Response.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(Math.max(retryAfterSeconds, 1)) } },
  );
}
