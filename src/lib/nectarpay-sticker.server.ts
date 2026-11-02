/**
 * NectarPay printed-sticker partner API (POST /api/public/v1/stickers/{lookup,invoice}).
 * Requests are HMAC-signed with NFC_PAY_SECRET; replies are signed back and bound
 * to our exact request, so a tampered store wallet address is rejected.
 */
import { claimHeaders } from "./pop-claim.server";

const BASE = "https://app.nectar-pay.com/api/public/v1/stickers";

export type StickerResult = {
  name: string;
  logoUrl: string | null;
  storeId: string | null;
  address: string;
  egiving: { accepted: boolean; discountPct: number | null; merchantMinimumUsd: number | null };
  invoiceId: string | null;
  tsdAmount: number | null;
  minAmount: number;
  maxAmount: number;
  error?: undefined;
} | { error: string };

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function stickerResponseSignature(secret: string, reqRaw: string, respRaw: string, ts: string) {
  const reqHash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(reqRaw)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`sticker-response.${ts}.${reqHash}.${respRaw}`)));
}

export async function callSticker(kind: "lookup" | "invoice", input: { code: string; amount?: number }): Promise<StickerResult> {
  const secret = process.env["NFC_PAY_SECRET"];
  if (!secret) return { error: "Store lookup isn't set up." };
  const body = JSON.stringify({ ...input, request_id: crypto.randomUUID() });
  let res: Response;
  try {
    res = await fetch(`${BASE}/${kind}`, {
      method: "POST",
      headers: { ...(await claimHeaders(secret, body)), Accept: "application/json", "User-Agent": "Mozilla/5.0 (CryptoPOP wallet)" },
      body,
    });
  } catch {
    return { error: "Couldn't reach NectarPay. Try again." };
  }
  const text = await res.text();
  const ts = res.headers.get("x-hme-timestamp") ?? "";
  const sig = res.headers.get("x-hme-signature") ?? "";
  if (!ts || !sig || sig !== (await stickerResponseSignature(secret, body, text, ts)) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    return { error: res.status === 401 ? "NectarPay refused the store lookup." : "Store details couldn't be verified. Don't pay this code." };
  }
  let j: Record<string, any>;
  try { j = JSON.parse(text); } catch { return { error: "Bad reply from NectarPay." }; }
  if (!res.ok || j.error) return { error: String(j.error ?? `NectarPay ${res.status}`) };
  if (j.chain !== "txc" || j.token_symbol !== "TSD" || typeof j.address !== "string") return { error: "This store isn't accepting TSD." };
  const e = j.egiving ?? {};
  const min = e.merchantMinimumUsd;
  return {
    name: String(j.merchant?.name ?? "Store"),
    logoUrl: j.merchant?.logo_url ?? null,
    storeId: j.store_id ?? j.merchant?.id ?? null,
    address: j.address,
    egiving: {
      accepted: e.accepted === true,
      discountPct: Number.isFinite(Number(e.discountPct)) ? Number(e.discountPct) : null,
      merchantMinimumUsd: min != null && Number.isFinite(Number(min)) ? Number(min) : null,
    },
    invoiceId: j.invoice_id ?? null,
    tsdAmount: j.crypto_amount != null ? Number(j.crypto_amount) : null,
    minAmount: Number(j.min_amount ?? 0.5),
    maxAmount: Number(j.max_amount ?? 250),
  };
}

/** Tell NectarPay we paid a sticker bill so it settles now (txid is a hint; NectarPay re-verifies on chain). */
export async function reportStickerPaid(input: { code: string; invoice_id: string; txid: string }): Promise<{ paid: boolean; status: string | null; error?: string }> {
  const secret = process.env["NFC_PAY_SECRET"];
  if (!secret) return { paid: false, status: null, error: "not configured" };
  const body = JSON.stringify({ ...input, request_id: crypto.randomUUID() });
  try {
    const res = await fetch(`${BASE}/paid`, {
      method: "POST",
      headers: { ...(await claimHeaders(secret, body)), Accept: "application/json", "User-Agent": "Mozilla/5.0 (CryptoPOP wallet)" },
      body,
    });
    const text = await res.text();
    const ts = res.headers.get("x-hme-timestamp") ?? "";
    const sig = res.headers.get("x-hme-signature") ?? "";
    if (!ts || sig !== (await stickerResponseSignature(secret, body, text, ts))) return { paid: false, status: null, error: `unverified ${res.status}` };
    const j = JSON.parse(text);
    if (!res.ok || j.error) return { paid: false, status: null, error: String(j.error ?? res.status) };
    return { paid: j.paid === true, status: j.status ?? null };
  } catch (e) {
    return { paid: false, status: null, error: (e as Error).message };
  }
}

