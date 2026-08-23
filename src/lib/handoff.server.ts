/**
 * VectorPay top-up / cash-out handoff — server-only helpers.
 *
 * CryptoPOP never touches banks, KYC, Plaid or ACH. We create a signed order
 * and hand the customer to VectorPay, who is the seller/buyer of record and
 * owns identity verification, bank linking, pricing and settlement.
 */

const DEFAULT_ORDER_URL = "https://vector-pay.com/api/public/beekeeper";

function env(name: string): string | undefined {
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.[name];
}

export function handoffConfig(): { url: string; secret: string } | null {
  const secret = env("VECTORPAY_WEBHOOK_SECRET");
  if (!secret) return null;
  const url = env("VECTORPAY_ORDER_WEBHOOK_URL") || DEFAULT_ORDER_URL;
  return { url, secret };
}

export function handoffConfigured(): boolean {
  return handoffConfig() !== null;
}

/** Treasury deposit addresses for sell (cash out) orders: {"txc":"...","base":"0x..."} */
export function cashoutDepositAddress(chain: string): string | null {
  const raw = env("CASHOUT_DEPOSIT_ADDRESSES");
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    return map[chain.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

export async function signBody(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}

export async function verifySignature(body: string, header: string | null): Promise<boolean> {
  const cfg = handoffConfig();
  if (!cfg || !header) return false;
  const expected = await signBody(body, cfg.secret);
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

export type OrderPayload = Record<string, unknown>;

export async function postOrder(
  payload: OrderPayload,
): Promise<{ ok: boolean; detail: string | null; checkoutUrl: string | null }> {
  const cfg = handoffConfig();
  if (!cfg) return { ok: false, detail: "Top up isn't switched on yet.", checkoutUrl: null };

  // Sign the exact bytes we send — serialize once.
  const body = JSON.stringify(payload);
  let signature: string;
  try {
    signature = await signBody(body, cfg.secret);
  } catch (e) {
    console.error("[handoff] signing failed", e);
    return { ok: false, detail: "Could not sign the order.", checkoutUrl: null };
  }

  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-beekeeper-signature": signature,
        "x-partner-name": "CryptoPOP",
      },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[handoff] order rejected [${res.status}]: ${text.slice(0, 400)}`);
      const detail =
        res.status === 401
          ? "Order signature rejected by our payments partner."
          : res.status === 503
            ? "Our payments partner isn't accepting orders right now."
            : `Order rejected (HTTP ${res.status}).`;
      return { ok: false, detail, checkoutUrl: null };
    }
    let checkoutUrl: string | null = null;
    try {
      const json = JSON.parse(text) as { checkout_url?: string };
      const u = json.checkout_url;
      if (u && /^https?:\/\//i.test(u)) checkoutUrl = u;
    } catch {
      /* non-JSON body */
    }
    if (!checkoutUrl) {
      return { ok: true, detail: "Order created, but no checkout link was returned.", checkoutUrl: null };
    }
    return { ok: true, detail: null, checkoutUrl };
  } catch (e) {
    console.error("[handoff] network error", e);
    return {
      ok: false,
      detail: "Could not reach our payments partner. Your order reference is saved.",
      checkoutUrl: null,
    };
  }
}
