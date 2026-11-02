import { GIVE_PLATFORM_ADDRESS } from "./constants";
import type { Charity } from "./charities";
import { givingMinimumUsd, splitGiving } from "@/lib/wallet/transaction-policy";

/** The cause for a code, taken only from NectarPay's verified signed list (null if not on it). */
export function resolveRecipient(code: string | null | undefined, causes: Charity[] | null | undefined): { code: string; name: string; address: string } | null {
  if (!code || !causes?.length) return null;
  const c = causes.find((x) => x.code.toUpperCase() === code.trim().toUpperCase());
  return c ? { code: c.code, name: c.name, address: c.address } : null;
}

/**
 * A store payment splits ONLY when the store is in Give AND the payer has a
 * Give recipient set. Otherwise the whole amount goes to the store.
 */
export function giveSplitFor(opts: {
  egiving: { accepted: boolean; discountPct: number | null; merchantMinimumUsd?: number | null } | null | undefined;
  recipientCode: string | null | undefined;
  causes: Charity[] | null | undefined;
  total: number;
  merchant: string;
}) {
  const r = resolveRecipient(opts.recipientCode, opts.causes);
  const pct = opts.egiving?.accepted ? Number(opts.egiving.discountPct) : NaN;
  if (!r || !Number.isFinite(pct)) return null;
  try {
    if (opts.total < givingMinimumUsd(pct) || opts.total < (opts.egiving?.merchantMinimumUsd ?? 0)) return null;
    const sp = splitGiving(opts.total, pct);
    if (sp.church <= 0 || sp.platform <= 0) return null;
    return {
      ...sp,
      recipientName: r.name,
      recipientAddress: r.address,
      recipients: [
        { to: opts.merchant, amount: sp.merchant },
        { to: r.address, amount: sp.church },
        { to: GIVE_PLATFORM_ADDRESS, amount: sp.platform },
      ],
    };
  } catch {
    return null;
  }
}
