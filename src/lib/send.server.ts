// Non-custodial send: server builds an UNSIGNED transaction for the user's
// own address, the device signs it locally, the server relays the signed hex.
// The private key never leaves the phone.
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { TXC_NETWORK } from "./txc.server";

bitcoin.initEccLib(ecc);

const DUST_SATS = 10_000;
const FEE_SATS_PER_VBYTE = 5;
const MEMPOOL_BASE = "https://mempool.texitcoin.org/api";

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

async function getSpendableUtxos(addr: string): Promise<Utxo[]> {
  const res = await fetch(`${MEMPOOL_BASE}/address/${addr}/utxo`);
  if (!res.ok) throw new Error(`utxo fetch http ${res.status}`);
  const raw = (await res.json()) as Array<{
    txid: string;
    vout: number;
    value: number;
    status: { confirmed: boolean };
  }>;
  const out: Array<Utxo & { confirmed: boolean }> = [];
  for (const u of raw) {
    let spendable = true;
    try {
      const r = await rpc<unknown>("gettxout", [u.txid, u.vout, true]);
      spendable = r !== null && r !== undefined;
    } catch {
      spendable = true;
    }
    if (spendable) {
      out.push({ txid: u.txid, vout: u.vout, value: u.value, confirmed: u.status.confirmed });
    }
  }
  return out
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || b.value - a.value)
    .map(({ txid, vout, value }) => ({ txid, vout, value }));
}

async function getTxHex(txid: string): Promise<string> {
  const res = await fetch(`${MEMPOOL_BASE}/tx/${txid}/hex`);
  if (res.ok) {
    const hex = (await res.text()).trim();
    if (/^[0-9a-fA-F]+$/.test(hex)) return hex;
  }
  return rpc<string>("getrawtransaction", [txid]);
}

function propertyId(): number {
  const raw = process.env.TXC_TOKEN_ID ?? "37";
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 37;
}

/** TSD (Texas Stable Dollar) Omni property id. */
function tsdPropertyId(): number {
  const raw = process.env.TXC_TSD_TOKEN_ID;
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n <= 0) {
    throw new Error("TSD is not configured on this network yet.");
  }
  return n;
}

export type UnsignedSend = {
  psbtBase64: string;
  feeSats: number;
  inputCount: number;
  /** Total sats leaving the wallet (fee + any dust/value outputs). */
  totalSats: number;
};

/**
 * Build an unsigned P2PKH transaction spending `from`.
 * asset "pop" / "tsd" → Omni simple send (OP_RETURN + dust to recipient)
 * asset "txc"  → plain value transfer
 */
export async function buildUnsignedSend(opts: {
  asset: "pop" | "tsd" | "txc";
  from: string;
  to: string;
  /** POP: whole tokens. TXC: whole coins. */
  amount: number;
}): Promise<UnsignedSend> {
  const network = TXC_NETWORK;
  const utxos = await getSpendableUtxos(opts.from);
  if (utxos.length === 0) {
    throw new Error("No spendable TXC in this wallet — a small TXC balance is needed for fees.");
  }

  let opReturnScript: Buffer | null = null;
  let opReturnLen = 0;
  let recipientSats = DUST_SATS;

  if (opts.asset === "pop" || opts.asset === "tsd") {
    if (opts.asset === "pop" && !Number.isInteger(opts.amount)) {
      throw new Error("POP amount must be a whole number");
    }
    if (opts.amount <= 0) throw new Error("Amount must be greater than zero");
    const payloadHex = await rpc<string>("omni_createpayload_simplesend", [
      opts.asset === "tsd" ? tsdPropertyId() : propertyId(),
      opts.amount.toFixed(8),
    ]);
    const data = Buffer.concat([
      Buffer.from("omni", "ascii"),
      Buffer.from(payloadHex, "hex"),
    ]);
    opReturnScript = Buffer.from(bitcoin.payments.embed({ data: [data] }).output!);
    opReturnLen = data.length;
  } else {
    recipientSats = Math.round(opts.amount * 1e8);
    if (!Number.isFinite(recipientSats) || recipientSats < DUST_SATS) {
      throw new Error(`Minimum TXC send is ${(DUST_SATS / 1e8).toFixed(8)} TXC`);
    }
  }

  const psbt = new bitcoin.Psbt({ network });
  const used: Utxo[] = [];
  let inputSats = 0;

  const vsizeFor = (n: number) =>
    10 + 148 * n + 34 * 2 + (opReturnScript ? 10 + opReturnLen : 0);

  for (const u of utxos) {
    const hex = await getTxHex(u.txid);
    psbt.addInput({ hash: u.txid, index: u.vout, nonWitnessUtxo: Buffer.from(hex, "hex") });
    used.push(u);
    inputSats += u.value;
    const estFee = vsizeFor(used.length) * FEE_SATS_PER_VBYTE;
    if (inputSats >= recipientSats + estFee + DUST_SATS) break;
  }

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
  };
}

export async function broadcastRaw(rawHex: string): Promise<string> {
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
      throw new Error(`Broadcast failed: ${text.startsWith("<") ? msg : text || msg}`);
    }
  }
  return text;
}
