/**
 * TSD Bridge partner link (server-only). CryptoPOP vouches for a verified
 * Honest Money member and a wallet-signed TSD/TXC address; the bridge creates
 * or reuses the member's account and returns their EVM deposit address.
 *
 * Contract proposed to the TSD team (see /mnt/documents/tsd-partner-request.md):
 *   POST {TSD_ORIGIN}/api/public/partner/v1/accounts
 *   GET  {TSD_ORIGIN}/api/public/partner/v1/accounts/{memberId}/status
 *   Headers: X-Partner: pop-wallet, X-Timestamp: unix seconds,
 *            X-Signature: hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 * Until the secret is set and the bridge answers, callers get "not_ready".
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
export type PartnerResult = PartnerAccount | { status: "not_ready"; reason: string };

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

export async function linkTsdAccount(input: {
  memberId: string; email: string; destination: string; message: string; signature: string;
}): Promise<PartnerResult> {
  const secret = process.env["TSD_PARTNER_SECRET"];
  if (!secret) return { status: "not_ready", reason: "Automatic setup isn't switched on yet." };
  const body = JSON.stringify(input);
  try {
    const res = await fetch(`${TSD}/api/public/partner/v1/accounts`, { method: "POST", headers: await partnerHeaders(secret, body), body });
    if (res.status === 404) return { status: "not_ready", reason: "TSD Bridge hasn't turned on automatic setup yet." };
    if (!res.ok) {
      console.warn("[tsd partner] link failed", res.status, (await res.text()).slice(0, 300));
      return { status: "not_ready", reason: "TSD Bridge couldn't set up your account right now." };
    }
    return parsePartnerAccount(await res.json(), input.destination);
  } catch (e) {
    console.warn("[tsd partner] link error", e);
    return { status: "not_ready", reason: "TSD Bridge didn't answer. Try again in a minute." };
  }
}
