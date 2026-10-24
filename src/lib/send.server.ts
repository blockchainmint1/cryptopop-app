// Non-custodial send: server builds an UNSIGNED transaction for the user's
// own address, the device signs it locally, the server relays the signed hex.
// The private key never leaves the phone.
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { TXC_NETWORK } from "./txc.server";

bitcoin.initEccLib(ecc);

const DUST_SATS = 10_000;
/** Never go below this — 5 sat/vB gets stuck in the mempool at the register. */
const FEE_FLOOR = 10;
const MEMPOOL_BASE = "https://mempool.texitcoin.org/api";

let feeCache: { rate: number; at: number } | null = null;
/** Live fastest fee rate, floored to the node minimum and our 10 sat/vB floor. */
async function getFeeRate(): Promise<number> {
  if (feeCache && Date.now() - feeCache.at < 60_000) return feeCache.rate;
  let rate = FEE_FLOOR;
  try {
    const res = await fetch(`${MEMPOOL_BASE}/v1/fees/recommended`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const j = (await res.json()) as { fastestFee?: number; minimumFee?: number };
      rate = Math.max(Number(j.fastestFee) || 0, Number(j.minimumFee) || 0, FEE_FLOOR);
    }
  } catch { /* keep floor */ }
  rate = Math.min(Math.ceil(rate), 200);
  feeCache = { rate, at: Date.now() };
  return rate;
}

/** Turn raw node/explorer errors into plain, actionable messages. */
export function friendlyBroadcastError(raw: string): string {
  const m = raw.toLowerCase();
  const tail = ` (node said: ${raw.replace(/<[^>]+>/g, "").slice(0, 160)})`;
  if (m.includes("<html") || m.includes("cloudflare")) return "The TEXITcoin network is busy right now. Please try again in a moment.";
  if (m.includes("mempool-conflict") || m.includes("missingorspent"))
    return "Some coins you were spending were just used by another send. Please try again." + tail;
  if (m.includes("already-in-mempool") || m.includes("already in block chain"))
    return "This payment was already sent — check your activity before sending again." + tail;
  if (m.includes("min relay fee") || m.includes("insufficient fee"))
    return "The network fee was too low. Please try again." + tail;
  if (m.includes("dust")) return "That amount is too small for the network to accept." + tail;
  return raw;
}

type Utxo = { txid: string; vout: number; value: number };

async function rpc<T = unknown>(method: string, params: unknown[]): Promise<T> {
  const url = process.env.TXC_RPC_URL ?? process.env.TXC_RPC_ADDRESS;
  const user = process.env.TXC_RPC_USER;
  const pass = process.env.TXC_RPC_PASS;
  if (!url || !user || !pass) throw new Error("TXC RPC not configured");
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
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

/**
 * Is this specific output still unspent (mempool included)? One cheap REST call
 * per coin, run in parallel — the old per-UTXO `gettxout` RPC walk was the main
 * source of checkout latency.
 */
async function isUnspent(txid: string, vout: number): Promise<boolean> {
  try {
    const res = await fetch(`${MEMPOOL_BASE}/tx/${txid}/outspend/${vout}`);
    if (!res.ok) return true; // indexer hiccup — let the node be the judge
    const j = (await res.json()) as { spent?: boolean };
    return j.spent !== true;
  } catch {
    return true;
  }
}

async function getSpendableUtxos(addr: string, exclude: Set<string> = new Set()): Promise<Utxo[]> {
  const res = await fetch(`${MEMPOOL_BASE}/address/${addr}/utxo`);
  if (!res.ok) throw new Error(`utxo fetch http ${res.status}`);
  const raw = (await res.json()) as Array<{
    txid: string;
    vout: number;
    value: number;
    status: { confirmed: boolean };
  }>;
  const checked = await Promise.all(
    raw.filter((u) => !exclude.has(`${u.txid}:${u.vout}`)).map(async (u) => ({
      txid: u.txid,
      vout: u.vout,
      value: u.value,
      confirmed: u.status.confirmed,
      ok: await isUnspent(u.txid, u.vout),
    })),
  );
  return checked
    .filter((u) => u.ok)
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || b.value - a.value)
    .map(({ txid, vout, value }) => ({ txid, vout, value }));
}

/** Previous-tx hex is immutable per txid — cache it for the process lifetime. */
const txHexCache = new Map<string, string>();

