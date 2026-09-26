// NectarPay bridge — server side so the wallet never deals with CORS and so
// POP rewards are verified against NectarPay before anything is minted.
//
// NectarPay endpoints used:
//   GET/POST /api/public/v1/pay/:id?t=<nonce>            (tap-to-pay, exists)
//   GET      /api/public/v1/invoices/:id/public           (read, no nonce)
//   POST     /api/public/v1/invoices/:id/public/select    (pick txc:TSD)
//   GET      /api/public/v1/merchants?token=TSD           (directory)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  NECTARPAY_ORIGIN,
  NECTARPAY_POP_PER_USD,
  isPaidStatus,
  rewardMessage,
  type NectarInvoice,
  type NectarMerchant,
} from "./nectarpay";

const idSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);
const nonceSchema = z.string().trim().max(128).regex(/^[A-Za-z0-9_-]*$/).nullable().optional();

type RawInvoice = Record<string, unknown>;

function invoiceUrl(id: string, nonce?: string | null, select = false) {
  if (nonce) return `${NECTARPAY_ORIGIN}/api/public/v1/pay/${id}?t=${encodeURIComponent(nonce)}`;
  return `${NECTARPAY_ORIGIN}/api/public/v1/invoices/${id}/public${select ? "/select" : ""}`;
}

async function fetchJson(url: string, init?: RequestInit): Promise<RawInvoice> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as RawInvoice;
  if (!res.ok) throw new Error(String(body.error ?? `NectarPay ${res.status}`));
  return body;
}

function storeIdOf(raw: RawInvoice): string | null {
  const m = (raw.merchant ?? raw.store ?? null) as Record<string, unknown> | null;
  const id = raw.store_id ?? raw.storeId ?? m?.id ?? m?.store_id;
  return id ? String(id) : null;
}

function normalize(raw: RawInvoice, fallback?: NectarInvoice | null): NectarInvoice {
  const options = (raw.options ?? raw.availableOptions ?? []) as Array<Record<string, unknown>>;
  const acceptsTsd =
    options.some((o) => String(o.key ?? o.option ?? "").toLowerCase() === "txc:tsd") ||
    (String(raw.chain ?? "").toLowerCase() === "txc" &&
      String(raw.token_symbol ?? raw.tokenSymbol ?? "").toUpperCase() === "TSD");
  const m = (raw.merchant ?? raw.store ?? null) as Record<string, unknown> | null;
  const pinnedTsd =
    String(raw.chain ?? "").toLowerCase() === "txc" &&
    String(raw.token_symbol ?? raw.tokenSymbol ?? "").toUpperCase() === "TSD";
  const crypto = raw.crypto_amount ?? raw.cryptoAmount;
  return {
    id: String(raw.id ?? fallback?.id ?? ""),
    status: String(raw.status ?? "pending"),
    fiatAmount: Number(raw.fiat_amount ?? raw.fiatAmount ?? fallback?.fiatAmount ?? 0),
    currency: String(raw.currency ?? raw.fiat_currency ?? raw.fiatCurrency ?? fallback?.currency ?? "USD"),
    description: (raw.description as string | null) ?? fallback?.description ?? null,
    expiresAt: (raw.expires_at as string | null) ?? (raw.expiresAt as string | null) ?? null,
    merchant: m
      ? {
          name: String(m.name ?? "Merchant"),
          website: (m.website as string | null) ?? null,
          logoUrl: (m.logo_url as string | null) ?? (m.logoUrl as string | null) ?? null,
        }
      : (fallback?.merchant ?? null),
    address: pinnedTsd ? ((raw.address as string | null) ?? null) : null,
    tsdAmount: pinnedTsd && crypto != null ? Number(crypto) : null,
    acceptsTsd: acceptsTsd || !!fallback?.acceptsTsd,
    storeId: storeIdOf(raw) ?? fallback?.storeId ?? null,
  };
}

/** Read a NectarPay invoice (store, amount, status). */
export const getNectarInvoice = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: idSchema, nonce: nonceSchema }).parse(d))
  .handler(async ({ data }): Promise<{ invoice: NectarInvoice | null; error: string | null }> => {
    try {
      const raw = await fetchJson(invoiceUrl(data.id, data.nonce));
      return { invoice: normalize(raw), error: null };
    } catch (e) {
      console.error("[nectarpay] invoice read", e);
      return { invoice: null, error: (e as Error).message || "Couldn't load this checkout." };
    }
  });

/** Pin the invoice to TSD on TEXITcoin and get the pay-to address + amount. */
export const selectNectarTsd = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: idSchema, nonce: nonceSchema }).parse(d))
  .handler(async ({ data }): Promise<{ invoice: NectarInvoice | null; error: string | null }> => {
    try {
      const before = normalize(await fetchJson(invoiceUrl(data.id, data.nonce)));
      if (before.address && before.tsdAmount) return { invoice: before, error: null };
      const raw = await fetchJson(invoiceUrl(data.id, data.nonce, true), {
        method: "POST",
        body: JSON.stringify({ option: "txc:TSD" }),
      });
      const inv = normalize(raw, before);
      if (!inv.address || !inv.tsdAmount) {
        return { invoice: null, error: "This store isn't accepting TSD right now." };
      }
      return { invoice: inv, error: null };
    } catch (e) {
      console.error("[nectarpay] select", e);
      return { invoice: null, error: (e as Error).message || "Couldn't start this payment." };
    }
  });

