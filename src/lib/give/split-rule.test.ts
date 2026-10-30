import { describe, expect, it } from "vitest";
import { giveSplitFor } from "./split-rule";

const M = "TmerchantAddrxxxxxxxxxxxxxxxxxxxxx";
const inGive = { accepted: true, discountPct: 10 };

describe("Give split happens only when store is in Give AND payer picked a recipient", () => {
  it("store in Give + recipient CCV splits $100 into 90 / 8 / 2", () => {
    const s = giveSplitFor({ egiving: inGive, recipientCode: "CCV", total: 100, merchant: M })!;
    expect(s.recipients).toEqual([
      { to: M, amount: 90 },
      { to: "Tst3dVnJbFrnx5ChmK6qj9F3M8YNsHWR44", amount: 8 },
      { to: "ToaRhmGqAW7PyvPJvbLJo69mnZwhaaA1vu", amount: 2 },
    ]);
  });
  it("no recipient set means no split", () =>
    expect(giveSplitFor({ egiving: inGive, recipientCode: null, total: 100, merchant: M })).toBeNull());
  it("store not in Give means no split", () =>
    expect(giveSplitFor({ egiving: { accepted: false, discountPct: 10 }, recipientCode: "CCV", total: 100, merchant: M })).toBeNull());
  it("unpinned cause means no split", () =>
    expect(giveSplitFor({ egiving: inGive, recipientCode: "OTHER", total: 100, merchant: M })).toBeNull());
});
