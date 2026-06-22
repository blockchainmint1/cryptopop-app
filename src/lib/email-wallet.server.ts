// Email-keyed custodial wallet system.
// Derives a deterministic TXC address from WALLET_MASTER_SEED + email,
// records POP awards in a ledger, and broadcasts them on-chain immediately.

import { HDKey } from "@scure/bip32";
import { createBase58check } from "@scure/base";
import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mintGrant } from "./txc.server";

const TXC_P2PKH = 0x42;
const base58check = createBase58check(sha256);

function hash160(buf: Uint8Array): Uint8Array {
  return ripemd160(sha256(buf));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Deterministic non-hardened HD index from the email. 31-bit positive int.
function indexForEmail(email: string): number {
  const h = sha256(new TextEncoder().encode(normalizeEmail(email)));
  // top bit cleared so it's a valid non-hardened BIP32 index
  return ((h[0] & 0x7f) << 24) | (h[1] << 16) | (h[2] << 8) | h[3];
}

function loadMasterRoot(): HDKey {
  const mnemonic = process.env.WALLET_MASTER_SEED ?? process.env.TXC_SEED;
  if (!mnemonic) throw new Error("WALLET_MASTER_SEED (or TXC_SEED) not configured");
  if (!validateMnemonic(mnemonic.trim(), wordlist)) {
    throw new Error("Master seed is not a valid BIP39 mnemonic");
  }
  const seed = mnemonicToSeedSync(mnemonic.trim());
  return HDKey.fromMasterSeed(seed);
}

function addressFromPubkey(pubkey: Uint8Array): string {
  const h160 = hash160(pubkey);
  const payload = new Uint8Array(21);
  payload[0] = TXC_P2PKH;
  payload.set(h160, 1);
  return base58check.encode(payload);
}

// TXC WIF prefix is discovered from MINTER_WIF / TXC_WIF (decoded base58check).
// Cached after first call. Falls back to 0xC2 (Bitcoin-fork convention:
// pubKeyHash 0x42 + 0x80) so derivation works even before the WIF is set.
let WIF_PREFIX: number | null = null;
function txcWifPrefix(): number {
  if (WIF_PREFIX !== null) return WIF_PREFIX;
  const m = process.env.MINTER_WIF ?? process.env.TXC_WIF;
  if (m) {
    try {
      WIF_PREFIX = base58check.decode(m.trim())[0];
      return WIF_PREFIX;
    } catch {
      /* fall through */
    }
  }
  WIF_PREFIX = 0xc2;
  return WIF_PREFIX;
}

function wifFromPrivateKey(priv: Uint8Array, compressed = true): string {
  const prefix = txcWifPrefix();
  const payload = new Uint8Array(compressed ? 34 : 33);
  payload[0] = prefix;
  payload.set(priv, 1);
  if (compressed) payload[33] = 0x01;
  return base58check.encode(payload);
}

export function deriveAddressForEmail(email: string): {
  address: string;
  index: number;
} {
  const index = indexForEmail(email);
  const root = loadMasterRoot();
  // m/44'/0'/0'/0/<index> — same path family as user wallets,
  // distinct because derived from a different master seed.
  const child = root.derive(`m/44'/0'/0'/0/${index}`);
  if (!child.publicKey) throw new Error("derivation failed");
  return { address: addressFromPubkey(child.publicKey), index };
}

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
 * Server-side: derive the WIF private key + address for an email.
 * The user can import this WIF into any TXC-compatible wallet to take
 * custody of their POP at any time. Custody is otherwise held by the
 * server (master seed).
 */
export function deriveWalletForEmail(email: string): {
  address: string;
  wif: string;
  index: number;
} {
  const index = indexForEmail(email);
  const root = loadMasterRoot();
  const child = root.derive(`m/44'/0'/0'/0/${index}`);
  if (!child.privateKey || !child.publicKey) throw new Error("derivation failed");
  return {
    address: addressFromPubkey(child.publicKey),
    wif: wifFromPrivateKey(child.privateKey, true),
    index,
  };
}

/**
 * Idempotently ensure an email has a wallet row.
 * Safe to call repeatedly with the same email.
 */
export async function ensureEmailWallet(rawEmail: string): Promise<{
  email: string;
  walletAddress: string;
}> {
  const email = normalizeEmail(rawEmail);

  const { data: existing } = await supabaseAdmin
    .from("email_wallets")
    .select("email, wallet_address")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return { email, walletAddress: existing.wallet_address };
  }

  const { address, index } = deriveAddressForEmail(email);
  const { data: inserted, error } = await supabaseAdmin
    .from("email_wallets")
    .upsert(
      {
        email,
        wallet_address: address,
        derivation_index: index,
      },
      { onConflict: "email" },
    )
    .select("email, wallet_address")
    .single();
  if (error) throw new Error(`ensureEmailWallet: ${error.message}`);
  return { email, walletAddress: inserted.wallet_address };
}

/**
 * Award POP to an email. Ensures the wallet exists, records the ledger entry,
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
  /**
   * If provided, mint to this external TXC address instead of deriving/creating
   * an email-keyed custodial wallet. Used when a user supplies their own wallet
   * at signup. Skips ensureEmailWallet entirely.
   */
  walletOverride?: string | null;
}): Promise<{ awardId: string | null; status: "sent" | "failed" | "duplicate" }> {
  const email = normalizeEmail(opts.email);

  // 1. Resolve target wallet — external override wins; otherwise ensure custodial.
  const walletAddress = opts.walletOverride
    ? opts.walletOverride.trim()
    : (await ensureEmailWallet(email)).walletAddress;

  // 2. Insert ledger row (pending). Unique (source, source_id) makes it idempotent.
  const { data: award, error: insertError } = await supabaseAdmin
    .from("pop_awards")
    .insert({
      email,
      wallet_address: walletAddress,
      amount: opts.amount,
      source: opts.source,
      source_id: opts.sourceId ?? null,
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