export type QrLookupResult =
  | { kind: "invoice"; invoiceId: string; status: string; fiatAmount: number; currency: string; tsdAmount: number; address: string;
      name: string; logoUrl: string | null; storeId: string | null;
      egiving: { accepted: boolean; discountPct: number | null; merchantMinimumUsd: number | null } }
  | { kind: "sticker"; code: string }
  | { kind: "none"; reason: "not_found" | "ambiguous" | "error"; error: string };

/** Register QR (inv=… or bare address) → signed NectarPay sale details. The QR itself is never trusted. */
export async function lookupRegisterQr(input: { invoice_id?: string; address?: string }): Promise<QrLookupResult> {
  const secret = process.env["NFC_PAY_SECRET"];
  if (!secret) return { kind: "none", reason: "error", error: "Store lookup isn't set up." };
  const body = JSON.stringify({ request_id: crypto.randomUUID(), ...input });
  let res: Response;
  try {
    res = await fetch("https://app.nectar-pay.com/api/public/v1/qr/lookup", {
      method: "POST",
      headers: { ...(await claimHeaders(secret, body)), Accept: "application/json", "User-Agent": "Mozilla/5.0 (CryptoPOP wallet)" },
      body,
    });
  } catch {
    return { kind: "none", reason: "error", error: "Couldn't reach NectarPay. Try again." };
  }
  const text = await res.text();
  const ts = res.headers.get("x-hme-timestamp") ?? "";
  const sig = res.headers.get("x-hme-signature") ?? "";
  if (!ts || !sig || sig !== (await stickerResponseSignature(secret, body, text, ts)) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
    return { kind: "none", reason: "error", error: "Store details couldn't be verified. Don't pay this code." };
  }
  if (res.status === 404) return { kind: "none", reason: "not_found", error: "No open sale for this code." };
  if (res.status === 409) return { kind: "none", reason: "ambiguous", error: "This store has several open sales. Ask them to show the code again." };
  let j: Record<string, any>;
  try { j = JSON.parse(text); } catch { return { kind: "none", reason: "error", error: "Bad reply from NectarPay." }; }
  if (!res.ok || j.error) return { kind: "none", reason: "error", error: String(j.error ?? `NectarPay ${res.status}`) };
  if (j.kind === "sticker" && typeof j.code === "string" && /^[0-9A-Za-z]{6}$/.test(j.code)) return { kind: "sticker", code: j.code };
  if (j.kind !== "invoice") return { kind: "none", reason: "error", error: "Unknown reply from NectarPay." };
  if (j.chain !== "txc" || j.token_symbol !== "TSD" || typeof j.address !== "string" || !(Number(j.crypto_amount) > 0)) {
    return { kind: "none", reason: "error", error: "This sale isn't payable in TSD." };
  }
  const e = j.egiving ?? {};
  const num = (v: unknown) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    kind: "invoice",
    invoiceId: String(j.invoice_id),
    status: String(j.status ?? "new"),
    fiatAmount: Number(j.fiat_amount ?? 0),
    currency: String(j.currency ?? "USD"),
    tsdAmount: Number(j.crypto_amount),
    address: j.address,
    name: String(j.merchant?.name ?? "Store"),
    logoUrl: j.merchant?.logo_url ?? null,
    storeId: j.merchant?.id ?? null,
    egiving: { accepted: e.accepted === true, discountPct: num(e.discountPct), merchantMinimumUsd: num(e.merchantMinimumUsd) },
  };
}
