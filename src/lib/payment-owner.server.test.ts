import { expect, it } from "vitest";
import { paymentInputsBelongTo } from "./payment-owner.server";
import { deriveTxcAddress } from "./wallet";
const address = deriveTxcAddress("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
const txid = "a".repeat(64);
it("requires actual inputs from the claimant", () => expect(paymentInputsBelongTo({ txid, vin: [{ prevout: { scriptpubkey_address: address } }] }, txid, address)).toBe(true));
it("rejects claiming another payer's rewards", () => expect(paymentInputsBelongTo({ txid, vin: [{ prevout: { scriptpubkey_address: "other" } }] }, txid, address)).toBe(false));
it("rejects absent input proof", () => expect(paymentInputsBelongTo({ txid, vin: [] }, txid, address)).toBe(false));