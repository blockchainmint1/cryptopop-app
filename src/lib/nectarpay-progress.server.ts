import { Transaction } from "@scure/btc-signer";
import { createBase58check } from "@scure/base";
import { sha256 } from "@noble/hashes/sha256";
import { nectarPayPartnerKey } from "./nectarpay-key.server";
import { claimHeaders } from "./pop-claim.server";
import { lookupRegisterQr, stickerResponseSignature } from "./nectarpay-sticker.server";

const ENDPOINT = "https://app.nectar-pay.com/api/public/v1/payments/progress";

/** A broadcast notice is only a hint, never settlement or permission to spend. */
export async function reportPaymentSubmitted(invoiceId: string, txid: string, requestId: string): Promise<boolean> {
  const secret = nectarPayPartnerKey();
  if (!secret) return false;
  const body = JSON.stringify({ request_id: requestId, invoice_id: invoiceId, event: "payment_submitted", txid });
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
      (reply['already_settled'] === true || (reply['accepted'] === true && reply['event'] === "payment_submitted" && reply['txid'] === txid));
  } catch { return false; }
}

/** Only invoked after successful broadcast; binds the hint to that transaction and signed invoice. */
export async function notifyBroadcastProgress(invoiceId: string, txid: string, rawHex: string): Promise<void> {
  const tx = Transaction.fromRaw(Uint8Array.from(rawHex.match(/../g) ?? [], h => parseInt(h, 16)), { allowUnknownOutputs: true });
  if (tx.id !== txid) return;
  const invoice = await lookupRegisterQr({ invoice_id: invoiceId });
  if (invoice.kind !== "invoice" || invoice.invoiceId !== invoiceId) return;
  const decoded = createBase58check(sha256).decode(invoice.address);
  if (decoded.length !== 21 || decoded[0] !== 0x42) return;
  const script = Uint8Array.from([0x76, 0xa9, 0x14, ...decoded.slice(1), 0x88, 0xac]);
  let matches = false;
  for (let i = 0; i < tx.outputsLength; i++) {
    const output = tx.getOutput(i).script;
    if (output?.length === script.length && output.every((b, j) => b === script[j])) matches = true;
  }
  if (!matches) return;
  const requestId = crypto.randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await reportPaymentSubmitted(invoiceId, txid, requestId)) return;
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1500));
  }
  console.warn("[NectarPay progress] Notice not accepted; payment was already broadcast, never resend it.");
}