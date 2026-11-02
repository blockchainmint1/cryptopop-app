import { describe, expect, it } from "vitest";
import { giveSplitFor } from "./split-rule";

const M = "TmerchantAddrxxxxxxxxxxxxxxxxxxxxx";
const inGive = { accepted: true, discountPct: 10 };
const causes = [{ code: "CCV", name: "Christ Church of the Valley", city: "", blurb: "", address: "TrWxgEwo2HuhCSEJXfhD2fJnJbUzpTnU9t", featured: false }];

describe("Give split happens only when store is in Give AND payer picked a recipient", () => {
  it("store in Give + recipient CCV splits $100 into 90 / 8 / 2", () => {
    const s = giveSplitFor({ egiving: inGive, recipientCode: "CCV", causes, total: 100, merchant: M })!;
    expect(s.recipients).toEqual([
      { to: M, amount: 90 },
      { to: "TrWxgEwo2HuhCSEJXfhD2fJnJbUzpTnU9t", amount: 8 },
      { to: "ToaRhmGqAW7PyvPJvbLJo69mnZwhaaA1vu", amount: 2 },
    ]);
  });
  it("no recipient set means no split", () =>
    expect(giveSplitFor({ egiving: inGive, recipientCode: null, causes, total: 100, merchant: M })).toBeNull());
  it("store not in Give means no split", () =>
    expect(giveSplitFor({ egiving: { accepted: false, discountPct: 10 }, recipientCode: "CCV", causes, total: 100, merchant: M })).toBeNull());
  it("no NectarPay list means no split (nothing built in)", () =>
    expect(giveSplitFor({ egiving: inGive, recipientCode: "CCV", causes: null, total: 100, merchant: M })).toBeNull());
  it("retired church address is never used once NectarPay's list changes", () => {
    const s = giveSplitFor({ egiving: inGive, recipientCode: "CCV", causes, total: 100, merchant: M })!;
    expect(s.recipients.map((r) => r.to)).not.toContain("Tst3dVnJbFrnx5ChmK6qj9F3M8YNsHWR44");
  });
  it("uses the program wallet NectarPay states", () => {
    const P = "TprogramFromNectarPayxxxxxxxxxxxxx";
    const s = giveSplitFor({ egiving: { ...inGive, programAddress: P }, recipientCode: "CCV", causes, total: 100, merchant: M })!;
    expect(s.recipients[2]).toEqual({ to: P, amount: 2 });
  });
  it("cause not on NectarPay list means no split", () =>
    expect(giveSplitFor({ egiving: inGive, recipientCode: "OTHER", causes, total: 100, merchant: M })).toBeNull());
});
