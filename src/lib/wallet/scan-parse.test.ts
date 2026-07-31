import { describe, it, expect } from "vitest";
import { parseScan } from "@/lib/wallet/scan-parse";
import { deriveTxcAddress } from "@/lib/wallet";

const A = deriveTxcAddress(
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
);

describe("parseScan", () => {
  it("bip21 payment", () => {
    const r = parseScan(`txc:${A}?amount=12.50&asset=tsd&label=Bobby%27s`);
    expect(r).toMatchObject({ kind: "payment", to: A, amount: 12.5, asset: "tsd", merchant: "Bobby's" });
  });
  it("json merchant payment", () => {
    const r = parseScan(JSON.stringify({ cryptopop: "pay", to: A, amount: 5, asset: "tsd" }));
    expect(r.kind).toBe("payment");
  });
  it("pay url", () => {
    const r = parseScan(`https://app.cryptopop.org/pay?to=${A}&amount=3&asset=pop`);
    expect(r).toMatchObject({ kind: "payment", asset: "pop" });
  });
  it("award url", () => {
    expect(parseScan("https://app.cryptopop.org/claim/abc123")).toMatchObject({ kind: "award", token: "abc123" });
  });
  it("bare address", () => {
    expect(parseScan(A)).toMatchObject({ kind: "address" });
  });
  it("words", () => {
    expect(parseScan("abandon ".repeat(12).trim()).kind).toBe("words");
  });
  it("junk", () => {
    expect(parseScan("hello there").kind).toBe("unknown");
  });
});