/** Lightweight status poll after the wallet broadcasts. */
export const getNectarInvoiceStatus = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: idSchema }).parse(d))
  .handler(async ({ data }): Promise<{ status: string | null }> => {
    try {
      const raw = await fetchJson(invoiceUrl(data.id, null));
      return { status: String(raw.status ?? "pending") };
    } catch {
      return { status: null };
    }
  });

let merchantCache: { at: number; list: NectarMerchant[] } | null = null;

/** Public NectarPay stores that accept TSD. */
export const listNectarMerchants = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ merchants: NectarMerchant[]; available: boolean }> => {
    if (merchantCache && Date.now() - merchantCache.at < 5 * 60_000) {
      return { merchants: merchantCache.list, available: true };
    }
    try {
      const res = await fetch(`${NECTARPAY_ORIGIN}/api/public/v1/merchants?token=TSD`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return { merchants: [], available: false };
      const body = (await res.json()) as { merchants?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const rows = Array.isArray(body) ? body : (body.merchants ?? []);
      const list: NectarMerchant[] = rows
        .map((r) => ({
          id: String(r.store_id ?? r.id ?? ""),
          name: String(r.name ?? "Merchant"),
          category: (r.category as string | null) ?? null,
          city: (r.city as string | null) ?? null,
          country: (r.country as string | null) ?? null,
          address: (r.address as string | null) ?? null,
          lat: Number(r.lat),
          lng: Number(r.lng),
          logoUrl: (r.logo_url as string | null) ?? (r.logoUrl as string | null) ?? null,
          website: (r.website as string | null) ?? null,
        }))
        .filter((m) => m.id && Number.isFinite(m.lat) && Number.isFinite(m.lng));
      merchantCache = { at: Date.now(), list };
      return { merchants: list, available: true };
    } catch (e) {
      console.error("[nectarpay] merchants", e);
      return { merchants: [], available: false };
    }
  },
);

/**
 * Claim POP for a paid NectarPay invoice. The wallet proves it owns the
 * paying address by signing a message; we confirm with NectarPay that the
 * invoice is paid by that exact transaction. One reward per invoice.
 */
export const claimNectarReward = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        invoiceId: idSchema,
        txid: z.string().trim().regex(/^[0-9a-f]{64}$/i),
        address: z.string().trim().min(26).max(48),
        signature: z.string().trim().min(40).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{
    awarded: number;
    status: string;
    rewards?: { amount: number; kind: "store" | "community"; storeName: string } | null;
  }> => {
    const { verifyTxcMessage } = await import("./wallet/txc-message");
    if (!verifyTxcMessage(data.address, rewardMessage(data.invoiceId, data.txid), data.signature)) {
      throw new Error("bad_signature");
    }

    let raw: RawInvoice;
    try {
      raw = await fetchJson(invoiceUrl(data.invoiceId, null));
    } catch {
      return { awarded: 0, status: "unverified" };
    }
    if (!isPaidStatus(String(raw.status ?? ""))) return { awarded: 0, status: "not_paid" };
    const txs = (raw.transactions ?? []) as Array<Record<string, unknown>>;
    if (!txs.some((t) => String(t.hash ?? t.txid ?? "").toLowerCase() === data.txid.toLowerCase())) {
      return { awarded: 0, status: "tx_mismatch" };
    }
    const currency = String(raw.currency ?? raw.fiat_currency ?? raw.fiatCurrency ?? "USD").toUpperCase();
    const fiat = Number(raw.fiat_amount ?? raw.fiatAmount ?? 0);
    const usd = currency === "USD" ? fiat : 0;
    const amount = Math.floor(usd * NECTARPAY_POP_PER_USD);
    if (amount < 1) return { awarded: 0, status: "too_small" };

    const { awardPop } = await import("./email-wallet.server");
    const res = await awardPop({
      email: `${data.address.toLowerCase()}@wallet.cryptopop.org`,
      amount,
      source: "nectarpay",
      sourceId: data.invoiceId,
      memo: "NectarPay purchase",
      walletOverride: data.address,
    });
    const storeId = storeIdOf(raw);
    let rewards: { amount: number; kind: "store" | "community"; storeName: string } | null = null;
    if (storeId && usd > 0) {
      const { issueRewards } = await import("./store-rewards.server");
      rewards = await issueRewards({ storeId, address: data.address, usd, invoiceId: data.invoiceId, txid: data.txid }).catch((e) => {
        console.error("[rewards] issue", e);
        return null;
      });
    }
    return { awarded: res.status === "sent" ? amount : 0, status: res.status, rewards };
  });
