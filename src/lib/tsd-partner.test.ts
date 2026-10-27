import { describe, expect, it } from "vitest";
import { parsePartnerAccount } from "./tsd-partner.server";

const good = {
  depositAddress: "0x1111111111111111111111111111111111111111",
  destination: "TXCdest",
  networks: [{ chain: "ethereum", label: "Ethereum", tokens: [{ symbol: "USDC", contract: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }] }],
};

describe("TSD partner reply", () => {
  it("accepts a reply bound to our wallet address", () => {
    expect(parsePartnerAccount(good, "TXCdest").depositAddress).toBe(good.depositAddress);
  });
  it("rejects a reply that would send TSD somewhere else", () => {
    expect(() => parsePartnerAccount(good, "TXCother")).toThrow("destination_mismatch");
  });
  it("rejects a non-EVM deposit address", () => {
    expect(() => parsePartnerAccount({ ...good, depositAddress: "nope" }, "TXCdest")).toThrow();
  });
});
