// TXC L2 (Omni Layer) mint pipeline — server-only.
// Builds + signs an Omni "Grant" transaction with MINTER_WIF and broadcasts it.
//
// Flow per mint:
//   1. omni_createpayload_grant <propertyId> <amount>   → payload hex (RPC)
//   2. GET issuer UTXOs (esplora)
//   3. Build tx: OP_RETURN("omni\0\0" + payload) + dust to receiver + change
//   4. Sign every input with MINTER_WIF (bitcoinjs-lib Psbt)
//   5. POST raw hex to esplora /tx (broadcast), returns txid
//
// Env: TXC_RPC_URL, TXC_RPC_USER, TXC_RPC_PASS, MINTER_WIF, TXC_TOKEN_ID
// Token defaults to #19 ("NestB", divisible, managed) if TXC_TOKEN_ID unset.

import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "@bitcoinerlab/secp256k1";
import bs58check from "bs58check";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// ---------- TXC network params ----------
// P2PKH version byte 0x42 (decoded from issuer addr `ToeTASHn3LNNTgShPRDhP8r8npqDd3PauJ`).
// P2SH and bech32 are placeholders we don't actually use for the mint flow.
export const TXC_NETWORK: bitcoin.Network = {
  messagePrefix: "\x18Texitcoin Signed Message:\n",
  bech32: "tx",
  bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  pubKeyHash: 0x42,
  scriptHash: 0x05,
  wif: 0x80, // overridden per-WIF in decodeWif()
};

function getPropertyId(): number {
  const raw = process.env.TXC_TOKEN_ID ?? "19";
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`TXC_TOKEN_ID invalid: ${raw}`);
  return n;
}
const DUST_SATS = 10000;
const FEE_SATS_PER_VBYTE = 5;
const MEMPOOL_BASE = "https://mempool.texitcoin.org/api";

// ---------- helpers ----------

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

async function rpc<T = unknown>(method: string, params: unknown[]): Promise<T> {
  const url = envOrThrow("TXC_RPC_URL");
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

type Utxo = { txid: string; vout: number; value: number };

async function getUtxos(addr: string): Promise<Utxo[]> {
  const res = await fetch(`${MEMPOOL_BASE}/address/${addr}/utxo`);
  if (!res.ok) throw new Error(`utxo fetch http ${res.status}`);
  const raw = (await res.json()) as Array<{
    txid: string;
    vout: number;
    value: number;
    status: { confirmed: boolean };
  }>;
  // Include unconfirmed UTXOs — after a rapid mint, our own change output is
  // still in mempool and we'd otherwise see "no UTXOs" until it confirms.
  // Confirmed first so we prefer settled coins; unconfirmed (our change) only
  // gets pulled in when needed.
  return raw
    .map((u) => ({ txid: u.txid, vout: u.vout, value: u.value, confirmed: u.status.confirmed }))
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed))
    .map(({ txid, vout, value }) => ({ txid, vout, value }));
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

// Decode the WIF using its embedded version byte (so we don't have to guess
// TXC's WIF prefix). Returns the keypair + the discovered prefix for sanity.
function loadKey(): { keyPair: ReturnType<typeof ECPair.fromWIF>; address: string } {
  const wif = envOrThrow("MINTER_WIF");
  const decoded = bs58check.decode(wif);
  // 1 byte version, 32 byte priv, optional 1 byte compressed flag, optional 4 byte checksum
  const wifVersion = decoded[0];
  const network: bitcoin.Network = { ...TXC_NETWORK, wif: wifVersion };
  const keyPair = ECPair.fromWIF(wif, network);
  const { address } = bitcoin.payments.p2pkh({
    pubkey: Buffer.from(keyPair.publicKey),
    network,
  });
  if (!address) throw new Error("could not derive minter address from WIF");
  return { keyPair, address };
}

// ---------- omni payload assembly ----------

// Class C OP_RETURN payload: "omni" magic + Omni RPC payload bytes.
// `omni_createpayload_*` already includes the version/type bytes; adding extra
// zero bytes shifts the payload and makes the node decode it as a Simple Send.
function buildOmniOpReturn(grantPayloadHex: string): Buffer {
  const magic = Buffer.from("omni", "ascii");
  const grant = Buffer.from(grantPayloadHex, "hex");
  return Buffer.concat([magic, grant]);
}

