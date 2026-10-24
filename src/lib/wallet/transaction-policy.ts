import { base64, createBase58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";
import { Transaction, RawTx } from "@scure/btc-signer";

export type SendIntent = { asset: "tsd" | "txc"; from: string; to: string; amount: number };
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
        input.finalScriptSig || input.finalScriptWitness || input.redeemScript || input.witnessScript)
      throw new Error("Unsafe transaction input");
    // Rehash the complete previous transaction, not metadata supplied by the server.
    const previous = Transaction.fromRaw(RawTx.encode(input.nonWitnessUtxo));
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
  const recipientAmount = intent.asset === "tsd" ? 10_000n : BigInt(Math.round(intent.amount * 1e8));
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