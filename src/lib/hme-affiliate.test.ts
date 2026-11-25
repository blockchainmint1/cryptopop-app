import { afterEach, expect, it, vi } from "vitest";
import { hmeAffiliateLinks } from "./hme-affiliate";
import { fetchHmeAffiliate } from "./hme-affiliate.server";

const member = "11111111-1111-4111-8111-111111111111";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("uses the member's HME code for the default and this wallet's affiliate links", () => {
  expect(hmeAffiliateLinks("Member-Test")).toEqual({
    code: "member-test",
    defaultLink: "https://honest.money/r/member-test",
    walletLink: "https://honest.money/r/member-test?to=https%3A%2F%2Fwallet.cryptopop.org%2F",
  });
});
it("rejects unsafe or missing affiliate codes", () => {
  for (const code of [null, "", "../evil", "https://evil.test", "a".repeat(41)]) expect(hmeAffiliateLinks(code)).toBeNull();
});
it("does not look up members without a verified SSO UUID", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect(await fetchHmeAffiliate(undefined)).toEqual({ status: "not_linked", links: null });
  expect(fetch).not.toHaveBeenCalled();
});
it("looks up the verified member ID and returns only public affiliate links", async () => {
  vi.stubEnv("HME_ECOSYSTEM", "test-only-key");
  const fetch = vi.fn().mockResolvedValue(Response.json({ minerId: member, affiliateId: "member-test", profile: { email: "private@example.org" }, wallets: [] }));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchHmeAffiliate(member)).toEqual({ status: "ready", links: hmeAffiliateLinks("member-test") });
  expect(fetch.mock.calls[0]?.[0]?.searchParams.get("miner_id")).toBe(member);
  expect(fetch.mock.calls[0]?.[0]?.searchParams.has("email")).toBe(false);
  expect(fetch.mock.calls[0]?.[1]?.redirect).toBe("manual");
});
it("never uses another member's affiliate code", async () => {
  vi.stubEnv("HME_ECOSYSTEM", "test-only-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ minerId: "22222222-2222-4222-8222-222222222222", affiliateId: "wrong-member" })));
  expect(await fetchHmeAffiliate(member)).toEqual({ status: "unavailable", links: null });
});
it("refuses unavailable partner lookups instead of inventing an HME link", async () => {
  vi.stubEnv("HME_ECOSYSTEM", "test-only-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
  expect(await fetchHmeAffiliate(member)).toEqual({ status: "unavailable", links: null });
});