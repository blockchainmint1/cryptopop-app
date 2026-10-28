import { base64, createBase58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";
import { Transaction, RawTx } from "@scure/btc-signer";

export type SendIntent = {
  asset: "tsd" | "txc";
  from: string;
  to: string;
  amount: number;
  /** Extra TXC delivered to the same recipient inside a TSD send (one tx, no mempool conflict). */
  txcAmount?: number;
};
export const MAX_SEND_FEE_SATS = 1_000_000; // 0.01 TXC, never set by the server
const check = createBase58check(sha256);
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

function addressScript(address: string): Uint8Array {
  const decoded = check.decode(address);
  if (decoded.length !== 21 || decoded[0] !== 0x42) throw new Error("Invalid TEXITcoin address");
  return Uint8Array.from([0x76, 0xa9, 0x14, ...decoded.slice(1), 0x88, 0xac]);
}

export function tsdScript(amount: number): Uint8Array {
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6)
    throw new Error("TSD amounts must use at most two decimal places");
  const data = new Uint8Array(20);
  data.set([0x6f, 0x6d, 0x6e, 0x69]);
  const view = new DataView(data.buffer);
  view.setUint32(8, 39); // locally pinned TSD property, never a server-supplied id
  view.setBigUint64(12, BigInt(Math.round(amount * 100)) * 1_000_000n);
  return Uint8Array.from([0x6a, 0x14, ...data]);
}

/** Validate the complete unsigned transaction before any private key is used. */
export function validateSend(psbt: string, intent: SendIntent, ownedAddresses: string[]) {
  if (intent.asset !== "tsd" && intent.asset !== "txc") throw new Error("POP rewards cannot be sent or spent");
  if (!ownedAddresses.includes(intent.from)) throw new Error("The payment source isn't your wallet");
  if (intent.from === intent.to) throw new Error("Cannot send to the same address");
  if (!Number.isFinite(intent.amount) || intent.amount <= 0) throw new Error("Invalid payment amount");
  const tx = Transaction.fromPSBT(base64.decode(psbt), { allowUnknownOutputs: true });
  if (tx.inputsLength < 1 || tx.inputsLength > 100 || tx.lockTime !== 0 || ![1, 2].includes(tx.version))
    throw new Error("Unexpected transaction structure");
  const sourceScript = addressScript(intent.from);
  const targetScript = addressScript(intent.to);
  const outpoints = new Set<string>();
  let inputTotal = 0n;
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);
    if (!input.txid || input.index === undefined || !input.nonWitnessUtxo || input.witnessUtxo ||
        (input.sighashType !== undefined && input.sighashType !== 1) || input.partialSig?.length ||
        input.finalScriptSig?.length || input.finalScriptWitness?.length || input.redeemScript || input.witnessScript)
      throw new Error("Unsafe transaction input");
    // Rehash the complete previous transaction, not metadata supplied by the server.
    // The previous transaction may carry an Omni OP_RETURN output (e.g. the
    // TSD send that funded these coins) — allow it; we only verify the one
    // output being spent below.
    const previous = Transaction.fromRaw(RawTx.encode(input.nonWitnessUtxo), { allowUnknownOutputs: true });
    const id = Array.from(input.txid, (b) => b.toString(16).padStart(2, "0")).join("");
    if (previous.id !== id) throw new Error("Previous transaction does not match the input");
    const key = `${id}:${input.index}`;
    if (outpoints.has(key)) throw new Error("Duplicate transaction input");
    outpoints.add(key);
    if (input.index >= previous.outputsLength) throw new Error("Missing previous output");
    const prev = previous.getOutput(input.index);
    if (!prev.script || prev.amount === undefined || !equal(prev.script, sourceScript))
      throw new Error("The transaction spends coins that are not yours");
    inputTotal += prev.amount;
  }
  let txcSats = 0n;
  if (intent.txcAmount !== undefined) {
    if (intent.asset !== "tsd") throw new Error("Extra TXC can only ride along with a TSD send");
    if (!Number.isFinite(intent.txcAmount) || intent.txcAmount <= 0) throw new Error("Invalid TXC amount");
    if (Math.abs(intent.txcAmount * 1e8 - Math.round(intent.txcAmount * 1e8)) > 1e-6)
      throw new Error("TXC amounts must use at most eight decimal places");
    txcSats = BigInt(Math.round(intent.txcAmount * 1e8));
  }
  const recipientAmount = intent.asset === "tsd" ? 10_000n + txcSats : BigInt(Math.round(intent.amount * 1e8));
  if (recipientAmount < 10_000n) throw new Error("Payment is below the network minimum");
  if (intent.asset === "txc" && Math.abs(intent.amount * 1e8 - Math.round(intent.amount * 1e8)) > 1e-6)
    throw new Error("TXC amounts must use at most eight decimal places");
  const tokenScript = intent.asset === "tsd" ? tsdScript(intent.amount) : null;
  let recipientCount = 0, changeCount = 0, tokenCount = 0;
  let outputTotal = 0n;
  for (let i = 0; i < tx.outputsLength; i++) {
    const out = tx.getOutput(i);
    if (!out.script || out.amount === undefined || out.amount < 0n) throw new Error("Invalid payment output");
    outputTotal += out.amount;
    if (equal(out.script, targetScript) && out.amount === recipientAmount) recipientCount++;
    else if (equal(out.script, sourceScript) && out.amount >= 10_000n) changeCount++;
    else if (tokenScript && equal(out.script, tokenScript) && out.amount === 0n) tokenCount++;
    else throw new Error("The payment contains an unexpected recipient, amount, or token");
  }
  if (recipientCount !== 1 || changeCount > 1 || tokenCount !== (tokenScript ? 1 : 0))
    throw new Error("The payment outputs do not match your request");
  const fee = inputTotal - outputTotal;
  const maximumBySize = BigInt((10 + 148 * tx.inputsLength + 34 * 2 + (tokenScript ? 30 : 0)) * 200 + 9_999);
  if (fee <= 0n || fee > BigInt(MAX_SEND_FEE_SATS) || fee > maximumBySize)
    throw new Error("The network fee exceeds the wallet's safety limit");
  return { feeSats: Number(fee), inputs: [...outpoints] };
}