// Format a mint count as a decimal-string acceptable to Omni. The node accepts
// both "100" and "100.00000000" for indivisible token #21, normalizing to 100.
function formatDivisibleAmount(units: number | string): string {
  const n = typeof units === "string" ? Number(units) : units;
  if (!Number.isFinite(n) || n <= 0) throw new Error("amount must be positive");
  return n.toFixed(8);
}

// ---------- main entry ----------

export type MintResult = { txHash: string; minterAddress: string };

export async function mintGrant(opts: {
  amount: number;
  toAddress: string;
  memo?: string;
}): Promise<MintResult> {
  const { keyPair, address: issuer } = loadKey();

  // 1. Get omni payload. The 3rd `grantdata` arg is an on-chain memo embedded
  // in the Omni payload itself — perfect for attribution ("why this POP was
  // granted"). Keep it short: the whole OP_RETURN must stay under the node's
  // datacarrier size limit, so we cap memo at 60 bytes.
  const amountStr = formatDivisibleAmount(opts.amount);
  const memo = (opts.memo ?? "").slice(0, 60);
  const payloadHex = await rpc<string>("omni_createpayload_grant", [
    getPropertyId(),
    amountStr,
    memo,
  ]);

  // 2. Get UTXOs
  const utxos = await getUtxos(issuer);
  if (utxos.length === 0) throw new Error("issuer has no UTXOs — needs funding");

  // Select UTXOs greedily (largest first) until we have enough for dust + est fee.
  // Fee estimate: vsize ≈ 10 + 148*inputs + 34*regular_outputs + (10 + opReturnLen)
  utxos.sort((a, b) => b.value - a.value);
  const network: bitcoin.Network = { ...TXC_NETWORK, wif: bs58check.decode(envOrThrow("MINTER_WIF"))[0] };
  const opReturnData = buildOmniOpReturn(payloadHex);
  const opReturnScript = bitcoin.payments.embed({ data: [opReturnData] }).output!;

  const psbt = new bitcoin.Psbt({ network });
  let inputSats = 0;
  const usedUtxos: Utxo[] = [];

  // Naive but reliable: include UTXOs until covered (dust + change_threshold + fee for current size)
  for (const u of utxos) {
    const hex = await getTxHex(u.txid);
    psbt.addInput({
      hash: u.txid,
      index: u.vout,
      nonWitnessUtxo: Buffer.from(hex, "hex"),
    });
    usedUtxos.push(u);
    inputSats += u.value;

    const estVsize =
      10 + 148 * usedUtxos.length + 34 * 2 + (10 + opReturnData.length);
    const estFee = estVsize * FEE_SATS_PER_VBYTE;
    if (inputSats >= DUST_SATS + estFee + DUST_SATS) break;
  }

  const finalVsize =
    10 + 148 * usedUtxos.length + 34 * 2 + (10 + opReturnData.length);
  const fee = finalVsize * FEE_SATS_PER_VBYTE;
  const change = inputSats - DUST_SATS - fee;
  if (change < 0) throw new Error("insufficient TXC funds for mint fee");

  // Outputs (Omni Class C ordering: OP_RETURN first, then reference output)
  psbt.addOutput({ script: opReturnScript, value: 0n });
  psbt.addOutput({ address: opts.toAddress, value: BigInt(DUST_SATS) });
  if (change >= DUST_SATS) {
    psbt.addOutput({ address: issuer, value: BigInt(change) });
  }

  // Sign all inputs
  // bitcoinjs-lib's Signer interface expects sync sign returning Buffer
  const signer: bitcoin.Signer = {
    publicKey: Buffer.from(keyPair.publicKey),
    sign: (hash: Buffer) => Buffer.from(keyPair.sign(hash)),
  };
  for (let i = 0; i < usedUtxos.length; i++) {
    psbt.signInput(i, signer);
  }
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  const rawHex = tx.toHex();

  // Broadcast
  const txid = await broadcast(rawHex);
  return { txHash: txid, minterAddress: issuer };
}
