import { GIVE_CHURCH, GIVE_PLATFORM_ADDRESS } from "./constants";
import { givingMinimumUsd, splitGiving } from "@/lib/wallet/transaction-policy";

/** Pinned address for a Give recipient code, or null if that cause can't receive splits yet. */
export function pinnedRecipient(code: string | null | undefined): { code: string; name: string; address: string } | null {
  if (!code) return null;
  return code.trim().toUpperCase() === GIVE_CHURCH.short ? { code: GIVE_CHURCH.short, name: GIVE_CHURCH.name, address: GIVE_CHURCH.address } : null;
}

/**
 * A store payment splits ONLY when the store is in Give AND the payer has a
 * Give recipient set. Otherwise the whole amount goes to the store.
 */
export function giveSplitFor(opts: {
  egiving: { accepted: boolean; discountPct: number | null; merchantMinimumUsd?: number | null } | null | undefined;
  recipientCode: string | null | undefined;
  total: number;
  merchant: string;
}) {
  const r = pinnedRecipient(opts.recipientCode);
  const pct = opts.egiving?.accepted ? Number(opts.egiving.discountPct) : NaN;
  if (!r || !Number.isFinite(pct)) return null;
  try {
    if (opts.total < givingMinimumUsd(pct) || opts.total < (opts.egiving?.merchantMinimumUsd ?? 0)) return null;
    const sp = splitGiving(opts.total, pct);
    if (sp.church <= 0 || sp.platform <= 0) return null;
    return {
      ...sp,
      recipientName: r.name,
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
