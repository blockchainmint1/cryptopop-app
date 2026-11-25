import { Transaction } from "@scure/btc-signer";
import { createBase58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";
import { nectarPayPartnerKey } from "./nectarpay-key.server";
import { claimHeaders } from "./pop-claim.server";
import { lookupRegisterQr, stickerResponseSignature } from "./nectarpay-sticker.server";

const ENDPOINT = "https://app.nectar-pay.com/api/public/v1/payments/progress";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function postProgress(
  invoiceId: string,
  requestId: string,
  event: "paying" | "payment_submitted",
  txid?: string,
): Promise<boolean> {
  const secret = nectarPayPartnerKey();
  if (!secret) return false;
  const payload: Record<string, string> = { request_id: requestId, invoice_id: invoiceId, event };
  if (txid) payload["txid"] = txid;
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(4000),
      headers: { ...(await claimHeaders(secret, body)), Accept: "application/json", "User-Agent": "Mozilla/5.0 (CryptoPOP wallet)" },
      body,
    });
    const text = await res.text();
    const ts = res.headers.get("x-hme-timestamp") ?? "";
    const sig = res.headers.get("x-hme-signature") ?? "";
    if (!res.ok || !/^\d{10}$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300 ||
        sig !== await stickerResponseSignature(secret, body, text, ts)) return false;
    const reply = JSON.parse(text) as Record<string, unknown>;
    return reply['request_id'] === requestId && reply['invoice_id'] === invoiceId &&
      (reply['already_settled'] === true ||
        (reply['accepted'] === true && reply['event'] === event && (!txid || reply['txid'] === txid)));
  } catch { return false; }
}

/** Scan-time hint so the register can show playful progress while the shopper reviews. */
export function reportPaying(invoiceId: string, requestId: string): Promise<boolean> {
  return postProgress(invoiceId, requestId, "paying");
}

/** A broadcast notice is only a hint, never settlement or permission to spend. */
export function reportPaymentSubmitted(invoiceId: string, txid: string, requestId: string): Promise<boolean> {
  return postProgress(invoiceId, requestId, "payment_submitted", txid);
}

/** Single best-effort scan notice; never blocks or delays opening checkout. */
export async function notifyPayingProgress(invoiceId: string): Promise<void> {
  if (!UUID_RE.test(invoiceId)) return;
  const ok = await reportPaying(invoiceId, crypto.randomUUID());
  if (!ok) console.warn("[NectarPay progress] Scan-time paying notice not accepted.");
}

/** Only invoked after successful broadcast; binds the hint to that transaction and signed invoice. */
export async function notifyBroadcastProgress(invoiceId: string, txid: string, rawHex: string): Promise<void> {
  const tx = Transaction.fromRaw(Uint8Array.from(rawHex.match(/../g) ?? [], h => parseInt(h, 16)), { allowUnknownOutputs: true });
  if (tx.id !== txid) { console.warn("[NectarPay progress] Skipped: txid mismatch."); return; }
  const invoice = await lookupRegisterQr({ invoice_id: invoiceId });
  if (invoice.kind !== "invoice" || invoice.invoiceId !== invoiceId) { console.warn("[NectarPay progress] Skipped: invoice lookup did not match."); return; }
  const decoded = createBase58check(sha256).decode(invoice.address);
  if (decoded.length !== 21 || decoded[0] !== 0x42) return;
  const script = Uint8Array.from([0x76, 0xa9, 0x14, ...decoded.slice(1), 0x88, 0xac]);
  let matches = false;
  for (let i = 0; i < tx.outputsLength; i++) {
    const output = tx.getOutput(i).script;
    if (output?.length === script.length && output.every((b, j) => b === script[j])) matches = true;
  }
  if (!matches) { console.warn("[NectarPay progress] Skipped: merchant output not in transaction."); return; }
  const requestId = crypto.randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await reportPaymentSubmitted(invoiceId, txid, requestId)) return;
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500));
  }
  console.warn("[NectarPay progress] Notice not accepted; payment was already broadcast, never resend it.");
}