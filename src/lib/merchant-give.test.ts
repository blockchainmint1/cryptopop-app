import { describe, expect, it } from "vitest";
import { directoryGiveParticipants, filterGiveMerchants } from "./merchant-give";

describe("Give directory filter", () => {
  it("includes only live stores NectarPay explicitly marks as Give participants", () => {
    expect([...directoryGiveParticipants({ stores: [
      { id: "give", status: "live", egiving: { accepted: true } },
      { id: "ordinary", status: "live", egiving: { accepted: false } },
      { id: "unknown", status: "live" },
      { id: "closed", status: "closed", egiving: { accepted: true } },
    ] })]).toEqual(["give"]);
  });
  it("never treats a text value as confirmed participation", () => {
    expect(() => directoryGiveParticipants({ stores: [{ id: "bad", status: "live", egiving: { accepted: "true" } }] })).toThrow();
  });
  it("shows only Give participants when enabled and restores everyone when disabled", () => {
    const stores = [{ id: "give", giveParticipant: true }, { id: "ordinary", giveParticipant: false }, { id: "unknown" }];
    expect(filterGiveMerchants(stores, true).map((s) => s.id)).toEqual(["give"]);
    expect(filterGiveMerchants(stores, false)).toEqual(stores);
  });
});