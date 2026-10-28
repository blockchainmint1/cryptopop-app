import { describe, expect, it } from "vitest";
import { interpretPartnerReply, parsePartnerAccount } from "./tsd-partner.server";
import { tsdLinkMessage, TSD_TICKET_LOGIN_URL } from "./tsd-link-message";

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
  it("202 means waiting for email, with the old address still on file, and no deposit address", () => {
    const r = interpretPartnerReply(202, { status: "pending_confirmation", destination: "TXCold" }, "TXCdest");
    expect(r).toEqual({ status: "pending_confirmation", onFile: "TXCold" });
  });
  it("a 200 for a different address is still refused", () => {
    expect(() => interpretPartnerReply(200, good, "TXCother")).toThrow("destination_mismatch");
  });
  it("reused approval reads as replay", () => {
    expect(interpretPartnerReply(409, { error: "replay" }, "TXCdest")).toMatchObject({ status: "not_ready", code: "replay" });
  });
  it("rate limit honours Retry-After", () => {
    expect(interpretPartnerReply(429, null, "TXCdest", "120")).toMatchObject({ code: "rate_limited", reason: expect.stringContaining("2 min") });
  });
});

describe("TSD signed message", () => {
  it("includes member, destination, TSD Bridge, pop-wallet, nonce and time", () => {
    const m = tsdLinkMessage("mem-1", "TXCdest", "nonce12345", "2026-10-28T11:00:00.000Z");
    for (const s of ["mem-1", "TXCdest", "TSD Bridge", "pop-wallet", "nonce12345", "2026-10-28T11:00:00.000Z"]) expect(m).toContain(s);
  });
});
