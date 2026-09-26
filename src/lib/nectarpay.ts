// Shared (client + server) NectarPay constants and types.

export const NECTARPAY_ORIGIN = "https://app.nectar-pay.com";

/** Hosts we trust for "Sign in with wallet" requests. Others get a warning. */
export const NECTARPAY_TRUSTED_HOSTS = [
  "app.nectar-pay.com",
  "nectar-pay.com",
  "pay.honest.money",
  "honest.money",
];

/** POP earned per $1 spent at a NectarPay merchant (whole POP, rounded down). */
export const NECTARPAY_POP_PER_USD = 1;

export type NectarInvoice = {
  id: string;
  status: string;
  fiatAmount: number;
  currency: string;
  description: string | null;
  expiresAt: string | null;
  merchant: { name: string; website: string | null; logoUrl: string | null } | null;
  /** Set once the TSD option is pinned. */
  address: string | null;
  tsdAmount: number | null;
  acceptsTsd: boolean;
  /** NectarPay store id — links to the store's rewards program. */
  storeId: string | null;
};

export type NectarMerchant = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  lat: number;
  lng: number;
  logoUrl: string | null;
  website: string | null;
};

export const PAID_STATUSES = ["paid", "confirmed", "overpaid", "completed", "settled"];

export function isPaidStatus(s: string | null | undefined) {
  return !!s && PAID_STATUSES.includes(s.toLowerCase());
}

export function rewardMessage(invoiceId: string, txid: string) {
  return [
    "CryptoPOP reward claim",
    `Invoice: ${invoiceId}`,
    `Tx: ${txid}`,
  ].join("\n");
}

export function nectarReceiptUrl(invoiceId: string) {
  return `${NECTARPAY_ORIGIN}/i/${encodeURIComponent(invoiceId)}`;
}
