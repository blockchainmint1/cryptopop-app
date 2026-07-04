// TXC L2 (Omni Layer) pipeline — server-only.
// Builds + signs Omni transactions and broadcasts via mempool.texitcoin.org.
//
// Two entry points share the same UTXO/sign/broadcast plumbing:
//   - mintGrant({ amount, toAddress, memo, propertyId?, minterWif? })
//   - issueManagedProperty({ tokenName, category, subcategory, url, minterWif })
//
// If propertyId/minterWif are omitted, mintGrant falls back to env
// (TXC_TOKEN_ID, MINTER_WIF/TXC_WIF) so the CryptoPOP USA flagship org
// keeps working with zero caller changes.

import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "@bitcoinerlab/secp256k1";
import bs58check from "bs58check";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// ---------- TXC network params ----------
// P2PKH version byte 0x42 (decoded from issuer addr `ToeT...`).
export const TXC_NETWORK: bitcoin.Network = {
  messagePrefix: "\x18Texitcoin Signed Message:\n",
  bech32: "tx",
  bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  pubKeyHash: 0x42,
  scriptHash: 0x05,
  wif: 0x80, // overridden per-WIF in loadKey()
};

const DUST_SATS = 10_000;
const FEE_SATS_PER_VBYTE = 5;
const MEMPOOL_BASE = "https://mempool.texitcoin.org/api";

function envPropertyId(): number {
  const raw = process.env.TXC_TOKEN_ID ?? "37";
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`TXC_TOKEN_ID invalid: ${raw}`);
  return n;
}