async function getTxHex(txid: string): Promise<string> {
  const hit = txHexCache.get(txid);
  if (hit) return hit;
  let hex: string | null = null;
  const res = await fetch(`${MEMPOOL_BASE}/tx/${txid}/hex`);
  if (res.ok) {
    const t = (await res.text()).trim();
    if (/^[0-9a-fA-F]+$/.test(t)) hex = t;
  }
  if (!hex) hex = await rpc<string>("getrawtransaction", [txid]);
  txHexCache.set(txid, hex);
  return hex;
}

/** TSD (Texas Stable Dollar) Omni property id. */
function tsdPropertyId(): number {
  const raw = process.env.TXC_TSD_TOKEN_ID ?? "39";
  const n = Number(raw);
  if (n !== 39) {
    throw new Error("TSD is not configured on this network yet.");
  }
  return n;
}

// Divisibility is fixed at issuance. Known defaults keep the register fast even
// on a cold worker; the chain is still authoritative and refreshes the cache.
const divisibleCache = new Map<number, boolean>([
  [37, false], // POP — indivisible
  // TSD is looked up from the chain on first use, then cached — divisibility
  // is fixed at issuance, and guessing it wrong misprices every send by 1e8.

]);

async function isDivisible(id: number): Promise<boolean> {
  const hit = divisibleCache.get(id);
  if (hit !== undefined) return hit;
  const prop = await rpc<{ divisible?: boolean }>("omni_getproperty", [id]);
  const d = prop.divisible !== false;
  divisibleCache.set(id, d);
  return d;
}


/**
 * Omni Simple Send payload (20 bytes), built locally — no RPC round trip:
 *   "omni" | version(2) | type(2) | propertyId(4 BE) | amount(8 BE)
 */
function simpleSendPayload(id: number, amountUnits: bigint): Buffer {
  if (!Number.isInteger(id) || id <= 0 || id > 0xffffffff) throw new Error("Invalid token id");
  if (amountUnits <= 0n || amountUnits > 0x7fffffffffffffffn) throw new Error("Invalid amount");
  const out = Buffer.alloc(20);
  out.write("omni", 0, "ascii");
  out.writeUInt32BE(id, 8);
  out.writeBigUInt64BE(amountUnits, 12);
  return out;
}

export type UnsignedSend = {
  psbtBase64: string;
  feeSats: number;
  inputCount: number;
  /** Total sats leaving the wallet (fee + any dust/value outputs). */
  totalSats: number;
  /** "txid:vout" of every coin spent. */
  inputs: string[];
  feeRate: number;
};

/**
 * Build an unsigned P2PKH transaction spending `from`.
 * asset "pop" / "tsd" → Omni simple send (OP_RETURN + dust to recipient)
 * asset "txc"  → plain value transfer
 */
