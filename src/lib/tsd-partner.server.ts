/**
 * TSD Bridge partner link (server-only). Contract agreed with the TSD team
 * (tsd-reply-to-cryptopop.md):
 *   GET  {TSD}/api/public/partner/v1/nonce      -> { nonce } (10 min, single use)
 *   POST {TSD}/api/public/partner/v1/accounts   -> 200 ready | 202 pending_confirmation
 *   Headers: X-Partner: pop-wallet, X-Timestamp: unix seconds (5-min window),
 *            X-Signature: hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 * TSD verifies the member's Honest Money ticket itself and ignores any member
 * fields we send. Until the secret is set and the bridge answers, callers get "not_ready".
 */
const TSD = "https://tsd.honest.money";
const PARTNER = "pop-wallet";

export type PartnerNetwork = { chain: string; label: string; tokens: { symbol: string; contract: string }[] };
export type PartnerAccount = {
  status: "ready";
  depositAddress: string;
  networks: PartnerNetwork[];
  destination: string;
};
export type PartnerPending = { status: "pending_confirmation"; onFile: string };
export type PartnerResult = PartnerAccount | PartnerPending | { status: "not_ready"; reason: string; code?: string };

async function hmacHex(key: string, body: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(body)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function partnerHeaders(secret: string, body: string, now = Date.now()) {
  const ts = String(Math.floor(now / 1000));
  return { "Content-Type": "application/json", "X-Partner": PARTNER, "X-Timestamp": ts, "X-Signature": await hmacHex(secret, `${ts}.${body}`) };
}

const EVM = /^0x[a-fA-F0-9]{40}$/;

/** Accept only a well-formed reply bound to the destination we asked for. */
export function parsePartnerAccount(raw: unknown, destination: string): PartnerAccount {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.depositAddress !== "string" || !EVM.test(r.depositAddress)) throw new Error("bad_deposit_address");
  if (r.destination !== destination) throw new Error("destination_mismatch");
  const nets = Array.isArray(r.networks) ? r.networks : [];
  const networks: PartnerNetwork[] = nets.flatMap((n) => {
    const x = n as Record<string, unknown>;
    if (typeof x.chain !== "string" || typeof x.label !== "string" || !Array.isArray(x.tokens)) return [];
    const tokens = x.tokens.flatMap((t) => {
      const y = t as Record<string, unknown>;
      return typeof y.symbol === "string" && typeof y.contract === "string" && EVM.test(y.contract) ? [{ symbol: y.symbol.slice(0, 12), contract: y.contract }] : [];
    });
    return tokens.length ? [{ chain: x.chain.slice(0, 32), label: x.label.slice(0, 40), tokens }] : [];
  });
  if (!networks.length) throw new Error("no_networks");
  return { status: "ready", depositAddress: r.depositAddress, networks, destination };
}

const ERRORS: Record<string, string> = {
  partner_auth: "TSD Bridge didn't recognise CryptoPOP. We're on it.",
  sso_invalid: "Your Honest Money approval expired. Tap set up again.",
  bad_signature: "Your wallet's approval didn't check out. Try again.",
  replay: "That approval was already used. Tap set up again.",
};

/** Map a bridge reply to what the wallet shows. Never trusts a ready reply for another address. */
export function interpretPartnerReply(status: number, raw: unknown, destination: string, retryAfter?: string | null): PartnerResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (status === 200) return parsePartnerAccount(raw, destination);
  if (status === 202 && r.status === "pending_confirmation") {
    const onFile = typeof r.destination === "string" ? r.destination.slice(0, 64) : "";
    return { status: "pending_confirmation", onFile };
  }
  if (status === 404) return { status: "not_ready", reason: "TSD Bridge hasn't turned on automatic setup yet." };
  if (status === 429) {
    const s = Number(retryAfter);
    return { status: "not_ready", code: "rate_limited", reason: `Too many tries. Wait ${Number.isFinite(s) && s > 0 ? Math.ceil(s / 60) : 1} min and try again.` };
  }
  const code = typeof r.error === "string" ? r.error : "";
  return { status: "not_ready", code: code || undefined, reason: ERRORS[code] ?? "TSD Bridge couldn't set up your account right now." };
}

export async function getTsdNonce(): Promise<{ nonce: string } | { status: "not_ready"; reason: string }> {
  const secret = process.env["TSD_PARTNER_SECRET"];
  if (!secret) return { status: "not_ready", reason: "Automatic setup isn't switched on yet." };
  try {
    const res = await fetch(`${TSD}/api/public/partner/v1/nonce`, { headers: await partnerHeaders(secret, "") });
    if (!res.ok) {
      const err = ((await res.json().catch(() => ({}))) as { error?: unknown }).error;
      if (res.status === 404 || err === "partner_disabled") return { status: "not_ready", reason: "TSD Bridge hasn't switched on automatic setup for CryptoPOP yet." };
      if (err === "partner_auth") return { status: "not_ready", reason: ERRORS.partner_auth };
      return { status: "not_ready", reason: "TSD Bridge didn't answer. Try again in a minute." };
    }
    const j = (await res.json()) as { nonce?: unknown };
    if (typeof j.nonce !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(j.nonce)) return { status: "not_ready", reason: "TSD Bridge sent something unexpected." };
    return { nonce: j.nonce };
  } catch {
    return { status: "not_ready", reason: "TSD Bridge didn't answer. Try again in a minute." };
  }
}

export async function linkTsdAccount(input: {
  ssoTicket: string; state: string; destination: string; message: string; signature: string; nonce: string; issuedAt: string;
}): Promise<PartnerResult> {
  const secret = process.env["TSD_PARTNER_SECRET"];
  if (!secret) return { status: "not_ready", reason: "Automatic setup isn't switched on yet." };
  const body = JSON.stringify(input);
  try {
    const res = await fetch(`${TSD}/api/public/partner/v1/accounts`, { method: "POST", headers: await partnerHeaders(secret, body), body });
    const raw = await res.json().catch(() => null);
    if (!res.ok && res.status !== 202) console.warn("[tsd partner] link failed", res.status, JSON.stringify(raw)?.slice(0, 200));
    return interpretPartnerReply(res.status, raw, input.destination, res.headers.get("Retry-After"));
  } catch (e) {
    console.warn("[tsd partner] link error", e);
    return { status: "not_ready", reason: "TSD Bridge didn't answer. Try again in a minute." };
  }
}
