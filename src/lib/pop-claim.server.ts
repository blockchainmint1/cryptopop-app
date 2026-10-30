/**
 * POP for spending at NectarPay merchants.
 * NectarPay decides how many POP a sale earned (POST /api/public/v1/pop/claim,
 * HMAC-signed with NFC_PAY_SECRET); we send the POP once per invoice.
 * Sales that aren't confirmed yet (or are held) are queued in pop_claims and retried.
 */
import { afterResponse } from "./background.server";

const CLAIM_URL = "https://app.nectar-pay.com/api/public/v1/pop/claim";
export const SHOPPER_DAILY_POP_CAP = 1000;
const GIVE_UP_MS = 24 * 3600 * 1000;
const HELD_GIVE_UP_MS = 31 * 24 * 3600 * 1000;

export type ClaimDecision =
  | { kind: "eligible"; pop: number; invoiceId: string; saleUsd: number; storeId: string | null; storeName: string | null }
  | { kind: "retry"; reason: string; releaseAt?: string | null }
  | { kind: "held"; reason: string | null; releaseAt: string | null }
  | { kind: "denied"; reason: string };

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function claimHeaders(secret: string, body: string, now = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${now}.${body}`)));
  return { "Content-Type": "application/json", "X-HME-Timestamp": String(now), "X-HME-Signature": sig };
}

/** Turn NectarPay's reply into what we do next. */
export function interpretClaim(httpStatus: number, j: Record<string, any> | null): ClaimDecision {
  if (httpStatus === 401) return { kind: "retry", reason: "partner_auth" };
  if (httpStatus === 404 || j?.status === "not_found") return { kind: "retry", reason: "not_found" };
  if (httpStatus === 202 || j?.status === "not_ready") return { kind: "retry", reason: "not_ready" };
  const status = String(j?.status ?? "");
  if (status === "eligible") {
    const pop = Math.floor(Number(j?.pop));
    const invoiceId = String(j?.invoice_id ?? "");
    if (!Number.isFinite(pop) || pop < 1 || !invoiceId) return { kind: "denied", reason: "zero_amount" };
    return { kind: "eligible", pop, invoiceId, saleUsd: Number(j?.sale_usd ?? 0), storeId: j?.store?.id ?? null, storeName: j?.store?.name ?? null };
  }
  if (status === "held") return { kind: "held", reason: j?.reason ?? null, releaseAt: j?.release_at ?? null };
  if (status === "denied" || httpStatus === 409) return { kind: "denied", reason: String(j?.reason ?? j?.error ?? "denied") };
  return { kind: "retry", reason: `http_${httpStatus}` };
}

/**
 * The line a shopper reads in their point history for a store sale.
 * NectarPay names the store on an eligible claim; without a name we say
 * what it was rather than the raw "nectarpay" source key.
 */
export function purchaseLabel(storeName: string | null | undefined) {
  const name = storeName?.trim();
  return name ? `Purchase @ ${name}`.slice(0, 80) : "NectarPay purchase";
}


async function askNectarPay(txid: string, wallet: string, payers: string[]): Promise<ClaimDecision> {
  const secret = process.env.NFC_PAY_SECRET;
  if (!secret) return { kind: "retry", reason: "no_secret" };
  const body = JSON.stringify({ txid, shopper_ref: wallet, payer_addresses: payers });
  try {
    const res = await fetch(CLAIM_URL, { method: "POST", headers: await claimHeaders(secret, body), body });
    const j = await res.json().catch(() => null);
    return interpretClaim(res.status, j);
  } catch {
    return { kind: "retry", reason: "network" };
  }
}

async function db() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** POP already sent to this wallet today (UTC) from NectarPay sales. */
async function poppedToday(wallet: string) {
  const sb = await db();
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { data } = await sb.from("pop_awards").select("amount").eq("wallet_address", wallet)
    .eq("source", "nectarpay").neq("status", "failed").gte("created_at", since.toISOString());
  return (data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
}

function backoffMs(attempts: number) {
  return Math.min(30_000 * 2 ** attempts, 3600_000);
}

/** Try one claim now; queue it if it's not decided yet. Returns POP sent (0 if none yet). */
export async function processClaim(txid: string): Promise<{ pop: number; status: string; decision?: ClaimDecision }> {
  const sb = await db();
  const { data: row } = await sb.from("pop_claims").select("*").eq("txid", txid).maybeSingle();
  if (!row) return { pop: 0, status: "missing" };
  if (row.status === "awarded") return { pop: row.pop ?? 0, status: "awarded" };
  if (row.status === "denied" || row.status === "expired") return { pop: 0, status: row.status };

  const d = await askNectarPay(txid, row.wallet_address, row.payer_addresses);
  const attempts = row.attempts + 1;
  const age = Date.now() - new Date(row.created_at).getTime();
  const upd = (patch: Record<string, unknown>) =>
    sb.from("pop_claims").update({ ...patch, attempts, updated_at: new Date().toISOString() }).eq("txid", txid);

  if (d.kind === "eligible") {
    // Our own per-shopper cap across all stores; over the cap waits until tomorrow.
    const today = await poppedToday(row.wallet_address);
    if (today + d.pop > SHOPPER_DAILY_POP_CAP) {
      const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 0, 0);
      await upd({ status: "held", reason: "shopper_daily_cap", invoice_id: d.invoiceId, pop: d.pop, next_try_at: tomorrow.toISOString() });
      return { pop: 0, status: "held", decision: d };
    }
    const { awardPop } = await import("./email-wallet.server");
    const res = await awardPop({
      email: `${row.wallet_address.toLowerCase()}@wallet.cryptopop.org`,
      amount: d.pop,
      source: "nectarpay",
      sourceId: d.invoiceId, // one award per sale, even if claimed twice
      memo: d.storeName ? `Shopping at ${d.storeName}` : "NectarPay purchase",
      label: purchaseLabel(d.storeName),
      walletOverride: row.wallet_address,
    });
    if (res.status === "failed") {
      await upd({ status: "pending", reason: "send_failed", invoice_id: d.invoiceId, pop: d.pop, next_try_at: new Date(Date.now() + backoffMs(attempts)).toISOString() });
      return { pop: 0, status: "pending", decision: d };
    }
    await upd({ status: "awarded", reason: null, invoice_id: d.invoiceId, pop: d.pop });
    return { pop: res.status === "sent" ? d.pop : 0, status: res.status, decision: d };
  }
  if (d.kind === "denied") {
    await upd({ status: "denied", reason: d.reason });
    return { pop: 0, status: "denied", decision: d };
  }
  if (d.kind === "held") {
    if (age > HELD_GIVE_UP_MS) { await upd({ status: "expired", reason: d.reason }); return { pop: 0, status: "expired" }; }
    const next = d.releaseAt && Date.parse(d.releaseAt) > Date.now() ? d.releaseAt : new Date(Date.now() + 24 * 3600_000).toISOString();
    await upd({ status: "held", reason: d.reason, next_try_at: next });
    return { pop: 0, status: "held", decision: d };
  }
  if (age > GIVE_UP_MS && d.reason !== "partner_auth" && d.reason !== "no_secret") {
    await upd({ status: "expired", reason: d.reason });
    return { pop: 0, status: "expired" };
  }
  await upd({ status: "pending", reason: d.reason, next_try_at: new Date(Date.now() + backoffMs(attempts)).toISOString() });
  return { pop: 0, status: "pending", decision: d };
}

async function recordClaim(opts: { txid: string; wallet: string; payers: string[]; origin: "card" | "qr" }) {
  const txid = opts.txid.toLowerCase();
  const sb = await db();
  await sb.from("pop_claims").upsert(
    { txid, wallet_address: opts.wallet, payer_addresses: opts.payers, origin: opts.origin },
    { onConflict: "txid", ignoreDuplicates: true },
  );
  return txid;
}

/**
 * Write down a sale we just paid, then chase the reward after the caller's
 * response is on its way. A point-of-sale reply must not wait on NectarPay
 * or on broadcasting the POP, so this only does the one quick database write.
 */
export async function queueClaim(opts: { txid: string; wallet: string; payers: string[]; origin: "card" | "qr" }) {
  const txid = await recordClaim(opts);
  afterResponse(() => processClaim(txid), "pop claim");
  afterResponse(() => retryDueClaims(), "pop claim queue");
  return { queued: true as const, txid };
}

/** Record a sale and wait for the answer, for callers that show the reward on screen. */
export async function startClaim(opts: { txid: string; wallet: string; payers: string[]; origin: "card" | "qr" }) {
  const txid = await recordClaim(opts);
  const r = await processClaim(txid);
  retryDueClaims().catch(() => undefined);
  return r;
}

/** Retry a few queued claims whose time has come. */
export async function retryDueClaims(limit = 5) {
  const sb = await db();
  const { data } = await sb.from("pop_claims").select("txid").in("status", ["pending", "held"])
    .lte("next_try_at", new Date().toISOString()).order("next_try_at").limit(limit);
  for (const r of data ?? []) await processClaim(r.txid).catch((e) => console.error("[pop claim]", e));
}
