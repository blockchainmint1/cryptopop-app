import { describe, it, expect } from "vitest";
import { interpretClaim, claimHeaders, SHOPPER_DAILY_POP_CAP } from "./pop-claim.server";

describe("NectarPay POP claims", () => {
  it("eligible sale sends the POP NectarPay says (69 for $68.75)", () => {
    const d = interpretClaim(200, { status: "eligible", pop: 69, invoice_id: "inv1", sale_usd: 68.75 });
    expect(d).toMatchObject({ kind: "eligible", pop: 69, invoiceId: "inv1" });
  });
  it("not confirmed yet or unknown txid is retried", () => {
    expect(interpretClaim(202, { status: "not_ready" }).kind).toBe("retry");
    expect(interpretClaim(404, null).kind).toBe("retry");
  });
  it("held waits, denied never pays", () => {
    expect(interpretClaim(200, { status: "held", reason: "new_store", release_at: "2026-11-10T00:00:00Z" }).kind).toBe("held");
    expect(interpretClaim(200, { status: "denied", reason: "own_store" })).toEqual({ kind: "denied", reason: "own_store" });
    expect(interpretClaim(409, { error: "already_claimed" })).toEqual({ kind: "denied", reason: "already_claimed" });
  });
  it("eligible with zero POP pays nothing", () => {
    expect(interpretClaim(200, { status: "eligible", pop: 0, invoice_id: "x" }).kind).toBe("denied");
  });
  it("our per-shopper cap is 1,000 POP a day", () => expect(SHOPPER_DAILY_POP_CAP).toBe(1000));
  it("signs timestamp.body with HMAC-SHA256", async () => {
    const h = await claimHeaders("k", "{}", 100);
    expect(h["X-HME-Timestamp"]).toBe("100");
    expect(h["X-HME-Signature"]).toMatch(/^[0-9a-f]{64}$/);
  });
});