/* ------------------------------------------------------------------ */
/* Giving split: one TSD payment fanned out to several recipients via  */
/* Omni Send-To-Many (type 7) — a single transaction, no mempool races. */
/* ------------------------------------------------------------------ */

export type SplitIntent = {
  from: string;
  /** Recipients in output order; amounts in whole TSD (2 decimals). */
  recipients: { to: string; amount: number }[];
};

const toCents = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6)
    throw new Error("TSD amounts must use at most two decimal places");
  return Math.round(amount * 100);
};

/**
 * Split a purchase into merchant / church / platform shares, in cents.
 * Church and platform round down; the merchant gets every leftover cent so
 * the three parts always add up to exactly the purchase price.
 */
/** eGiving: the store's discount is shared 80% church / 20% eGiving. */
export const GIVE_CHURCH_SHARE = 0.8;
export const GIVE_MIN_DISCOUNT_PCT = 1;
export const GIVE_MAX_DISCOUNT_PCT = 50;
/** Most recipients a split may have (Omni payload must stay under the 80-byte relay limit). */
export const MAX_SPLIT_RECIPIENTS = 3;

/**
 * Split a purchase in whole cents. The church and eGiving shares round down;
 * leftover cents go to the merchant, so the merchant always receives at least
 * (100 - discount)% and the three parts always total the price.
 */
export function splitGiving(total: number, discountPct = 10) {
  if (!Number.isFinite(discountPct) || discountPct < GIVE_MIN_DISCOUNT_PCT || discountPct > GIVE_MAX_DISCOUNT_PCT)
    throw new Error("Unsupported store discount");
  const cents = toCents(total);
  const church = Math.floor((cents * discountPct * GIVE_CHURCH_SHARE) / 100 + 1e-9);
  const platform = Math.floor((cents * discountPct * (1 - GIVE_CHURCH_SHARE)) / 100 + 1e-9);
  const merchant = cents - church - platform;
  return { merchant: merchant / 100, church: church / 100, platform: platform / 100, total: cents / 100, discountPct };
}

/**
 * The only Omni payloads the relay forwards: a TSD (property 39) simple send
 * (type 0, 20 bytes) or a TSD Send-To-Many (type 7) with 1..MAX_SPLIT_RECIPIENTS.
 */
export function isRelayableOmniPayload(payload: Uint8Array): boolean {
  if (payload.length < 12) return false;
  const v = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  if (v.getUint32(0) !== 0x6f6d6e69 || v.getUint16(4) !== 0 || v.getUint32(8) !== 39) return false;
  const type = v.getUint16(6);
  if (type === 0) return payload.length === 20;
  if (type === 7) {
    const n = payload[12];
    return n >= 1 && n <= MAX_SPLIT_RECIPIENTS && payload.length === 13 + 9 * n;
  }
  return false;
}

