import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as bitcoin from "bitcoinjs-lib";
import { deriveTxcAddress } from "./wallet";
import { notifyBroadcastProgress, reportPaying, reportPaymentSubmitted } from "./nectarpay-progress.server";
import { stickerResponseSignature } from "./nectarpay-sticker.server";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("./nectarpay-sticker.server", async importOriginal => ({
  ...await importOriginal<typeof import("./nectarpay-sticker.server")>(), lookupRegisterQr: lookup,
}));
vi.mock("./nectarpay-key.server", () => ({ nectarPayPartnerKey: () => "test-only-partner-key" }));

const invoiceId = "200ce096-34e9-4681-9a5b-d7af650e7ef3";
const requestId = "300ce096-34e9-4681-9a5b-d7af650e7ef3";
const merchant = deriveTxcAddress("legal winner thank year wave sausage worth useful legal winner thank yellow");
const other = deriveTxcAddress("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
const network = { messagePrefix: "", bech32: "txc", bip32: { public: 0x0488b21e, private: 0x0488ade4 }, pubKeyHash: 0x42, scriptHash: 0x32, wif: 0xc1 };
function transaction(address = merchant) {
  const tx = new bitcoin.Transaction();
  tx.addInput(Buffer.alloc(32, 1), 0);
  tx.addOutput(bitcoin.address.toOutputScript(address, network), 10000n);
  return { id: tx.getId(), hex: tx.toHex() };
}
const tx = transaction();
const fetchMock = vi.fn();
async function reply(body: string, tweak: Record<string, unknown> = {}, offset = 0, signature = true) {
  const input = JSON.parse(body) as Record<string, unknown>;
  const text = JSON.stringify({ ...input, accepted: true, status: "verifying", invoice_status: "pending", ...tweak });
  const ts = String(Math.floor(Date.now() / 1000) + offset);
  return new Response(text, { headers: {
    "x-hme-timestamp": ts,
    "x-hme-signature": signature ? await stickerResponseSignature("test-only-partner-key", body, text, ts) : "bad",
  } });
}
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  lookup.mockReset().mockResolvedValue({ kind: "invoice", invoiceId, address: merchant });
  fetchMock.mockImplementation((_url, init: RequestInit) => reply(String(init.body)));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("NectarPay progress hints", () => {
  it("sends payment_submitted to the common endpoint with the exact invoice, txid and request id", async () => {
    expect(await reportPaymentSubmitted(invoiceId, tx.id, requestId)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://app.nectar-pay.com/api/public/v1/payments/progress");
    expect(JSON.parse(init.body)).toEqual({ request_id: requestId, invoice_id: invoiceId, event: "payment_submitted", txid: tx.id });
    expect(init.redirect).toBe("manual");
    expect(init.headers['X-HME-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });
  it("refuses a tampered acknowledgment", async () => {
    fetchMock.mockImplementation((_url, init) => reply(init.body, {}, 0, false));
    expect(await reportPaymentSubmitted(invoiceId, tx.id, requestId)).toBe(false);
  });
  it("refuses a reply older than 300 seconds", async () => {
    fetchMock.mockImplementation((_url, init) => reply(init.body, {}, -301));
    expect(await reportPaymentSubmitted(invoiceId, tx.id, requestId)).toBe(false);
  });
  it("refuses a signed reply for another invoice", async () => {
    fetchMock.mockImplementation((_url, init) => reply(init.body, { invoice_id: requestId }));
    expect(await reportPaymentSubmitted(invoiceId, tx.id, requestId)).toBe(false);
  });
  it("accepts already_settled without altering a paid invoice", async () => {
    fetchMock.mockImplementation((_url, init) => reply(init.body, { already_settled: true }));
    expect(await reportPaymentSubmitted(invoiceId, tx.id, requestId)).toBe(true);
  });
  it("notifies only the merchant present in the broadcast transaction", async () => {
    await notifyBroadcastProgress(invoiceId, tx.id, tx.hex);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("refuses a different transaction id before lookup", async () => {
    await notifyBroadcastProgress(invoiceId, "a".repeat(64), tx.hex);
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("refuses an unrelated merchant even for a signed invoice", async () => {
    lookup.mockResolvedValue({ kind: "invoice", invoiceId, address: other });
    await notifyBroadcastProgress(invoiceId, tx.id, tx.hex);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not send a hint when the signed invoice lookup fails", async () => {
    lookup.mockResolvedValue({ kind: "none" });
    await notifyBroadcastProgress(invoiceId, tx.id, tx.hex);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("retries the same request id and never broadcasts money", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    const pending = notifyBroadcastProgress(invoiceId, tx.id, tx.hex);
    await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(call => JSON.parse(call[1].body));
    expect(bodies[0].request_id).toBe(bodies[1].request_id);
    expect(bodies.every(body => body.event === "payment_submitted" && body.txid === tx.id)).toBe(true);
  });
  it("sends a signed paying hint on scan without a txid", async () => {
    fetchMock.mockImplementation((_url, init) => reply(init.body, { accepted: true, event: "paying" }));
    expect(await reportPaying(invoiceId, requestId)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://app.nectar-pay.com/api/public/v1/payments/progress");
    expect(JSON.parse(init.body)).toEqual({ request_id: requestId, invoice_id: invoiceId, event: "paying" });
  });
  it("rejects a paying acknowledgment with a mismatched event", async () => {
    fetchMock.mockImplementation((_url, init) => reply(init.body, { accepted: true, event: "payment_submitted" }));
    expect(await reportPaying(invoiceId, requestId)).toBe(false);
  });
});