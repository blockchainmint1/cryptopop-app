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
  isPaidStatus,
  rewardMessage,
  type NectarInvoice,
  type NectarMerchant,
} from "./nectarpay";

const idSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);
const nonceSchema = z.string().trim().max(128).regex(/^[A-Za-z0-9_-]*$/).nullable().optional();

type RawInvoice = Record<string, unknown>;

export function invoiceUrl(id: string, nonce?: string | null, select = false) {
  if (nonce) return `${NECTARPAY_ORIGIN}/api/public/v1/pay/${id}?t=${encodeURIComponent(nonce)}`;
  return `${NECTARPAY_ORIGIN}/api/public/v1/invoices/${id}/public${select ? "/select" : ""}`;
}

export async function fetchJson(url: string, init?: RequestInit): Promise<RawInvoice> {
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

function egivingOf(raw: RawInvoice): NectarInvoice["egiving"] | null {
  const e = raw.egiving as Record<string, unknown> | null | undefined;
  if (!e || typeof e !== "object") return null;
  const pct = Number(e.discountPct ?? e.discount_pct);
  const minRaw = e.merchantMinimumUsd ?? e.merchant_minimum_usd ?? raw.merchantMinimumUsd;
  const min = minRaw == null ? null : Number(minRaw);
  return e.accepted === true && Number.isFinite(pct)
    ? { accepted: true, discountPct: pct, merchantMinimumUsd: min != null && Number.isFinite(min) ? min : null }
    : { accepted: false, discountPct: null };
}

export function normalize(raw: RawInvoice, fallback?: NectarInvoice | null): NectarInvoice {
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
    egiving: egivingOf(raw) ?? fallback?.egiving ?? { accepted: false, discountPct: null },
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

const MERCHANT_TTL_MS = 5 * 60_000;
let merchantCache: { at: number; list: NectarMerchant[] } | null = null;

/**
 * Stores that accept TSD, read from our own copy of NectarPay's directory
 * (refreshed hourly by the database timer).
 *
 * Only stores a shopper can actually act on are returned: a name plus a map
 * pin. NectarPay's "city pin only" stores carry no name or address, so they
 * stay out of the list — the admin directory page reports how many of them are
 * waiting for their merchant to turn on a full listing.
 *
 * If our copy is empty (fresh database, or the timer hasn't run yet) we pull
 * the feed once inline rather than showing an empty page.
 */
export const listNectarMerchants = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ merchants: NectarMerchant[]; available: boolean }> => {
    if (merchantCache && Date.now() - merchantCache.at < MERCHANT_TTL_MS) {
      return { merchants: merchantCache.list, available: true };
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const read = async () => {
        const { data, error } = await supabaseAdmin
          .from("nectarpay_stores")
          .select("id, name, category, city, region, country, street, lat, lng, logo_url, website, presence")
          .eq("is_active", true)
          .contains("accepts", ["TSD"])
          .not("name", "is", null)
          .not("lat", "is", null)
          .not("lng", "is", null)
          .limit(2000);
        if (error) throw new Error(error.message);
        return data ?? [];
      };

      let rows = await read();
      if (rows.length === 0) {
        const { runNectarpaySync } = await import("./nectarpay-sync.server");
        await runNectarpaySync();
        rows = await read();
      }

      const list: NectarMerchant[] = rows
        .map((r) => ({
          id: r.id,
          name: String(r.name ?? "Merchant"),
          category: r.category ?? null,
          city: r.city ?? null,
          country: r.country ?? null,
          address: r.street ?? null,
          lat: Number(r.lat),
          lng: Number(r.lng),
          logoUrl: r.logo_url ?? null,
          website: r.website ?? null,
          online: r.presence === "online",
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
    const { assertPaymentOwner } = await import("./payment-owner.server");
    await assertPaymentOwner(data.txid, data.address);
    const fiat = Number(raw.fiat_amount ?? raw.fiatAmount ?? 0);
    const usd = currency === "USD" ? fiat : 0;
    // NectarPay decides POP for every merchant sale; queued and retried if not confirmed yet.
    const { startClaim } = await import("./pop-claim.server");
    const res = await startClaim({ txid: data.txid, wallet: data.address, payers: [data.address], origin: "qr" });
    const storeId = storeIdOf(raw);
    let rewards: { amount: number; kind: "store" | "community"; storeName: string } | null = null;
    if (storeId && usd > 0) {
      const { issueRewards } = await import("./store-rewards.server");
      rewards = await issueRewards({ storeId, address: data.address, usd, invoiceId: data.invoiceId, txid: data.txid }).catch((e) => {
        console.error("[rewards] issue", e);
        return null;
      });
    }
    return { awarded: res.pop, status: res.status, rewards };
  });