/** Omni Send-To-Many payload script for the locally pinned TSD property (39). */
export function tsdSendToManyScript(allocations: { vout: number; amount: number }[]): Uint8Array {
  if (allocations.length < 1 || allocations.length > MAX_SPLIT_RECIPIENTS) throw new Error("Too many recipients");
  const data = new Uint8Array(13 + allocations.length * 9);
  data.set([0x6f, 0x6d, 0x6e, 0x69]);
  const view = new DataView(data.buffer);
  view.setUint16(6, 7);
  view.setUint32(8, 39);
  data[12] = allocations.length;
  allocations.forEach((a, i) => {
    if (!Number.isInteger(a.vout) || a.vout < 0 || a.vout > 255) throw new Error("Invalid output index");
    data[13 + i * 9] = a.vout;
    view.setBigUint64(14 + i * 9, BigInt(toCents(a.amount)) * 1_000_000n);
  });
  return Uint8Array.from([0x6a, data.length, ...data]);
}

/** Validate a split TSD payment completely before any key is used. */
export function validateSplitSend(psbt: string, intent: SplitIntent, ownedAddresses: string[]) {
  if (!ownedAddresses.includes(intent.from)) throw new Error("The payment source isn't your wallet");
  if (intent.recipients.length < 1 || intent.recipients.length > MAX_SPLIT_RECIPIENTS) throw new Error("Invalid recipients");
  const seen = new Set<string>();
  for (const r of intent.recipients) {
    if (r.to === intent.from) throw new Error("Cannot send to the same address");
    if (seen.has(r.to)) throw new Error("Duplicate recipient");
    seen.add(r.to);
    toCents(r.amount);
  }
  const tx = Transaction.fromPSBT(base64.decode(psbt), { allowUnknownOutputs: true });
  if (tx.inputsLength < 1 || tx.inputsLength > 100 || tx.lockTime !== 0 || ![1, 2].includes(tx.version))
    throw new Error("Unexpected transaction structure");
  const sourceScript = addressScript(intent.from);
  const outpoints = new Set<string>();
  let inputTotal = 0n;
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);
    if (!input.txid || input.index === undefined || !input.nonWitnessUtxo || input.witnessUtxo ||
        (input.sighashType !== undefined && input.sighashType !== 1) || input.partialSig?.length ||
        input.finalScriptSig?.length || input.finalScriptWitness?.length || input.redeemScript || input.witnessScript)
      throw new Error("Unsafe transaction input");
    const previous = Transaction.fromRaw(RawTx.encode(input.nonWitnessUtxo), { allowUnknownOutputs: true });
    const id = Array.from(input.txid, (b) => b.toString(16).padStart(2, "0")).join("");
    if (previous.id !== id) throw new Error("Previous transaction does not match the input");
    const key = `${id}:${input.index}`;
    if (outpoints.has(key)) throw new Error("Duplicate transaction input");
    outpoints.add(key);
    if (input.index >= previous.outputsLength) throw new Error("Missing previous output");
    const prev = previous.getOutput(input.index);
    if (!prev.script || prev.amount === undefined || !equal(prev.script, sourceScript))
      throw new Error("The transaction spends coins that are not yours");
    inputTotal += prev.amount;
  }
  // Expected layout: [OP_RETURN, recipient 1..n (dust), optional change].
  const n = intent.recipients.length;
  if (tx.outputsLength !== n + 1 && tx.outputsLength !== n + 2) throw new Error("The payment outputs do not match your request");
  const expectedToken = tsdSendToManyScript(intent.recipients.map((r, i) => ({ vout: i + 1, amount: r.amount })));
  let outputTotal = 0n;
  for (let i = 0; i < tx.outputsLength; i++) {
    const out = tx.getOutput(i);
    if (!out.script || out.amount === undefined || out.amount < 0n) throw new Error("Invalid payment output");
    outputTotal += out.amount;
    if (i === 0) {
      if (!equal(out.script, expectedToken) || out.amount !== 0n) throw new Error("The token split doesn't match your request");
    } else if (i <= n) {
      if (!equal(out.script, addressScript(intent.recipients[i - 1].to)) || out.amount !== 10_000n)
        throw new Error("The payment contains an unexpected recipient");
    } else if (!equal(out.script, sourceScript) || out.amount < 10_000n) {
      throw new Error("Unexpected change output");
    }
  }
  const fee = inputTotal - outputTotal;
  const maximumBySize = BigInt((10 + 148 * tx.inputsLength + 34 * (n + 1) + 15 + expectedToken.length) * 200 + 9_999);
  if (fee <= 0n || fee > BigInt(MAX_SEND_FEE_SATS) || fee > maximumBySize)
    throw new Error("The network fee exceeds the wallet's safety limit");
  return { feeSats: Number(fee), inputs: [...outpoints] };
}
