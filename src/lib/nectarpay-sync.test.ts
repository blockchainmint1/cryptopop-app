import { describe, expect, it } from "vitest";
import { toRow } from "./nectarpay-sync.server";

const base = {
  id: "200ce096-34e9-4681-9a5b-d7af650e7ef3",
  name: "Advanced Nutrition",
  category: "Health & Beauty",
  accepts: ["TSD", "TXC"],
  address: { street: "120 circle way 5b", city: "Lake Jackson", region: "TX", postal_code: "77566" },
  updated_at: "2026-10-27T10:57:57.7402+00:00",
};

describe("store directory mirror", () => {
  it("keeps a store active only while NectarPay says it is live", () => {
    expect(toRow(base).is_active).toBe(true);
    expect(toRow({ ...base, status: "closed" }).is_active).toBe(false);
    expect(toRow({ ...base, status: null }).is_active).toBe(true);
  });

  it("never lets a non-web link reach the browser as a logo or website", () => {
    expect(toRow({ ...base, logo_url: "javascript:alert(1)" }).logo_url).toBeNull();
    expect(toRow({ ...base, logo_url: "data:image/svg+xml;base64,AAA" }).logo_url).toBeNull();
    expect(toRow({ ...base, website: "http://store.example" }).website).toBe("http://store.example");
    expect(toRow({ ...base, logo_url: "https://cdn.example/logo.png" }).logo_url).toBe("https://cdn.example/logo.png");
  });

  it("normalises the coins a store accepts", () => {
    expect(toRow({ ...base, accepts: ["tsd", "TSD", " txc ", "not a coin!", "x".repeat(30)] }).accepts).toEqual(["TSD", "TXC"]);
    expect(toRow({ ...base, accepts: undefined }).accepts).toEqual([]);
  });

  it("carries the address through so a pin can be placed", () => {
    const row = toRow(base);
    expect(row.street).toBe("120 circle way 5b");
    expect(row.city).toBe("Lake Jackson");
    expect(row.region).toBe("TX");
    expect(row.postal_code).toBe("77566");
  });

  it("uses NectarPay's own map spot when they send one", () => {
    expect(toRow({ ...base, location: { lat: 29.04, lng: -95.45 } }).lat).toBe(29.04);
    expect(toRow({ ...base, location: null }).lat).toBeNull();
  });

  it("drops a broken timestamp instead of guessing", () => {
    expect(toRow(base).source_updated_at).toBe("2026-10-27T10:57:57.740Z");
    expect(toRow({ ...base, updated_at: "next tuesday" }).source_updated_at).toBeNull();
  });
});