function envMinterWif(): string {
  const v = process.env.MINTER_WIF ?? process.env.TXC_WIF;
  if (!v) throw new Error("MINTER_WIF (or TXC_WIF) not configured");
  return v;
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

// ---------- RPC ----------

async function rpc<T = unknown>(method: string, params: unknown[]): Promise<T> {
  const url = process.env.TXC_RPC_URL ?? process.env.TXC_RPC_ADDRESS;
  if (!url) throw new Error("TXC_RPC_URL (or TXC_RPC_ADDRESS) not configured");
  const user = envOrThrow("TXC_RPC_USER");
  const pass = envOrThrow("TXC_RPC_PASS");
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  const res = await fetch(fullUrl, {
    method: "POST",
    headers: { "content-type": "text/plain", authorization: auth },
    body: JSON.stringify({ jsonrpc: "1.0", id: "cp", method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${method} http ${res.status}`);
  const json = (await res.json()) as { result: T; error: { message: string } | null };
  if (json.error) throw new Error(`rpc ${method}: ${json.error.message}`);
  return json.result;
}

// ---------- mempool helpers ----------

type Utxo = { txid: string; vout: number; value: number };

type MempoolTx = {
  txid: string;
  vin: Array<{ txid: string; vout: number }>;
  vout: Array<{ scriptpubkey_address?: string; value: number }>;
};

async function getMempoolTxs(addr: string): Promise<MempoolTx[]> {
  try {
    const res = await fetch(`${MEMPOOL_BASE}/address/${addr}/txs/mempool`);
    if (!res.ok) return [];
    return (await res.json()) as MempoolTx[];
  } catch {
    return [];
  }
}

async function getUtxos(addr: string): Promise<Utxo[]> {
  const [utxoRes, mempoolTxs] = await Promise.all([
    fetch(`${MEMPOOL_BASE}/address/${addr}/utxo`),
    getMempoolTxs(addr),
  ]);
  if (!utxoRes.ok) throw new Error(`utxo fetch http ${utxoRes.status}`);
  const raw = (await utxoRes.json()) as Array<{
    txid: string;
    vout: number;
    value: number;
    status: { confirmed: boolean };
  }>;

  // Outpoints already spent by unconfirmed txs — the explorer's utxo list can
  // lag behind mempool spends; using one causes txn-mempool-conflict.
  const spent = new Set<string>();
  for (const tx of mempoolTxs) {
    for (const vin of tx.vin) spent.add(`${vin.txid}:${vin.vout}`);
  }

  const utxos = raw
    .filter((u) => !spent.has(`${u.txid}:${u.vout}`))
    .map((u) => ({ txid: u.txid, vout: u.vout, value: u.value, confirmed: u.status.confirmed }))
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed))
    .map(({ txid, vout, value }) => ({ txid, vout, value }));

  // Add unconfirmed change outputs back to us (spendable, may be missing from
  // the utxo endpoint while it lags).
  const seen = new Set(utxos.map((u) => `${u.txid}:${u.vout}`));
  for (const tx of mempoolTxs) {
    tx.vout.forEach((o, i) => {
      const key = `${tx.txid}:${i}`;
      if (o.scriptpubkey_address === addr && !spent.has(key) && !seen.has(key)) {
        utxos.push({ txid: tx.txid, vout: i, value: o.value });
        seen.add(key);
      }
    });
  }
  return utxos;
}

async function getTxHex(txid: string): Promise<string> {
  const res = await fetch(`${MEMPOOL_BASE}/tx/${txid}/hex`);
  if (!res.ok) throw new Error(`tx hex fetch http ${res.status}`);
  return (await res.text()).trim();
}

async function broadcast(rawHex: string): Promise<string> {
  const res = await fetch(`${MEMPOOL_BASE}/tx`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: rawHex,
  });
  const text = (await res.text()).trim();
  if (!res.ok) throw new Error(`broadcast failed: ${text || res.status}`);
  return text;
}

export async function getAddressBalanceSats(
  addr: string,
): Promise<{ confirmed: number; unconfirmed: number }> {
  const res = await fetch(`${MEMPOOL_BASE}/address/${addr}`);
  if (!res.ok) throw new Error(`address stats http ${res.status}`);
  const j = (await res.json()) as {
    chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
    mempool_stats: { funded_txo_sum: number; spent_txo_sum: number };
  };
  return {
    confirmed: j.chain_stats.funded_txo_sum - j.chain_stats.spent_txo_sum,
    unconfirmed: j.mempool_stats.funded_txo_sum - j.mempool_stats.spent_txo_sum,
  };
}

// ---------- key loading ----------

function loadKey(wif: string): {
  keyPair: ReturnType<typeof ECPair.fromWIF>;
  address: string;
  network: bitcoin.Network;
} {
  const decoded = bs58check.decode(wif);
  const wifVersion = decoded[0];
  const network: bitcoin.Network = { ...TXC_NETWORK, wif: wifVersion };
  const keyPair = ECPair.fromWIF(wif, network);
  const { address } = bitcoin.payments.p2pkh({
    pubkey: Buffer.from(keyPair.publicKey),
    network,
  });
  if (!address) throw new Error("could not derive address from WIF");
  return { keyPair, address, network };
}

/**
 * Generate a fresh TXC P2PKH keypair. Used by the org-minter wallet wizard.
 * WIF version byte mirrors P2PKH (0x42 + 0x80 = 0xC2), matching the TXC
 * convention used by all existing wallets in the system.
 */
export function generateMinterKeypair(): { address: string; wif: string } {
  const network: bitcoin.Network = { ...TXC_NETWORK, wif: 0xc2 };
  const keyPair = ECPair.makeRandom({ network });
  const wif = keyPair.toWIF();
  const { address } = bitcoin.payments.p2pkh({
    pubkey: Buffer.from(keyPair.publicKey),
    network,
  });
  if (!address) throw new Error("keypair generation failed");
  return { address, wif };
}

// ---------- Omni payload helpers ----------

function buildOmniOpReturn(payloadHex: string): Buffer {
  const magic = Buffer.from("omni", "ascii");
  const payload = Buffer.from(payloadHex, "hex");
  return Buffer.concat([magic, payload]);
}

function formatDivisibleAmount(units: number | string): string {
  const n = typeof units === "string" ? Number(units) : units;
  if (!Number.isFinite(n) || n <= 0) throw new Error("amount must be positive");
  return n.toFixed(8);
}

// ---------- mint serialization lock ----------
// Concurrent mints select the same issuer UTXOs and the second broadcast is
// rejected by the mempool (txn-mempool-conflict). A single-row DB lock
// (public.pop_mint_lock) serializes broadcasts across all server instances.
async function withMintLock<T>(fn: () => Promise<T>): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const holder = crypto.randomUUID();
  const deadline = Date.now() + 45_000;
  for (;;) {
    const { data, error } = await supabaseAdmin.rpc("acquire_pop_mint_lock", {
      p_holder: holder,
      p_ttl_seconds: 90,
    });
    if (error) throw new Error(`mint lock: ${error.message}`);
    if (data === true) break;
    if (Date.now() > deadline) {
      throw new Error("another mint is in progress — try again shortly");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  try {
    return await fn();
  } finally {
    try {
      await supabaseAdmin.rpc("release_pop_mint_lock", { p_holder: holder });
    } catch {
      // TTL expiry frees the lock if release fails
    }
  }
}

// ---------- shared build + sign + broadcast ----------

async function buildAndBroadcast(opts: {
  payloadHex: string;
  refAddress: string; // dust reference output (receiver for grants, issuer for issuance)
  minterWif: string;
}): Promise<{ txHash: string; minterAddress: string }> {
  return withMintLock(() => buildAndBroadcastLocked(opts));
}

async function buildAndBroadcastLocked(opts: {
  payloadHex: string;
  refAddress: string;
  minterWif: string;
}): Promise<{ txHash: string; minterAddress: string }> {
  const { keyPair, address: issuer, network } = loadKey(opts.minterWif);


  const utxos = await getUtxos(issuer);
  if (utxos.length === 0) throw new Error("issuer has no UTXOs — needs funding");

  utxos.sort((a, b) => b.value - a.value);
  const opReturnData = buildOmniOpReturn(opts.payloadHex);
  const opReturnScript = bitcoin.payments.embed({ data: [opReturnData] }).output!;

  const psbt = new bitcoin.Psbt({ network });
  let inputSats = 0;
  const usedUtxos: Utxo[] = [];

  for (const u of utxos) {
    const hex = await getTxHex(u.txid);
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(hex, "hex"),
    });
    usedUtxos.push(u);
    inputSats += u.value;
    const estVsize = 10 + 148 * usedUtxos.length + 34 * 2 + (10 + opReturnData.length);
    const estFee = estVsize * FEE_SATS_PER_VBYTE;
    if (inputSats >= DUST_SATS + estFee + DUST_SATS) break;
  }

  const finalVsize = 10 + 148 * usedUtxos.length + 34 * 2 + (10 + opReturnData.length);
  const fee = finalVsize * FEE_SATS_PER_VBYTE;
  const change = inputSats - DUST_SATS - fee;
  if (change < 0) throw new Error("insufficient TXC funds for tx fee");

  psbt.addOutput({ script: opReturnScript, value: 0n });
  psbt.addOutput({ address: opts.refAddress, value: BigInt(DUST_SATS) });
  if (change >= DUST_SATS) {
    psbt.addOutput({ address: issuer, value: BigInt(change) });
  }

  const signer: bitcoin.Signer = {
    publicKey: Buffer.from(keyPair.publicKey),
    sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash)),
  };
  for (let i = 0; i < usedUtxos.length; i++) {
    psbt.signInput(i, signer);
  }
  psbt.finalizeAllInputs();
  const rawHex = psbt.extractTransaction().toHex();

  const txid = await broadcast(rawHex);
  return { txHash: txid, minterAddress: issuer };
}

// ---------- public API ----------

export type MintResult = { txHash: string; minterAddress: string };

export async function mintGrant(opts: {
  amount: number;
  toAddress: string;
  memo?: string;
  /** Override property id (per-org). Falls back to TXC_TOKEN_ID env. */
  propertyId?: number;
  /** Override minter WIF (per-org). Falls back to MINTER_WIF/TXC_WIF env. */
  minterWif?: string;
}): Promise<MintResult> {
  const propertyId = opts.propertyId ?? envPropertyId();
  const minterWif = opts.minterWif ?? envMinterWif();
  const amountStr = formatDivisibleAmount(opts.amount);
  const memo = (opts.memo ?? "").slice(0, 60);
  const payloadHex = await rpc<string>("omni_createpayload_grant", [
    propertyId,
    amountStr,
    memo,
  ]);
  return buildAndBroadcast({ payloadHex, refAddress: opts.toAddress, minterWif });
}

/**
 * Issue a new Omni managed property (== a community's POP token).
 * Ecosystem 1 (main), type 1 (indivisible, managed). After confirmation,
 * the property id is queryable via omni_gettransaction(txid).
 */
export async function issueManagedProperty(opts: {
  tokenName: string;
  category?: string;
  subcategory?: string;
  url?: string;
  data?: string;
  minterWif: string;
}): Promise<MintResult> {
  const { address: issuer } = loadKey(opts.minterWif);
  const payloadHex = await rpc<string>("omni_createpayload_issuancemanaged", [
    1, // ecosystem (main)
    1, // type (indivisible)
    0, // previousId (0 = new property)
    (opts.category ?? "POP").slice(0, 70),
    (opts.subcategory ?? "Community").slice(0, 70),
    opts.tokenName.slice(0, 70),
    (opts.url ?? "").slice(0, 70),
    (opts.data ?? "").slice(0, 70),
  ]);
  return buildAndBroadcast({ payloadHex, refAddress: issuer, minterWif: opts.minterWif });
}

/**
 * Resolve the property id created by an issuance transaction. Returns null
 * until the tx is confirmed and the Omni node has indexed it.
 */
export async function getPropertyIdForIssuanceTx(txid: string): Promise<number | null> {
  try {
    const tx = await rpc<{ propertyid?: number; valid?: boolean; confirmations?: number }>(
      "omni_gettransaction",
      [txid],
    );
    if (tx && tx.valid && typeof tx.propertyid === "number" && tx.propertyid > 0) {
      return tx.propertyid;
    }
    return null;
  } catch {
    return null;
  }
}