export async function buildUnsignedSend(opts: {
  asset: "tsd" | "txc";
  from: string;
  to: string;
  /** POP: whole tokens. TXC: whole coins. */
  amount: number;
  /** "txid:vout" coins this device just spent — skip them. */
  exclude?: string[];
}): Promise<UnsignedSend> {
  const network = TXC_NETWORK;
  if (opts.asset !== "tsd" && opts.asset !== "txc") throw new Error("POP rewards cannot be sent or spent");
  const feeRatePromise = getFeeRate();

  let opReturnScript: Buffer | null = null;
  let opReturnLen = 0;
  let recipientSats = DUST_SATS;

  // Prepare the token payload and fetch coins at the same time.
  const utxosPromise = getSpendableUtxos(opts.from, new Set(opts.exclude ?? []));

  if (opts.asset === "tsd") {
    // Omni reads the recipient from a legacy output — a bech32 (txc1…) target
    // confirms on-chain but silently never moves the tokens.
    if (/^txc1/i.test(opts.to.trim())) {
      throw new Error("Token sends need a T… address — txc1 addresses aren't supported by Omni.");
    }
    if (opts.amount <= 0) throw new Error("Amount must be greater than zero");
    const id = tsdPropertyId();
    const divisible = await isDivisible(id);
    const units = divisible
      ? BigInt(Math.round(opts.amount * 1e8))
      : BigInt(Math.round(opts.amount));
    if (units <= 0n) throw new Error("Amount is too small to send");
    const data = simpleSendPayload(id, units);
    const embedded = bitcoin.payments.embed({ data: [data] }).output;
    if (!embedded) throw new Error("Could not build the token payload");
    opReturnScript = Buffer.from(embedded);
    opReturnLen = data.length;
  } else {
    recipientSats = Math.round(opts.amount * 1e8);
    if (!Number.isFinite(recipientSats) || recipientSats < DUST_SATS) {
      throw new Error(`Minimum TXC send is ${(DUST_SATS / 1e8).toFixed(8)} TXC`);
    }
  }

  const utxos = await utxosPromise;
  if (utxos.length === 0) {
    throw new Error(
      "This address has no TXC to pay the network fee. Send a small amount of TXC to it first, then retry.",
    );
  }
  const FEE_SATS_PER_VBYTE = await feeRatePromise;


  const psbt = new bitcoin.Psbt({ network });
  const used: Utxo[] = [];
  let inputSats = 0;

  const vsizeFor = (n: number) =>
    10 + 148 * n + 34 * 2 + (opReturnScript ? 10 + opReturnLen : 0);

  // Pick coins first (no network), then fetch every prev-tx hex in parallel.
  for (const u of utxos) {
    used.push(u);
    inputSats += u.value;
    const estFee = vsizeFor(used.length) * FEE_SATS_PER_VBYTE;
    if (inputSats >= recipientSats + estFee + DUST_SATS) break;
  }

  const hexes = await Promise.all(used.map((u) => getTxHex(u.txid)));
  used.forEach((u, i) => {
    const previous = hexes[i];
    if (!previous) throw new Error("Missing previous transaction");
    psbt.addInput({ hash: u.txid, index: u.vout, nonWitnessUtxo: Buffer.from(previous, "hex") });
  });


  const fee = vsizeFor(used.length) * FEE_SATS_PER_VBYTE;
  const change = inputSats - recipientSats - fee;
  if (change < 0) throw new Error("Not enough TXC to cover the amount plus network fee.");

  if (opReturnScript) psbt.addOutput({ script: opReturnScript, value: 0n });
  psbt.addOutput({ address: opts.to, value: BigInt(recipientSats) });
  if (change >= DUST_SATS) psbt.addOutput({ address: opts.from, value: BigInt(change) });

  return {
    psbtBase64: psbt.toBase64(),
    feeSats: fee,
    inputCount: used.length,
    totalSats: recipientSats + fee,
    inputs: used.map((u) => `${u.txid}:${u.vout}`),
    feeRate: FEE_SATS_PER_VBYTE,
  };
}

export class CoinsSpentError extends Error {
  constructor(public outpoints: string[]) {
    super("Some coins you were spending were just used by another send. Please try again.");
  }
}

export async function broadcastRaw(rawHex: string): Promise<string> {
  // Last-moment check: are the exact coins we signed still unspent?
  const tx = bitcoin.Transaction.fromHex(rawHex);
  for (const output of tx.outs) {
    if (output.script[0] !== bitcoin.opcodes.OP_RETURN) continue;
    const chunks = bitcoin.script.decompile(output.script);
    const payload = chunks?.[1];
    if (!(payload instanceof Uint8Array) || payload.length !== 20 ||
        Buffer.from(payload).subarray(0, 8).toString("hex") !== "6f6d6e6900000000" ||
        Buffer.from(payload).readUInt32BE(8) !== 39) {
      throw new Error("This wallet only relays TSD or TXC payments; POP rewards cannot be sent or spent.");
    }
  }
  const outs = tx.ins.map((i) => ({ txid: Buffer.from(i.hash).reverse().toString("hex"), vout: i.index }));
  const status = await Promise.all(outs.map((o) => isUnspent(o.txid, o.vout)));
  const spent = outs.filter((_, i) => !status[i]).map((o) => `${o.txid}:${o.vout}`);
  if (spent.length) throw new CoinsSpentError(spent);
  const res = await fetch(`${MEMPOOL_BASE}/tx`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: rawHex,
  });
  const text = (await res.text()).trim();
  if (!res.ok || text.startsWith("<")) {
    try {
      return await rpc<string>("sendrawtransaction", [rawHex]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(friendlyBroadcastError(text.startsWith("<") ? msg : text || msg));
    }
  }
  return text;
}
