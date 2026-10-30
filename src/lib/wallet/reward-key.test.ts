import { describe, expect, it } from "vitest";
import { deriveTxcAddress, deriveLegacyTxcAddress, TXC_PATH, TXC_LEGACY_PATH } from "@/lib/wallet";
import { rewardKeyPath } from "./reward-key";

const M = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("store-payment reward signing key", () => {
  it("uses the new key when the new address paid", () => {
    expect(rewardKeyPath(M, deriveTxcAddress(M))).toBe(TXC_PATH);
  });
  it("uses the older key when the older address paid (POP must still be claimed)", () => {
    expect(rewardKeyPath(M, deriveLegacyTxcAddress(M))).toBe(TXC_LEGACY_PATH);
  });
  it("refuses an address this wallet doesn't own", () => {
    expect(rewardKeyPath(M, "TmmoqqhcfBZWRG8feCTE2c4N4BsADgwD1m")).toBeNull();
  });
});
