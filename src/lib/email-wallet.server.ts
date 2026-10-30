// POP award ledger. Only explicitly supplied non-custodial addresses receive awards.

import { createBase58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mintGrant } from "./txc.server";
const TXC_P2PKH = 0x42;
const base58check = createBase58check(sha256);
const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Validate a user-supplied TXC address. Checks base58check integrity and
 * the TXC P2PKH version byte (0x42). Returns the trimmed address or throws.
 */
export function validateTxcAddress(raw: string): string {
  const addr = raw.trim();
  if (addr.length < 26 || addr.length > 48) {
    throw new Error("invalid_wallet_address");
  }
  let decoded: Uint8Array;
  try {
    decoded = base58check.decode(addr);
  } catch {
    throw new Error("invalid_wallet_address");
  }
  if (decoded.length !== 21 || decoded[0] !== TXC_P2PKH) {
    throw new Error("invalid_wallet_address");
  }
  return addr;
}

/**
 * Award POP to an explicit device-wallet address, records the ledger entry,
 * and broadcasts an on-chain TXC grant immediately.
 * Idempotent on (source, source_id) — re-calls with the same key are no-ops.
 *
 * Errors are caught and recorded as 'failed' status; the function never throws
 * for on-chain failures so callers (signup, etc.) don't break user flow.
 */
export async function awardPop(opts: {
  email: string;
  amount: number;
  source: string;
  sourceId?: string | null;
  memo?: string;
  /** What the shopper reads in their point history, e.g. "Purchase @ honest.money". */
  label?: string | null;
  /**
   * Required for all awards; email-derived custodial wallets are retired.
   */
  walletOverride?: string | null;
}): Promise<{ awardId: string | null; status: "sent" | "failed" | "duplicate" }> {
  const email = normalizeEmail(opts.email);

  // 1. Resolve the explicitly provided non-custodial target.
  if (!opts.walletOverride) throw new Error("Open your on-device wallet to receive POP; email wallets are retired.");
  const walletAddress = validateTxcAddress(opts.walletOverride);

  // 2. Insert ledger row (pending). Unique (source, source_id) makes it idempotent.
  const { data: award, error: insertError } = await supabaseAdmin
    .from("pop_awards")
    .insert({
      email,
      wallet_address: walletAddress,
      amount: opts.amount,
      source: opts.source,
      source_id: opts.sourceId ?? null,
      label: opts.label?.trim() ? opts.label.trim().slice(0, 80) : null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    // duplicate key → award already exists for this source/source_id
    if (insertError.code === "23505") {
      return { awardId: null, status: "duplicate" };
    }
    console.error("[awardPop] insert failed", insertError);
    throw new Error(`awardPop insert: ${insertError.message}`);
  }

  // 3. Broadcast on-chain
  try {
    const result = await mintGrant({
      amount: opts.amount,
      toAddress: walletAddress,
      memo: (opts.memo ?? opts.source).slice(0, 60),
    });
    await supabaseAdmin
      .from("pop_awards")
      .update({
        status: "sent",
        tx_hash: result.txHash,
        sent_at: new Date().toISOString(),
      })
      .eq("id", award.id);
    return { awardId: award.id, status: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[awardPop] mint failed", msg);
    await supabaseAdmin
      .from("pop_awards")
      .update({ status: "failed", error: msg.slice(0, 500) })
      .eq("id", award.id);
    return { awardId: award.id, status: "failed" };
  }
}
