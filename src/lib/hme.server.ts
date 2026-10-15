/** Honest Money ecosystem (honest.money/api) — server-only helpers. */

const HUB = "https://honest.money";
export const HME_SERVICE = "cryptopop";

function secret(): string {
  const s = process.env["HME_HMAC_SECRET"];
  if (!s) throw new Error("HME_HMAC_SECRET not configured");
  return s;
}

function b64urlDecode(s: string): string {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(pad), (c) => c.charCodeAt(0)));
}

async function hmacHex(key: string, body: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export type HmeTicket = { minerId: string; email: string; exp: number; nonce: string; redirect?: string };

/** Verifies signature + expiry. Nonce replay is checked by the caller. */
export async function verifyHmeTicket(token: string): Promise<HmeTicket> {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("bad_ticket");
  const mac = await hmacHex(secret(), body);
  if (!safeEqual(mac, sig.toLowerCase())) throw new Error("bad_signature");
  const t = JSON.parse(b64urlDecode(body)) as HmeTicket;
  if (!t.minerId || !t.email || !t.nonce || !t.exp) throw new Error("bad_ticket");
  if (t.exp * 1000 < Date.now()) throw new Error("expired");
  return t;
}

export type HubEvent = {
  event: "signup" | "service_used" | "purchase" | "wallet_download";
  member_id?: string | null;
  email?: string | null;
  ref?: string | null;
  metadata?: Record<string, unknown>;
};

/** Fire-and-forget report to the honest.money hub. Never throws. */
export async function sendHubEvent(e: HubEvent): Promise<void> {
  const s = process.env["HME_HMAC_SECRET"];
  if (!s) return;
  const payload: Record<string, unknown> = { service: HME_SERVICE, event: e.event };
  if (e.member_id) payload.member_id = e.member_id;
  else if (e.email) payload.email = e.email;
  else return;
  if (e.ref) payload.ref = e.ref;
  if (e.metadata) payload.metadata = e.metadata;
  try {
    const res = await fetch(`${HUB}/api/public/hub/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${s}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn("[hub event]", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.warn("[hub event]", err);
  }
}
