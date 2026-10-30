import { afterEach, expect, it, vi } from "vitest";
import { assertPaymentOwner, paymentInputsBelongTo } from "./payment-owner.server";
import { deriveTxcAddress } from "./wallet";
const address = deriveTxcAddress("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
const txid = "a".repeat(64);
afterEach(() => vi.unstubAllGlobals());
it("requires actual inputs from the claimant", () => expect(paymentInputsBelongTo({ txid, vin: [{ prevout: { scriptpubkey_address: address } }] }, txid, address)).toBe(true));
it("rejects claiming another payer's rewards", () => expect(paymentInputsBelongTo({ txid, vin: [{ prevout: { scriptpubkey_address: "other" } }] }, txid, address)).toBe(false));
it("rejects absent input proof", () => expect(paymentInputsBelongTo({ txid, vin: [] }, txid, address)).toBe(false));

// Cloudflare Workers throw on redirect:"error", which silently blocked every store POP claim.
it("looks up the payment with a redirect mode the live server supports", async () => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ txid, vin: [{ prevout: { scriptpubkey_address: address } }] })));
  vi.stubGlobal("fetch", fetchMock);
  await assertPaymentOwner(txid, address);
  const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
  expect(["follow", "manual"]).toContain(init.redirect);
});

it("fails closed when the lookup is redirected", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://evil.example" } })));
  await expect(assertPaymentOwner(txid, address)).rejects.toThrow();
});
